import * as path from "@std/path";
import { serveFile } from "@std/http/file-server";
import { clog } from "@aurellis/helpers";
import type { Handler, State } from "../types.ts";

/** Options for {@link serveStatic}. */
export interface ServeStaticOptions {
	/** The file served for directory requests. Set to `false` to disable. Default: `"index.html"`. */
	index?: string | false;
	/**
	 * A file (relative to the root) served when no file matches, e.g. `"index.html"` for single-page apps.
	 * Default: none, so the request passes on to the next handler.
	 */
	fallback?: string;
	/** Log each file served. Default: `false`. */
	log?: boolean;
}

interface Found {
	path: string;
	info: Deno.FileInfo;
}

async function stat(filePath: string): Promise<Deno.FileInfo | undefined> {
	try {
		return await Deno.stat(filePath);
	} catch {
		return undefined;
	}
}

/**
 * Serve files from a directory. Missing files pass the request on to the next handler.
 *
 * Mount it with a prefix to serve the directory under that path: `app.use("/assets", serveStatic("./public"))`.
 * Paths that resolve outside the directory are never served.
 * @param root The directory to serve.
 * @param options Index, fallback and logging options.
 */
export function serveStatic<S extends State = State>(root: string, options: ServeStaticOptions = {}): Handler<S> {
	const { index = "index.html", fallback, log = false } = options;
	const base = path.resolve(root);
	const basePrefix = base.endsWith(path.SEPARATOR) ? base : base + path.SEPARATOR;

	async function find(relative: string): Promise<Found | undefined> {
		let filePath = path.resolve(base, relative.replace(/^[/\\]+/, ""));
		// Block traversal out of the root (../, encoded separators, absolute drive paths).
		if (filePath !== base && !filePath.startsWith(basePrefix)) return undefined;

		let info = await stat(filePath);
		if (info?.isDirectory) {
			if (!index) return undefined;
			filePath = path.join(filePath, index);
			info = await stat(filePath);
		}
		return info?.isFile ? { path: filePath, info } : undefined;
	}

	return async (ctx, next) => {
		if (ctx.method !== "GET" && ctx.method !== "HEAD") return await next();

		const found = (await find(ctx.rest)) ?? (fallback ? await find(fallback) : undefined);
		if (!found) return await next();

		if (log) clog(`Serving ${found.path}`);
		return await serveFile(ctx.req, found.path, { fileInfo: found.info });
	};
}
