import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { teamManifest } from "./team.ts";

const base: Record<string, unknown> = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));

describe("extension manifest", () => {
    it("gains only the identity permission and a background worker (G12)", () => {
        expect(base.permissions).toEqual(["storage", "identity"]);
        expect(base.host_permissions).toBeUndefined();
        expect(base.background).toEqual({ service_worker: "background.js" });
    });
    it("keeps the same small content script on github.com only (G25)", () => {
        expect(base.content_scripts).toEqual([{ matches: ["https://github.com/*"], js: ["content.js"], run_at: "document_idle" }]);
    });
    it("adds one host permission for the team's backend and the fixed key from the team settings (D10)", () => {
        const m = teamManifest(base, { backendUrl: "https://api.team.example/prod", extensionKey: "KEY" });
        expect(m.host_permissions).toEqual(["https://api.team.example/*"]);
        expect(m.key).toBe("KEY");
        expect(m.permissions).toEqual(["storage", "identity"]);
    });
    it("adds nothing when no team settings are given", () => {
        const m = teamManifest(base, { backendUrl: "", extensionKey: "" });
        expect(m.host_permissions).toBeUndefined();
        expect(m.key).toBeUndefined();
    });
});
