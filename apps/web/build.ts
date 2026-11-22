// Run from the repo root: node apps/web/build.ts
// Every address in the build is relative, so the files work at the root or under a sub-path.
import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";

const out: string = "dist/apps/web";

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
    outfile: `${out}/main.js`,
});
await cp("apps/web/index.html", `${out}/index.html`);
await cp("libs/design-system/fonts", `${out}/fonts`, { recursive: true });
await cp("docs/assets/raiden-128x.png", `${out}/raiden-128x.png`);
