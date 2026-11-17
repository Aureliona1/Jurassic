import { type Cookie, deleteCookie as stdDeleteCookie, setCookie as stdSetCookie } from "@std/http/cookie";
import { serveFile } from "@std/http/file-server";
import { mutable } from "./utils.ts";

function withType(body: BodyInit | null, type: string, init?: ResponseInit): Response {
	const headers = new Headers(init?.headers);
	if (!headers.has("Content-Type")) headers.set("Content-Type", type);
	return new Response(body, { ...init, headers });
}

/**
 * Create a JSON response.
 * @param data The value to serialise.
 * @param init Status and headers. Defaults to 200.
 */
export function json(data: unknown, init?: ResponseInit): Response {
	return Response.json(data, init);
}

/**
 * Create an HTML response.
 * @param body The HTML to send.
 * @param init Status and headers. Defaults to 200.
 */
export function html(body: string, init?: ResponseInit): Response {
	return withType(body, "text/html; charset=utf-8", init);
}

/**
 * Create a plain text response.
 * @param body The text to send.
 * @param init Status and headers. Defaults to 200.
 */
export function text(body: string, init?: ResponseInit): Response {
	return withType(body, "text/plain; charset=utf-8", init);
}

/**
 * Create a redirect response. Unlike `Response.redirect`, this accepts relative locations like `/login`.
 * @param location Where to redirect to.
 * @param status The redirect status. Defaults to 302.
 */
export function redirect(location: string | URL, status: 301 | 302 | 303 | 307 | 308 = 302): Response {
	return new Response(null, { status, headers: { Location: String(location) } });
}

/**
 * Create an empty 204 response.
 * @param headers Headers to include.
 */
export function noContent(headers?: HeadersInit): Response {
	return new Response(null, { status: 204, headers });
}

/**
 * Stream a file from disk, with `Content-Type`, `ETag`, `Last-Modified`, range requests and 304 responses handled.
 * Responds with 404 if the file doesn't exist.
 *
 * The path is used as given: never pass unchecked user input. Use `serveStatic` to serve a directory safely.
 * @param req The request being answered (used for conditional and range headers).
 * @param filePath The file to send.
 */
export function file(req: Request, filePath: string): Promise<Response> {
	return serveFile(req, filePath);
}

/**
 * Add a `Set-Cookie` header to a response.
 * @param res The response to add the cookie to.
 * @param cookie The cookie name, value and attributes.
 * @returns The response with the cookie set (a copy, if the original's headers were immutable).
 */
export function setCookie(res: Response, cookie: Cookie): Response {
	const out = mutable(res);
	stdSetCookie(out.headers, cookie);
	return out;
}

/**
 * Add a header to a response that deletes a cookie on the client.
 * @param res The response to add the header to.
 * @param name The cookie name.
 * @param attributes The path and domain the cookie was set with, if any.
 * @returns The response with the header set (a copy, if the original's headers were immutable).
 */
export function deleteCookie(res: Response, name: string, attributes?: Pick<Cookie, "path" | "domain" | "secure" | "httpOnly">): Response {
	const out = mutable(res);
	stdDeleteCookie(out.headers, name, attributes);
	return out;
}
