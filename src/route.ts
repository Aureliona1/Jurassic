import type { JuraRequest } from "./request.ts";

/**
 * A function that handles a matched request.
 *
 * Returning a response with status 404 passes the request on to the next matching route.
 */
export type RouteHandler = (req: JuraRequest) => Response | Promise<Response>;

function compile(path: string): RegExp {
	// Group the pattern so alternations like "a|b" are anchored as a whole.
	return new RegExp("^(?:" + path + ")$");
}

/**
 * A path pattern paired with the handler that runs when a request matches it.
 */
export class Route {
	#path: string;
	#regex: RegExp;

	/**
	 * @param path Can be a string literal or a regular expression string. The whole URL path must match.
	 * @param handler The function that handles a matched request.
	 */
	constructor(
		path: string = "/",
		/** The function that handles a matched request. */
		public handler: RouteHandler
	) {
		this.#path = path;
		this.#regex = compile(path);
	}

	/** The path pattern. Can be a string literal or a regular expression string. */
	get path(): string {
		return this.#path;
	}

	set path(path: string) {
		this.#path = path;
		this.#regex = compile(path);
	}

	/**
	 * Test whether a URL path matches this route.
	 * @param urlPath A decoded URL path.
	 */
	matches(urlPath: string): boolean {
		return this.#regex.test(urlPath);
	}
}
