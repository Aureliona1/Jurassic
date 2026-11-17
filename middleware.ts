/**
 * Built-in middleware for Jurassic apps: static files, CORS, request logging and body size limits.
 *
 * @example
 * ```ts
 * import { Jurassic } from "@aurellis/jurassic";
 * import { bodyLimit, cors, logger, serveStatic } from "@aurellis/jurassic/middleware";
 *
 * const app = new Jurassic();
 * app.use(logger());
 * app.use("/api", cors({ origin: "https://example.com" }), bodyLimit(1_000_000));
 * app.use("/assets", serveStatic("./public"));
 * ```
 *
 * @module
 */
export { bodyLimit } from "./src/middleware/body_limit.ts";
export { cors, type CorsOptions } from "./src/middleware/cors.ts";
export { logger, type LoggerOptions } from "./src/middleware/logger.ts";
export { serveStatic, type ServeStaticOptions } from "./src/middleware/static.ts";
