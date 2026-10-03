import { createReadStream } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const vitestRequire = createRequire(require.resolve("vitest"));
const { createServer } = await import(vitestRequire.resolve("vite"));
const iconRoute = {
  name: "fixture-original-icon",
  configureServer(server) {
    server.middlewares.use("/icon.svg", (_req, res, next) => {
      res.setHeader("Content-Type", "image/svg+xml");
      createReadStream(resolve("src/app/icon.svg")).on("error", next).pipe(res);
    });
  },
};
const server = await createServer({
  configFile: false,
  root: resolve("tests/browser-fixture"),
  publicDir: resolve("public"),
  plugins: [iconRoute],
  resolve: {
    alias: {
      "@": resolve("src"),
      "next/navigation": resolve("tests/browser-fixture/navigation.ts"),
      "next/link": resolve("tests/browser-fixture/link.tsx"),
      "next/image": resolve("tests/browser-fixture/image.tsx"),
    },
  },
  server: { host: "127.0.0.1", port: 3101, strictPort: true, fs: { allow: [process.cwd()] } },
});
server.middlewares.use("/api", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  if (req.url.includes("seat-state")) {
    res.statusCode = 204;
    res.end();
  } else res.end(JSON.stringify({ occupiedSeatIds: [], selectedSeatIds: [] }));
});
await server.listen();
