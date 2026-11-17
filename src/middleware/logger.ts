import { clog } from "@aurellis/helpers";
import type { Handler, State } from "../types.ts";

/** Options for {@link logger}. */
export interface LoggerOptions {
	/** Where to write each log line. Default: `clog` from `@aurellis/helpers`. */
	log?: (line: string) => void;
}

/**
 * Log each request's method, path, status and duration, e.g. `GET /users/1 200 3.2ms`.
 *
 * Register it first so it times the whole request, including other middleware.
 * @param options Where to write the log lines.
 */
export function logger<S extends State = State>(options: LoggerOptions = {}): Handler<S> {
	const log = options.log ?? ((line: string) => clog(line));
	return async (ctx, next) => {
		const start = performance.now();
		const res = await next();
		log(`${ctx.method} ${ctx.path} ${res.status} ${(performance.now() - start).toFixed(1)}ms`);
		return res;
	};
}
