import { STATUS_TEXT } from "@std/http/status";

/**
 * An error that maps to an HTTP response. Throw it from any handler and the app turns it into a response with
 * this status, message and headers.
 *
 * @example
 * ```ts
 * import { HttpError } from "@aurellis/jurassic";
 *
 * throw new HttpError(404, "No user with that ID.");
 * ```
 */
export class HttpError extends Error {
	/** The HTTP status code to respond with. */
	readonly status: number;
	/** Extra headers to include in the response. */
	readonly headers: Headers;

	/**
	 * An error that maps to an HTTP response. Throw it from any handler and the app turns it into a response with
	 * this status, message and headers.
	 *
	 * @example
	 * ```ts
	 * import { HttpError } from "@aurellis/jurassic";
	 *
	 * throw new HttpError(404, "No user with that ID.");
	 * ```
	 * @param status The HTTP status code to respond with.
	 * @param message The response body. Defaults to the standard status text (e.g. "Not Found").
	 * @param headers Extra headers to include in the response.
	 */
	constructor(status: number, message?: string, headers?: HeadersInit) {
		super(message ?? (STATUS_TEXT as Record<number, string>)[status] ?? "Error");
		this.name = "HttpError";
		this.status = status;
		this.headers = new Headers(headers);
	}

	/** Build the response for this error. */
	toResponse(): Response {
		const headers = new Headers(this.headers);
		if (!headers.has("Content-Type")) headers.set("Content-Type", "text/plain; charset=utf-8");
		return new Response(this.message, { status: this.status, headers });
	}
}
