import type { Handler, State } from "../types.ts";
import { mutable } from "../utils.ts";

/** Options for {@link cors}. */
export interface CorsOptions {
	/**
	 * Which origins may make requests: `"*"` for any, one origin, a list of origins, or a function that decides.
	 * Default: `"*"`.
	 */
	origin?: string | string[] | ((origin: string) => boolean);
	/** Methods allowed in preflight requests. Default: GET, HEAD, PUT, PATCH, POST, DELETE. */
	methods?: string[];
	/** Request headers allowed in preflight requests. Default: whatever the browser asks for. */
	allowHeaders?: string[];
	/** Response headers the browser may expose to scripts. */
	exposeHeaders?: string[];
	/** Allow cookies and auth headers. With `origin: "*"`, the request's origin is echoed back instead. Default: `false`. */
	credentials?: boolean;
	/** How long (in seconds) browsers may cache preflight results. */
	maxAge?: number;
}

/**
 * Add CORS headers and answer preflight requests.
 * @param options Which origins, methods and headers to allow.
 */
export function cors<S extends State = State>(options: CorsOptions = {}): Handler<S> {
	const { origin = "*", methods = ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"], allowHeaders, exposeHeaders, credentials = false, maxAge } = options;

	function allowOrigin(requestOrigin: string | null): string | undefined {
		if (origin === "*") return credentials ? (requestOrigin ?? undefined) : "*";
		if (!requestOrigin) return undefined;
		if (typeof origin === "string") return origin === requestOrigin ? requestOrigin : undefined;
		if (Array.isArray(origin)) return origin.includes(requestOrigin) ? requestOrigin : undefined;
		return origin(requestOrigin) ? requestOrigin : undefined;
	}

	return async (ctx, next) => {
		const allowed = allowOrigin(ctx.req.headers.get("Origin"));
		const headers = new Headers();
		const vary: string[] = [];

		if (allowed) {
			headers.set("Access-Control-Allow-Origin", allowed);
			if (credentials) headers.set("Access-Control-Allow-Credentials", "true");
			if (exposeHeaders?.length) headers.set("Access-Control-Expose-Headers", exposeHeaders.join(", "));
		}
		if (allowed !== "*") vary.push("Origin");

		const isPreflight = ctx.method === "OPTIONS" && ctx.req.headers.has("Access-Control-Request-Method");
		if (isPreflight) {
			if (allowed) {
				headers.set("Access-Control-Allow-Methods", methods.join(", "));
				const requested = allowHeaders?.join(", ") ?? ctx.req.headers.get("Access-Control-Request-Headers");
				if (requested) headers.set("Access-Control-Allow-Headers", requested);
				if (!allowHeaders) vary.push("Access-Control-Request-Headers");
				if (maxAge !== undefined) headers.set("Access-Control-Max-Age", String(maxAge));
			}
			if (vary.length) headers.set("Vary", vary.join(", "));
			return new Response(null, { status: 204, headers });
		}

		const res = mutable(await next());
		for (const [key, value] of headers) res.headers.set(key, value);
		for (const v of vary) res.headers.append("Vary", v);
		return res;
	};
}
