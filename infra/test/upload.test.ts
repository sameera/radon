// Story #100: the first upload of the web view (D10 path, G21).
import { describe, expect, it } from "vitest";
import { contentType, planUpload } from "../src/upload.ts";

describe("content types", () => {
    it("gives every file of the web view build its type, so Chrome offers to install it (G21)", () => {
        expect(contentType("index.html")).toBe("text/html; charset=utf-8");
        expect(contentType("offline.html")).toBe("text/html; charset=utf-8");
        expect(contentType("main.js")).toBe("text/javascript; charset=utf-8");
        expect(contentType("sw.js")).toBe("text/javascript; charset=utf-8");
        expect(contentType("manifest.webmanifest")).toBe("application/manifest+json");
        expect(contentType("raiden-192x.png")).toBe("image/png");
        expect(contentType("fonts/bricolage-grotesque.woff2")).toBe("font/woff2");
    });

    it("refuses a file it has no type for, instead of serving it wrong", () => {
        expect(() => contentType("notes.xyz")).toThrow(/content type/);
    });
});

describe("upload plan", () => {
    const local = [
        { key: "index.html", md5: "1" },
        { key: "main.js", md5: "2" },
        { key: "raiden.png", md5: "3" },
    ];

    it("uploads every file to an empty bucket, the page last", () => {
        const plan = planUpload(local, new Map());
        expect(plan.uploads.map((f) => f.key)).toEqual(["main.js", "raiden.png", "index.html"]);
    });

    it("uploads only the files whose content changed", () => {
        const plan = planUpload(local, new Map([["index.html", "1"], ["main.js", "old"], ["raiden.png", "3"]]));
        expect(plan.uploads.map((f) => f.key)).toEqual(["main.js"]);
    });

    it("uploads nothing when nothing changed (G2)", () => {
        const plan = planUpload(local, new Map([["index.html", "1"], ["main.js", "2"], ["raiden.png", "3"]]));
        expect(plan.uploads).toEqual([]);
    });
});
