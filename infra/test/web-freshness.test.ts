// Story #101: the web view update serves the new files at once, and no browser keeps a stale
// service worker or manifest (D10, D11, D13, G2, G16, G23, G24, G25).
import { readFileSync } from "node:fs";
import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { planUpload } from "../src/upload.ts";
import { runWebUpdate } from "../src/update-web.ts";
import { WebStack } from "../src/web-stack.ts";
import { WEB_STACK } from "../src/names.ts";
import { fakeWeb } from "./fakes.ts";

const files = [
    { key: "index.html", md5: "1", path: "dist/apps/web/index.html" },
    { key: "main.js", md5: "2", path: "dist/apps/web/main.js" },
    { key: "sw.js", md5: "3", path: "dist/apps/web/sw.js" },
    { key: "manifest.webmanifest", md5: "4", path: "dist/apps/web/manifest.webmanifest" },
];

describe("upload plan", () => {
    it("deletes stored files the new build no longer has", () => {
        const plan = planUpload(files, new Map([["old.js", "x"], ["main.js", "2"]]));
        expect(plan.deletes).toEqual(["old.js"]);
    });

    it("deletes nothing when nothing was removed", () => {
        expect(planUpload(files, new Map([["main.js", "2"]])).deletes).toEqual([]);
    });
});

describe("web view update", () => {
    it("tells the browser to revalidate every file, the service worker and manifest included (D11, G24)", async () => {
        const { deps, calls } = fakeWeb({ listLocal: async () => files, listRemote: async () => new Map() });
        await runWebUpdate(deps);
        const headers: string[] = calls.filter((c) => c.startsWith("cache-control"));
        expect(headers).toHaveLength(files.length);
        for (const h of headers) {
            expect(h).toMatch(/ no-cache$/);
        }
    });

    it("uploads the page last, deletes removed files after it, then invalidates (G23, G25)", async () => {
        const { deps, calls } = fakeWeb({
            listLocal: async () => files,
            listRemote: async () => new Map([["old.js", "x"]]),
        });
        await runWebUpdate(deps);
        const steps: string[] = calls.filter((c) => /^(put|delete|invalidate)/.test(c));
        expect(steps).toEqual([
            "put bucket main.js text/javascript; charset=utf-8",
            "put bucket sw.js text/javascript; charset=utf-8",
            "put bucket manifest.webmanifest application/manifest+json",
            "put bucket index.html text/html; charset=utf-8",
            "delete bucket old.js",
            "invalidate E1",
        ]);
    });

    it("waits for the invalidation before it reports success (G23)", async () => {
        let done: boolean = false;
        const { deps } = fakeWeb({
            invalidate: async () => {
                await new Promise((r) => setTimeout(r, 10));
                done = true;
            },
        });
        await runWebUpdate(deps);
        expect(done).toBe(true);
    });

    it("uploads, deletes and invalidates nothing when nothing changed (G2)", async () => {
        const { deps, calls } = fakeWeb({
            listLocal: async () => files,
            listRemote: async () => new Map(files.map((f) => [f.key, f.md5])),
        });
        await runWebUpdate(deps);
        expect(calls.some((c) => /^(put|delete|invalidate)/.test(c))).toBe(false);
    });

    it("clears the cache on a retry after the uploads landed but the invalidation failed (G23)", async () => {
        const { deps, calls } = fakeWeb({
            listLocal: async () => files,
            listRemote: async () => new Map(files.map((f) => [f.key, f.md5])),
            newestObject: async () => new Date("2026-03-02T00:00:00Z"),
            lastInvalidated: async () => new Date("2026-03-01T00:00:00Z"),
        });
        await runWebUpdate(deps);
        expect(calls.filter((c) => /^(put|delete|invalidate)/.test(c))).toEqual(["invalidate E1"]);
    });

    it("clears the cache when stored files were never invalidated (G23)", async () => {
        const { deps, calls } = fakeWeb({
            listLocal: async () => files,
            listRemote: async () => new Map(files.map((f) => [f.key, f.md5])),
            lastInvalidated: async () => null,
        });
        await runWebUpdate(deps);
        expect(calls.filter((c) => /^(put|delete|invalidate)/.test(c))).toEqual(["invalidate E1"]);
    });

    it("invalidates when a file was only removed", async () => {
        const { deps, calls } = fakeWeb({
            listLocal: async () => files,
            listRemote: async () => new Map([...files.map((f): [string, string] => [f.key, f.md5]), ["old.js", "x"]]),
        });
        await runWebUpdate(deps);
        expect(calls.filter((c) => /^(delete|invalidate)/.test(c))).toEqual(["delete bucket old.js", "invalidate E1"]);
    });

    it("never reaches the backend: no backend deploy and no secret store but the settings store (G9, G16)", async () => {
        const { deps, calls } = fakeWeb();
        await runWebUpdate(deps);
        expect(calls.filter((c) => c.startsWith("deploy"))).toEqual([`deploy ${WEB_STACK}`]);
        expect(calls.filter((c) => c.startsWith("read"))).toEqual(["read arn:settings"]);
    });
});

describe("edge caching", () => {
    const template: Template = Template.fromStack(new WebStack(new App(), WEB_STACK));

    it("keeps files at the edge until the deploy's invalidation (D11)", () => {
        const policies = Object.values(template.findResources("AWS::CloudFront::CachePolicy")) as any[];
        expect(policies).toHaveLength(1);
        const config = policies[0].Properties.CachePolicyConfig;
        expect(config.MinTTL).toBeGreaterThanOrEqual(365 * 24 * 3600);
        expect(config.ParametersInCacheKeyAndForwardedToOrigin.QueryStringsConfig.QueryStringBehavior).toBe("none");
    });

    it("leaves the files' own cache header for the browser", () => {
        template.resourceCountIs("AWS::CloudFront::ResponseHeadersPolicy", 0);
    });
});

describe("web view update command", () => {
    const project = JSON.parse(readFileSync("infra/project.json", "utf8"));
    const root = JSON.parse(readFileSync("package.json", "utf8"));

    it("is one root command running a target that is never cached and needs no backend build (D13, G16)", () => {
        expect(root.scripts["aws:update-web"]).toBe("nx run infra:update-web");
        const target = project.targets["update-web"];
        expect(target.cache).toBe(false);
        expect(JSON.stringify(target.dependsOn ?? [])).not.toContain("backend");
    });
});
