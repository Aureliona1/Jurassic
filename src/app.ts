import { Context } from "./context.ts";
import { HttpError } from "./http_error.ts";
import type { Handler, State } from "./types.ts";
import { joinPaths, normalizePath } from "./utils.ts";

/** Name of the hidden pattern group that captures the rest of the path for prefixed middleware. */
const REST = "__jurassic_rest";

interface Entry<S extends State> {
	/** Upper-case method, or undefined for middleware and `all()` routes. */
	method: string | undefined;
	/** The registered path, or undefined for middleware that runs on every path. */
	path: string | undefined;
	pattern: URLPattern | undefined;
	middleware: boolean;
	handler: Handler<S>;
}

interface Match {
	params: Record<string, string>;
	rest: string;
}

function decode(value: string): string {
	try {
		return decodeURIComponent(value);
	} catch {
		throw new HttpError(400, "Malformed URL path.");
	}
}

function defaultOnError(error: unknown): Response {
	// Log the details on the server, but don't leak them to the client.
	console.error(error);
	return new Response("Internal Server Error", { status: 500 });
}

function defaultNotFound(): Response {
	return new Response("Not Found", { status: 404 });
}

/**
 * A Jurassic app: routes, middleware and the request handler that runs them.
 *
 * Handlers run in the order they were registered. Middleware (`use`) runs on every matching path for any method;
 * routes (`get`, `post`, ...) run on an exact path match for their method. Each handler either returns a response
 * or calls `next()` to pass the request on.
 *
 * Route paths use `URLPattern` syntax: `/users/:id`, `/files/*`, `/posts/:id(\\d+)`.
 *
 * @example
 * ```ts
 * import { Jurassic, json } from "@aurellis/jurassic";
 *
 * const app = new Jurassic();
 * app.get("/users/:id", ctx => json({ id: ctx.params.id }));
 * app.listen(8000);
 * ```
 */
export class Jurassic<S extends State = State> {
	#entries: Entry<S>[] = [];

	/**
	 * Builds the response when a handler throws something other than an {@link HttpError}.
	 * By default, logs the error and sends a generic 500.
	 */
	onError: (error: unknown, ctx: Context<S>) => Response | Promise<Response> = defaultOnError;

	/** Builds the response when no route handles the request. By default, a plain 404. */
	notFound: (ctx: Context<S>) => Response | Promise<Response> = defaultNotFound;

	/**
	 * Handle a request. Pass this to `Deno.serve`, export the app as default for `deno serve`, or call it directly in
	 * tests: `await app.fetch(new Request("http://localhost/users/1"))`.
	 */
	fetch: (req: Request, info?: Deno.ServeHandlerInfo) => Promise<Response> = async (req, info) => {
		const url = new URL(req.url);
		const rawPath = normalizePath(url.pathname);

		let res: Response;
		let ctx: Context<S> | undefined;
		try {
			ctx = new Context<S>(req, url, decode(rawPath), info);
			res = await this.#run(ctx, rawPath);
		} catch (e) {
			res = ctx ? await this.#handleError(e, ctx) : e instanceof HttpError ? e.toResponse() : defaultOnError(e);
		}

		if (req.method === "HEAD" && res.body) {
			await res.body.cancel();
			res = new Response(null, { status: res.status, statusText: res.statusText, headers: res.headers });
		}
		return res;
	};

	/**
	 * Start an HTTP server for this app.
	 * @param options A port number, or full `Deno.serve` options (port, hostname, signal for graceful shutdown, TLS, ...).
	 * Defaults to port 8000.
	 */
	listen(options: number | Deno.ServeTcpOptions = {}): Deno.HttpServer<Deno.NetAddr> {
		return Deno.serve(typeof options === "number" ? { port: options } : options, this.fetch);
	}

	/**
	 * Add middleware that runs for every request.
	 * @param handlers The middleware to add, in order.
	 */
	use(...handlers: Handler<S>[]): this;
	/**
	 * Add middleware that runs for every request under a path prefix. Inside it, `ctx.rest` is the path after the prefix.
	 * @param path The path prefix, e.g. `/api`.
	 * @param handlers The middleware to add, in order.
	 */
	use(path: string, ...handlers: Handler<S>[]): this;
	use(first: string | Handler<S>, ...handlers: Handler<S>[]): this {
		if (typeof first === "string") return this.#add(undefined, first, true, handlers);
		return this.#add(undefined, undefined, true, [first, ...handlers]);
	}

	/**
	 * Add a route for one or more methods.
	 * @param method The method or methods, e.g. `"PATCH"` or `["GET", "POST"]`.
	 * @param path The route pattern.
	 * @param handlers The handlers to run, in order.
	 */
	on(method: string | string[], path: string, ...handlers: Handler<S>[]): this {
		for (const m of Array.isArray(method) ? method : [method]) this.#add(m.toUpperCase(), path, false, handlers);
		return this;
	}

	/**
	 * Add a route for every method.
	 * @param path The route pattern.
	 * @param handlers The handlers to run, in order.
	 */
	all(path: string, ...handlers: Handler<S>[]): this {
		return this.#add(undefined, path, false, handlers);
	}

	/**
	 * Add a GET route. It also answers HEAD requests, with the body removed.
	 * @param path The route pattern.
	 * @param handlers The handlers to run, in order.
	 */
	get(path: string, ...handlers: Handler<S>[]): this {
		return this.on("GET", path, ...handlers);
	}

	/**
	 * Add a POST route.
	 * @param path The route pattern.
	 * @param handlers The handlers to run, in order.
	 */
	post(path: string, ...handlers: Handler<S>[]): this {
		return this.on("POST", path, ...handlers);
	}

