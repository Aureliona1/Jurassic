import { HttpError } from "../http_error.ts";
import type { Handler, State } from "../types.ts";

/**
 * Reject requests whose `Content-Length` is over a limit with 413 Content Too Large.
 *
 * Requests without a `Content-Length` header (chunked uploads) are not checked.
 * @param maxBytes The largest allowed body size, in bytes.
 */
export function bodyLimit<S extends State = State>(maxBytes: number): Handler<S> {
	return (ctx, next) => {
		const length = ctx.req.headers.get("Content-Length");
		if (length !== null && Number(length) > maxBytes) {
			throw new HttpError(413, `Request body is larger than ${maxBytes} bytes.`);
		}
		return next();
	};
}
