# Jurassic

A small, Deno-native HTTP server framework.

```
deno add jsr:@aurellis/jurassic
```

```ts
import { HttpError, Jurassic, json } from "@aurellis/jurassic";
import { logger, serveStatic } from "@aurellis/jurassic/middleware";

const app = new Jurassic();

app.use(logger());

app.get("/api/users/:id", ctx => {
	if (ctx.params.id !== "1") throw new HttpError(404, "No such user.");
	return json({ id: 1, name: "Name" });
});

app.use(serveStatic("./public"));

app.listen(8000);
```

## Features

- `URLPattern` routes: `/users/:id`, `/files/*`, `/posts/:id(\\d+)`
- Middleware with `next()`, globally or under a path prefix
- Mount sub-apps with `app.route("/api", api)`
- Typed per-request state: `new Jurassic<{ user?: User }>()`
- Automatic HEAD, OPTIONS and 405 responses
- `HttpError` for throwing HTTP responses from anywhere
- Body helpers with validation: `await ctx.json(UserSchema.parse)`
- Response helpers: `json`, `html`, `text`, `redirect`, `noContent`, `file`, `setCookie`, `deleteCookie`
- Middleware: `serveStatic`, `cors`, `logger`, `bodyLimit`
- Works with `Deno.serve`, `deno serve` (`export default app`) and tests (`await app.fetch(request)`)
