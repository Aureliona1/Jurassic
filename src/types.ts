import type { Context } from "./context.ts";

/** The shape of per-request state that middleware can populate. */
export type State = Record<string, unknown>;

/** Runs the next matching middleware or route and resolves to its response. */
export type Next = () => Promise<Response>;

/**
 * A route handler or middleware.
 *
 * Return a response to finish the request, or call `next()` to pass it on to the next matching handler.
 */
export type Handler<S extends State = State> = (ctx: Context<S>, next: Next) => Response | Promise<Response>;
