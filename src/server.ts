import { JuraRequest } from "./request.ts";
import type { Route } from "./route.ts";

/** The HTTP methods the server can route. */
export type Method = "GET" | "POST" | "PUT" | "DELETE" | "HEAD";

const METHODS: readonly Method[] = ["GET", "POST", "PUT", "DELETE", "HEAD"];

function defaultOnError(error: unknown): Response {
	// Log the details on the server, but don't leak them to the client.
	console.error(error);
	return new Response("Internal Server Error", { status: 500 });
}

/**
 * An HTTP server that dispatches requests to routes by method and path.
 *
 * Routes for each method are tried in order. A route that returns a 404 passes the request on to the next match.
 * HEAD requests with no matching HEAD route are answered by the matching GET route, without a body.
 */
export class Server {
	/** Builds the response sent when a handler throws. By default, logs the error and sends a generic 500. */
	onError: (error: unknown) => Response | Promise<Response> = defaultOnError;
	/** Routes for GET requests. */
	get: Route[] = [];
	/** Routes for POST requests. */
	post: Route[] = [];
	/** Routes for PUT requests. */
	put: Route[] = [];
	/** Routes for HEAD requests. Falls back to the GET routes when none match. */
	head: Route[] = [];
	/** Routes for DELETE requests. */
	del: Route[] = [];

	#routesFor(method: string): Route[] | undefined {
		switch (method) {
			case "GET":
				return this.get;
			case "POST":
				return this.post;
			case "PUT":
				return this.put;
			case "DELETE":
				return this.del;
			case "HEAD":
				return this.head;
			default:
				return undefined;
		}
	}

	/** Run matching routes in order and return the first response that isn't a 404. */
	async #dispatch(routes: Route[], req: JuraRequest): Promise<Response | undefined> {
		for (const route of routes) {
			if (!route.matches(req.path)) continue;
			const res = await route.handler(req);
			if (res.status === 404) {
				// Release the skipped body (e.g. an open file stream).
				await res.body?.cancel();
				continue;
			}
			return res;
		}
		return undefined;
	}

	/** The methods that have at least one route matching the path. */
	#allowedMethods(urlPath: string): Method[] {
		const allowed = METHODS.filter(m => this.#routesFor(m)!.some(r => r.matches(urlPath)));
		if (allowed.includes("GET") && !allowed.includes("HEAD")) allowed.push("HEAD");
		return allowed;
	}

	async #handle(req: Request, info: Deno.ServeHandlerInfo<Deno.NetAddr>): Promise<Response> {
		const url = new URL(req.url);

		let urlPath: string;
		try {
			urlPath = decodeURIComponent(url.pathname);
		} catch {
			return new Response("Malformed URL path.", { status: 400 });
		}
		if (urlPath.endsWith("/") && urlPath.length > 1) urlPath = urlPath.slice(0, -1);

		const method = req.method.toUpperCase();
		const jreq = new JuraRequest(req, urlPath, url.searchParams, info);

		const routes = this.#routesFor(method);
		let res = routes ? await this.#dispatch(routes, jreq) : undefined;

		if (!res && method === "HEAD") {
			const getRes = await this.#dispatch(this.get, jreq);
			if (getRes) {
				await getRes.body?.cancel();
				res = new Response(null, { status: getRes.status, statusText: getRes.statusText, headers: getRes.headers });
			}
		}

		if (res) return res;

		const allowed = this.#allowedMethods(urlPath);
		if (allowed.length && !allowed.includes(method as Method)) {
			return new Response("Method Not Allowed", { status: 405, headers: { Allow: allowed.join(", ") } });
		}
		return new Response("Could not locate the requested resource...", { status: 404 });
	}

	/**
	 * Start the server.
	 * @param port The port to listen on.
	 * @param onListen Called once the server is listening.
	 */
	listen(port: number, onListen: (addr: Deno.NetAddr) => void = () => {}): Deno.HttpServer<Deno.NetAddr> {
		return Deno.serve({ onError: this.onError, onListen, port }, (req, info) => this.#handle(req, info));
	}
}
