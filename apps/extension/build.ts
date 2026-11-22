// Run from the repo root: node apps/extension/build.ts
import { build } from "esbuild";
import { execSync } from "node:child_process";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";

const out: string = "dist/apps/extension";

function git(args: string): string {
    return execSync(`git ${args}`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

// Chrome's `version` allows only integers, so the build number is the count of first-parent
// commits on HEAD: it rises by one per merge to main. `version_name` is free text and is what
// chrome://extensions shows; it carries the commit, the latest merged PR, and a dirty flag.
// Without git (e.g. a source tarball) the manifest's own version is kept.
async function stampedManifest(): Promise<Record<string, unknown>> {
    const manifest = JSON.parse(await readFile("apps/extension/manifest.json", "utf8"));
    let build: string;
    let sha: string;
    let dirty: boolean;
    let subjects: string;
    try {
        build = git("rev-list --count --first-parent HEAD");
        sha = git("rev-parse --short HEAD");
        dirty = git("status --porcelain") !== "";
        subjects = git("log --first-parent --format=%s -n 200");
    } catch {
        return manifest;
    }
    const [major, minor] = String(manifest.version).split(".");
    const version = `${major ?? 0}.${minor ?? 0}.${build}`;
    // Merge commits read "Merge pull request #N"; squash merges end with "(#N)".
    const pr = /Merge pull request #(\d+)|\(#(\d+)\)$/m.exec(subjects);
    const prNumber = pr?.[1] ?? pr?.[2];
    const details = [`${sha}${dirty ? "-dirty" : ""}`, prNumber ? `PR #${prNumber}` : null].filter(Boolean);
    return { ...manifest, version, version_name: `${version} (${details.join(", ")})` };
}

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
await writeFile(`${out}/manifest.json`, JSON.stringify(await stampedManifest(), null, 4) + "\n");
await cp("libs/design-system/fonts", `${out}/fonts`, { recursive: true });
await cp("docs/assets/raiden-128x.png", `${out}/raiden-128x.png`);
