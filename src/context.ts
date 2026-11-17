import { getCookies } from "@std/http/cookie";
import { HttpError } from "./http_error.ts";
import type { State } from "./types.ts";

/**
 * Everything about the current request that handlers need: the request itself, the parsed URL, route parameters,
 * cookies and per-request state.
 */
export class Context<S extends State = State> {
	/** The original request. */
	readonly req: Request;
	/** The parsed request URL. */
	readonly url: URL;
	/** The decoded URL path, without a trailing slash (except for the root `/`). */
	readonly path: string;
	/** Connection info, such as the remote address. Undefined when `fetch` is called without it (e.g. in tests). */
	readonly info: Deno.ServeHandlerInfo | undefined;
	/** Decoded parameters from the matched route pattern, e.g. `{ id: "42" }` for `/users/:id`. */
	params: Record<string, string> = {};
	/**
	 * For middleware registered with `use(path, ...)`, the part of the path after that prefix (always starting with `/`).
	 * Otherwise, the full path.
	 */
	rest: string;
	/** Per-request data shared between middleware and handlers, such as the authenticated user. */
	state: S = {} as S;

	#cookies?: Record<string, string>;

	/**
	 * Created by the app for each request. You only need to construct one yourself in tests.
	 * @param req The original request.
	 * @param url The parsed request URL.
	 * @param path The decoded, normalised URL path.
	 * @param info Connection info for the request.
	 */
	constructor(req: Request, url: URL, path: string, info?: Deno.ServeHandlerInfo) {
		this.req = req;
		this.url = url;
		this.path = path;
		this.rest = path;
		this.info = info;
	}

	/** The request method, e.g. `"GET"`. */
	get method(): string {
		return this.req.method;
	}

	/** The URL's query parameters. */
	get query(): URLSearchParams {
		return this.url.searchParams;
	}

	/** The request's cookies, by name. */
	get cookies(): Record<string, string> {
		return (this.#cookies ??= getCookies(this.req.headers) as Record<string, string>);
	}

	#ensureUnread(): void {
		if (this.req.bodyUsed) throw new Error("The request body has already been read.");
	}

	/**
	 * Parse the request body as JSON. Responds with 400 if the body isn't valid JSON or fails validation.
	 * @param validate Optional function that checks the data and returns it typed, throwing if it's invalid.
	 * Works directly with schema libraries, e.g. `ctx.json(UserSchema.parse)`.
	 */
	async json<T = unknown>(validate?: (data: unknown) => T): Promise<T> {
		this.#ensureUnread();
		let data: unknown;
		try {
			data = await this.req.json();
		} catch {
			throw new HttpError(400, "Request body is not valid JSON.");
		}
		if (!validate) return data as T;
		try {
			return validate(data);
		} catch (e) {
			throw new HttpError(400, e instanceof Error ? e.message : "Request body failed validation.");
		}
	}

	/** Read the request body as text. */
	async text(): Promise<string> {
		this.#ensureUnread();
		return await this.req.text();
	}

	/** Parse the request body as form data. Responds with 400 if it isn't valid form data. */
	async form(): Promise<FormData> {
		this.#ensureUnread();
		try {
			return await this.req.formData();
		} catch {
			throw new HttpError(400, "Request body is not valid form data.");
		}
	}
}
