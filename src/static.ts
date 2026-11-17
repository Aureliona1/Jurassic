import * as path from "@std/path";
import { contentType } from "@std/media-types";
import { clog } from "@aurellis/helpers";
import { Route } from "./route.ts";

function notFound(): Response {
	return new Response("Resource could not be found...", { status: 404 });
}

async function statFile(filePath: string): Promise<Deno.FileInfo | undefined> {
	try {
		return await Deno.stat(filePath);
	} catch {
		return undefined;
	}
}

/**
 * Serve static files from a specified directory. Any URL path that doesn't match a route before this one will be processed here.
 *
 * Requests for a directory serve its `index.html`. Paths that resolve outside `dir` are rejected with a 404.
 * @param dir The directory to prepend to all URL lookups.
 * @param log Whether to log when a static route is called. (Default - true)
 */
export function staticRoute(dir: string, log = true): Route {
	const root = path.resolve(dir);
	const rootPrefix = root.endsWith(path.SEPARATOR) ? root : root + path.SEPARATOR;

	return new Route(".*", async req => {
		// Work on a local copy so a 404 doesn't change the path seen by later routes.
		const relative = req.path.replace(/^\/+/, "");
		let filePath = path.resolve(root, relative);

		// Block traversal out of the root (../, encoded separators, absolute drive paths).
		if (filePath !== root && !filePath.startsWith(rootPrefix)) return notFound();

		let stat = await statFile(filePath);
		if (stat?.isDirectory) {
			filePath = path.join(filePath, "index.html");
			stat = await statFile(filePath);
		}

		if (log) clog(`Getting ${filePath}`);
		if (!stat?.isFile) return notFound();

		const headers = new Headers({ "Content-Length": String(stat.size) });
		const type = contentType(path.extname(filePath));
		if (type) headers.set("Content-Type", type);

		// Stream the file instead of reading it all into memory.
		const file = await Deno.open(filePath, { read: true });
		return new Response(file.readable, { status: 200, headers });
	});
}
