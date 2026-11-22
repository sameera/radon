// Run from the repo root: node apps/extension/build.ts
import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";

const out: string = "dist/apps/extension";

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
// The content script runs on every github.com page. It stays small and loads the app on demand.
await build({
    entryPoints: ["apps/extension/src/content.ts"],
    bundle: true,
    format: "iife",
    target: "chrome120",
    tsconfig: "apps/extension/tsconfig.json",
    outfile: `${out}/content.js`,
});
// The app bundle is a web-accessible module. Preact's React compatibility layer is on.
await build({
    entryPoints: ["apps/extension/src/app.ts"],
    bundle: true,
    format: "esm",
    target: "chrome120",
    tsconfig: "apps/extension/tsconfig.json",
    jsx: "automatic",
    jsxImportSource: "preact",
    alias: { react: "preact/compat", "react-dom": "preact/compat" },
    loader: { ".css": "text" },
    minify: true,
    outfile: `${out}/app.js`,
});
await cp("apps/extension/manifest.json", `${out}/manifest.json`);
await cp("apps/extension/fonts", `${out}/fonts`, { recursive: true });
await cp("docs/assets/raiden-128x.png", `${out}/raiden-128x.png`);
