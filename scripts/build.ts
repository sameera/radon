import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await build({
    entryPoints: ["src/content.ts"],
    bundle: true,
    format: "iife",
    target: "chrome120",
    outfile: "dist/content.js",
});
await cp("extension/manifest.json", "dist/manifest.json");
await cp("docs/assets/radon-icon.png", "dist/radon-icon.png");
