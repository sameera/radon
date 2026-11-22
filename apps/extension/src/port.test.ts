import { describe, expect, it, vi } from "vitest";
import { extensionSignInPort } from "./port.ts";

describe("extension sign-in port", () => {
    it("asks the worker for status and sign-in and keeps only the username", async () => {
        const send = vi.fn(async (m: { type: string }) => (m.type === "raiden/status" ? { login: "octo" } : { login: null }));
        const port = extensionSignInPort(send);
        expect(await port.status()).toBe("octo");
        expect(await port.signIn()).toBeNull();
        expect(send.mock.calls.map((c) => c[0])).toEqual([{ type: "raiden/status" }, { type: "raiden/sign-in" }]);
    });
    it("reads a refused or missing answer as signed out", async () => {
        const port = extensionSignInPort(async () => ({ error: "refused" }));
        expect(await port.status()).toBeNull();
        expect(await port.signIn()).toBeNull();
        expect(await extensionSignInPort(async () => undefined).status()).toBeNull();
    });
    it("reads a sign-in that ends in an error as signed out", async () => {
        const port = extensionSignInPort(async () => {
            throw new Error("no worker");
        });
        expect(await port.signIn()).toBeNull();
    });
    it("returns the username of a finished sign-in", async () => {
        expect(await extensionSignInPort(async () => ({ login: "octo" })).signIn()).toEqual({ login: "octo" });
    });
});
