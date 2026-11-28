// Run from the repo root: node apps/web/build.ts
// Every address in the build is relative, so the files work at the root or under a sub-path.
import { build } from "esbuild";
import { parseEnv } from "node:util";
import { FRONTEND_ENV_PATH, loadFrontendEnv } from "../../scripts/env.ts";
import { withBackend } from "./src/csp.ts";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";

const local: boolean = process.argv.includes("--local");
if (!local) loadFrontendEnv();

const env = local ? parseEnv(await readFile(FRONTEND_ENV_PATH, "utf8")) : process.env;
const out: string = local ? "dist/apps/web-local" : "dist/apps/web";

// Team build settings (D10): fixed in the bundle when each team builds the web view.
const team = {
    clientId: env.RAIDEN_GITHUB_CLIENT_ID ?? "",
    backendUrl: env.RAIDEN_BACKEND_URL ?? "",
    returnUrl: env.RAIDEN_WEB_RETURN_URL ?? "",
};

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await build({
    entryPoints: ["apps/web/src/main.ts"],
    bundle: true,
    format: "esm",
    target: "chrome120",
    tsconfig: "apps/web/tsconfig.json",
    jsx: "automatic",
    jsxImportSource: "preact",
    alias: { react: "preact/compat", "react-dom": "preact/compat" },
    loader: { ".css": "text" },
    minify: true,
    define: { __RAIDEN_TEAM__: JSON.stringify(team) },
    outfile: `${out}/main.js`,
});
// The offline worker gets a new cache name every build, so the next update replaces the offline
// page and deletes older caches.
await build({
    entryPoints: ["apps/web/src/sw-entry.ts"],
    bundle: true,
    format: "iife",
    target: "chrome120",
    tsconfig: "apps/web/tsconfig.json",
    define: { __CACHE_NAME__: JSON.stringify(`raiden-${Date.now().toString(36)}`) },
    minify: true,
    outfile: `${out}/sw.js`,
});
// The offline page is self-contained: the design-system tokens are inlined, not linked.
const tokens: string = await readFile("libs/design-system/tokens.css", "utf8");
const offline: string = (await readFile("apps/web/offline.html", "utf8")).replace("/*TOKENS*/", () => tokens);
await writeFile(`${out}/offline.html`, offline);
await cp("apps/web/manifest.webmanifest", `${out}/manifest.webmanifest`);
await cp("docs/assets/raiden.png", `${out}/raiden.png`);
await cp("docs/assets/raiden-192x.png", `${out}/raiden-192x.png`);
await cp("docs/assets/raiden-512x.png", `${out}/raiden-512x.png`);
await writeFile(`${out}/index.html`, withBackend(await readFile("apps/web/index.html", "utf8"), team.backendUrl));
await cp("libs/design-system/fonts", `${out}/fonts`, { recursive: true });
await cp("docs/assets/raiden-128x.png", `${out}/raiden-128x.png`);
