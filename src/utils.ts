/** Normalise a path: leading slash, no trailing slash (except for the root). */
export function normalizePath(p: string): string {
	if (!p.startsWith("/")) p = "/" + p;
	if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
	return p;
}

/** Join a mount prefix and a path. */
export function joinPaths(prefix: string, path: string): string {
	prefix = normalizePath(prefix);
	path = normalizePath(path);
	if (prefix === "/") return path;
	if (path === "/") return prefix;
	return prefix + path;
}

/**
 * Return a response whose headers can be changed. Some responses (e.g. from `fetch`) have immutable headers, so this
 * rebuilds the response around the same body. WebSocket upgrade responses are returned as-is.
 */
export function mutable(res: Response): Response {
	if (res.status === 101) return res;
	return new Response(res.body, res);
}
