/**
 * An incoming request, extended with routing information parsed by the server.
 */
export class JuraRequest extends Request {
	/**
	 * @param req The original request received by `Deno.serve`.
	 * @param path The decoded URL path, without a trailing slash (except for the root `/`).
	 * @param query The URL's query parameters.
	 * @param info Connection info for the request, such as the remote address.
	 */
	constructor(
		req: Request,
		/** The decoded URL path, without a trailing slash (except for the root `/`). */
		public path: string,
		/** The URL's query parameters. */
		public query: URLSearchParams,
		/** Connection info for the request, such as the remote address. */
		public info: Deno.ServeHandlerInfo<Deno.NetAddr>
	) {
		super(req);
	}
}