	/**
	 * Add a PUT route.
	 * @param path The route pattern.
	 * @param handlers The handlers to run, in order.
	 */
	put(path: string, ...handlers: Handler<S>[]): this {
		return this.on("PUT", path, ...handlers);
	}

	/**
	 * Add a PATCH route.
	 * @param path The route pattern.
	 * @param handlers The handlers to run, in order.
	 */
	patch(path: string, ...handlers: Handler<S>[]): this {
		return this.on("PATCH", path, ...handlers);
	}

	/**
	 * Add a DELETE route.
	 * @param path The route pattern.
	 * @param handlers The handlers to run, in order.
	 */
	delete(path: string, ...handlers: Handler<S>[]): this {
		return this.on("DELETE", path, ...handlers);
	}

	/**
	 * Add a HEAD route. Usually unnecessary: GET routes answer HEAD requests automatically.
	 * @param path The route pattern.
	 * @param handlers The handlers to run, in order.
	 */
	head(path: string, ...handlers: Handler<S>[]): this {
		return this.on("HEAD", path, ...handlers);
	}

	/**
	 * Add an OPTIONS route. Usually unnecessary: OPTIONS requests are answered automatically with an `Allow` header.
	 * @param path The route pattern.
	 * @param handlers The handlers to run, in order.
	 */
	options(path: string, ...handlers: Handler<S>[]): this {
		return this.on("OPTIONS", path, ...handlers);
	}

	/**
	 * Mount another app's routes and middleware under a path prefix.
	 *
	 * The routes are copied when this is called, so add everything to the sub-app first. The sub-app's own
	 * `onError` and `notFound` are not used; this app's are.
	 * @param prefix The path prefix, e.g. `/api`.
	 * @param app The app to mount.
	 */
	route(prefix: string, app: Jurassic<S>): this {
		for (const e of app.#entries) {
			const path = e.path === undefined ? normalizePath(prefix) : joinPaths(prefix, e.path);
			this.#add(e.method, path, e.middleware, [e.handler]);
		}
		return this;
	}

	#add(method: string | undefined, path: string | undefined, middleware: boolean, handlers: Handler<S>[]): this {
		if (!handlers.length) throw new TypeError("At least one handler is required.");
		if (path !== undefined) path = normalizePath(path);

		let pattern: URLPattern | undefined;
		if (path !== undefined && !(middleware && path === "/")) {
			pattern = new URLPattern({ pathname: middleware ? `${path}{/:${REST}(.*)}?` : path });
		}
		for (const handler of handlers) this.#entries.push({ method, path, pattern, middleware, handler });
		return this;
	}

	#match(entry: Entry<S>, method: string, rawPath: string, path: string): Match | undefined {
		if (entry.method && entry.method !== method && !(method === "HEAD" && entry.method === "GET")) return undefined;
		if (!entry.pattern) return { params: {}, rest: path };

		const result = entry.pattern.exec({ pathname: rawPath });
		if (!result) return undefined;

		const params: Record<string, string> = {};
		// Prefixed middleware that matches the prefix exactly has an empty rest.
		let rest = entry.middleware ? "/" : path;
		for (const [key, value] of Object.entries(result.pathname.groups)) {
			if (key === REST) rest = "/" + decode(value ?? "");
			else if (value !== undefined) params[key] = decode(value);
		}
		return { params, rest };
	}

	#run(ctx: Context<S>, rawPath: string): Promise<Response> {
		const entries = this.#entries;
		let index = -1;

		const dispatch = async (start: number): Promise<Response> => {
			if (start <= index) throw new Error("next() was called more than once.");
			for (let i = start; i < entries.length; i++) {
				const match = this.#match(entries[i], ctx.method, rawPath, ctx.path);
				if (!match) continue;
				index = i;
				ctx.params = match.params;
				ctx.rest = match.rest;

				const next = async (): Promise<Response> => {
					let res: Response;
					try {
						res = await dispatch(i + 1);
					} catch (e) {
						// Turn downstream errors into responses so upstream middleware (logging, CORS) still sees them.
						res = await this.#handleError(e, ctx);
					}
					ctx.params = match.params;
					ctx.rest = match.rest;
					return res;
				};

				const res = await entries[i].handler(ctx, next);
				if (!(res instanceof Response)) throw new TypeError(`A handler for ${ctx.method} ${ctx.path} did not return a Response.`);
				return res;
			}
			index = entries.length;
			return await this.#fallback(ctx, rawPath);
		};

		return dispatch(0);
	}

	/** No handler responded: answer OPTIONS, reject the wrong method with 405, or fall back to 404. */
	#fallback(ctx: Context<S>, rawPath: string): Response | Promise<Response> {
		const allowed = new Set<string>();
		for (const e of this.#entries) {
			if (e.middleware || !e.method || !e.pattern) continue;
			if (e.pattern.test({ pathname: rawPath })) allowed.add(e.method);
		}
		if (allowed.has("GET")) allowed.add("HEAD");

		if (allowed.size) {
			allowed.add("OPTIONS");
			const headers = { Allow: [...allowed].join(", ") };
			if (ctx.method === "OPTIONS") return new Response(null, { status: 204, headers });
			if (!allowed.has(ctx.method)) return new Response("Method Not Allowed", { status: 405, headers });
		}
		return this.notFound(ctx);
	}

	async #handleError(error: unknown, ctx: Context<S>): Promise<Response> {
		if (error instanceof HttpError) return error.toResponse();
		return await this.onError(error, ctx);
	}
}
