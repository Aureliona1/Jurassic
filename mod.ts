/**
 * Jurassic: a small, Deno-native HTTP server framework.
 *
 * @example
 * ```ts
 * import { htmlResponse, Route, Server, staticRoute } from "@aurellis/jurassic";
 *
 * const server = new Server();
 * server.get.push(
 * 	new Route("/hello", () => htmlResponse("<h1>Hello!</h1>")),
 * 	staticRoute("./public")
 * );
 * server.listen(8000);
 * ```
 *
 * @module
 */
export * from "./src/request.ts";
export * from "./src/route.ts";
export * from "./src/server.ts";
export * from "./src/static.ts";
export * from "./src/response.ts";
