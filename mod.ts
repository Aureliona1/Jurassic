/**
 * Jurassic: a small, Deno-native HTTP server framework.
 *
 * @example
 * ```ts
 * import { HttpError, Jurassic, json } from "@aurellis/jurassic";
 * import { logger, serveStatic } from "@aurellis/jurassic/middleware";
 *
 * const app = new Jurassic();
 *
 * app.use(logger());
 *
 * app.get("/api/users/:id", ctx => {
 * 	if (ctx.params.id !== "1") throw new HttpError(404, "No such user.");
 * 	return json({ id: 1, name: "Name" });
 * });
 *
 * app.post("/api/echo", async ctx => json(await ctx.json()));
 *
 * app.use(serveStatic("./public"));
 *
 * app.listen(8000);
 * ```
 *
 * @module
 */
export { Jurassic } from "./src/app.ts";
export { Context } from "./src/context.ts";
export { HttpError } from "./src/http_error.ts";
export type { Handler, Next, State } from "./src/types.ts";
export { deleteCookie, file, html, json, noContent, redirect, setCookie, text } from "./src/response.ts";
