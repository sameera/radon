import { describe, expect, it, vi } from "vitest";
import { extensionGateway } from "./gateway.ts";

describe("extension gateway", () => {
    it("passes the request to the background worker and returns its answer", async () => {
        const send = vi.fn(async () => ({ ok: true, status: 200, body: { n: 1 } }));
        const out = await extensionGateway(send).request({ path: "/user" });
        expect(send).toHaveBeenCalledWith({ type: "raiden/github", request: { path: "/user" } });
        expect(out).toEqual({ ok: true, status: 200, body: { n: 1 } });
    });
    it("keeps a failure kind from the worker", async () => {
        const out = await extensionGateway(async () => ({ ok: false, kind: "sign-in-needed" })).request({ path: "/user" });
        expect(out).toEqual({ ok: false, kind: "sign-in-needed" });
    });
    it("reports an unreadable answer or a missing worker as another failure", async () => {
        expect(await extensionGateway(async () => ({ error: "refused" })).request({ path: "/u" })).toEqual({ ok: false, kind: "other" });
        expect(await extensionGateway(async () => undefined).request({ path: "/u" })).toEqual({ ok: false, kind: "other" });
        const broken = extensionGateway(async () => {
            throw new Error("no worker");
        });
        expect(await broken.request({ path: "/u" })).toEqual({ ok: false, kind: "other" });
    });
    it("keeps the backend's named cause, and drops an unknown one (story #85)", async () => {
        const named = await extensionGateway(async () => ({ ok: false, kind: "permission", reason: "project-unreadable" })).request({ path: "/x" });
        expect(named).toEqual({ ok: false, kind: "permission", reason: "project-unreadable" });
        const unknown = await extensionGateway(async () => ({ ok: false, kind: "permission", reason: "anything" })).request({ path: "/x" });
        expect(unknown).toEqual({ ok: false, kind: "permission" });
    });
});
