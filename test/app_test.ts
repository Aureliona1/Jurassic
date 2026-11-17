import { assertEquals, assertStringIncludes } from "@std/assert";
import * as path from "@std/path";
import { HttpError, Jurassic, json, text } from "../mod.ts";
import { cors, serveStatic } from "../middleware.ts";

const req = (p: string, init?: RequestInit) => new Request(`http://localhost${p}`, init);

Deno.test("route params are decoded", async () => {
	const app = new Jurassic().get("/users/:name", ctx => text(ctx.params.name));
	const res = await app.fetch(req("/users/Sample Name%20b"));
	assertEquals(await res.text(), "Sample Name b");
});

Deno.test("trailing slashes are ignored", async () => {
	const app = new Jurassic().get("/about", () => text("ok"));
	assertEquals((await app.fetch(req("/about/"))).status, 200);
});

Deno.test("unknown path is 404", async () => {
	const app = new Jurassic().get("/", () => text("home"));
	const res = await app.fetch(req("/missing"));
	assertEquals(res.status, 404);
	await res.body?.cancel();
});

Deno.test("wrong method is 405 with Allow", async () => {
	const app = new Jurassic().get("/x", () => text("x")).post("/x", () => text("x"));
	const res = await app.fetch(req("/x", { method: "DELETE" }));
	assertEquals(res.status, 405);
	assertEquals(res.headers.get("Allow"), "GET, POST, HEAD, OPTIONS");
	await res.body?.cancel();
});

Deno.test("OPTIONS is answered automatically", async () => {
	const app = new Jurassic().get("/x", () => text("x"));
	const res = await app.fetch(req("/x", { method: "OPTIONS" }));
	assertEquals(res.status, 204);
	assertEquals(res.headers.get("Allow"), "GET, HEAD, OPTIONS");
});

Deno.test("HEAD uses the GET route without a body", async () => {
	const app = new Jurassic().get("/x", () => text("hello"));
	const res = await app.fetch(req("/x", { method: "HEAD" }));
	assertEquals(res.status, 200);
	assertEquals(res.body, null);
	assertStringIncludes(res.headers.get("Content-Type") ?? "", "text/plain");
});

Deno.test("middleware runs in order around the handler", async () => {
	const order: string[] = [];
	const app = new Jurassic()
		.use(async (_ctx, next) => {
			order.push("a in");
			const res = await next();
			order.push("a out");
			return res;
		})
		.get("/", () => {
			order.push("handler");
			return text("ok");
		});
	await (await app.fetch(req("/"))).text();
	assertEquals(order, ["a in", "handler", "a out"]);
});

Deno.test("state is shared between middleware and handlers", async () => {
	const app = new Jurassic<{ user?: string }>()
		.use((ctx, next) => {
			ctx.state.user = "Sample Name";
			return next();
		})
		.get("/me", ctx => text(ctx.state.user ?? "nobody"));
	assertEquals(await (await app.fetch(req("/me"))).text(), "Sample Name");
});

Deno.test("mounted apps get the prefix", async () => {
	const api = new Jurassic().get("/users/:id", ctx => json({ id: ctx.params.id }));
	const app = new Jurassic().route("/api", api);
	assertEquals(await (await app.fetch(req("/api/users/7"))).json(), { id: "7" });
});

Deno.test("HttpError becomes a response", async () => {
	const app = new Jurassic().get("/", () => {
		throw new HttpError(418, "Short and stout");
	});
	const res = await app.fetch(req("/"));
	assertEquals(res.status, 418);
	assertEquals(await res.text(), "Short and stout");
});

Deno.test("other errors become a 500 without details", async () => {
	const app = new Jurassic().get("/", () => {
		throw new Error("secret details");
	});
	app.onError = () => new Response("Internal Server Error", { status: 500 }); // silence the default console.error
	const res = await app.fetch(req("/"));
	assertEquals(res.status, 500);
	assertEquals((await res.text()).includes("secret"), false);
});

Deno.test("invalid JSON body is 400", async () => {
	const app = new Jurassic().post("/", async ctx => json(await ctx.json()));
	const res = await app.fetch(req("/", { method: "POST", body: "{not json" }));
	assertEquals(res.status, 400);
	await res.body?.cancel();
});

Deno.test("errors downstream still pass through middleware", async () => {
	const app = new Jurassic().use(cors()).get("/", () => {
		throw new HttpError(403);
	});
	const res = await app.fetch(req("/", { headers: { Origin: "https://example.com" } }));
	assertEquals(res.status, 403);
	assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
	await res.body?.cancel();
});

Deno.test("serveStatic serves files, index.html and prefixes", async () => {
	const dir = await Deno.makeTempDir();
	try {
		await Deno.writeTextFile(path.join(dir, "index.html"), "<h1>home</h1>");
		await Deno.writeTextFile(path.join(dir, "style.css"), "body {}");

		const app = new Jurassic().use("/assets", serveStatic(dir));

		const css = await app.fetch(req("/assets/style.css"));
		assertEquals(await css.text(), "body {}");
		assertStringIncludes(css.headers.get("Content-Type") ?? "", "text/css");

		assertEquals(await (await app.fetch(req("/assets"))).text(), "<h1>home</h1>");

		const missing = await app.fetch(req("/assets/nope.txt"));
		assertEquals(missing.status, 404);
		await missing.body?.cancel();
	} finally {
		await Deno.remove(dir, { recursive: true });
	}
});

Deno.test("serveStatic blocks path traversal", async () => {
	const parent = await Deno.makeTempDir();
	try {
		const root = path.join(parent, "public");
		await Deno.mkdir(root);
		await Deno.writeTextFile(path.join(parent, "secret.txt"), "secret");

		const app = new Jurassic().use(serveStatic(root));
		for (const p of ["/../secret.txt", "/%2e%2e/secret.txt", "/..%2fsecret.txt", "/..%5csecret.txt"]) {
			const res = await app.fetch(req(p));
			assertEquals(res.status, 404, p);
			await res.body?.cancel();
		}
	} finally {
		await Deno.remove(parent, { recursive: true });
	}
});
