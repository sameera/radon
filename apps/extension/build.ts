// Run from the repo root: node apps/extension/build.ts
import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";

const out: string = "dist/apps/extension";

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await build({
    entryPoints: ["apps/extension/src/content.ts"],
    bundle: true,
    format: "iife",
    target: "chrome120",
    tsconfig: "apps/extension/tsconfig.json",
    outfile: `${out}/content.js`,
});
await cp("apps/extension/manifest.json", `${out}/manifest.json`);
await cp("docs/assets/raiden.png", `${out}/raiden.png`);
