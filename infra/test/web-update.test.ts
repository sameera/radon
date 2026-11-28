// Story #100: build the web view against the deployment and upload it (D9, D10 path, G9, G16, G20).
import { describe, expect, it } from "vitest";
import { runWebUpdate } from "../src/update-web.ts";
import { WEB_STACK } from "../src/names.ts";
import { fakeWeb } from "./fakes.ts";

describe("web view build and upload", () => {
    it("deploys only the web hosting stack, never the backend (G16)", async () => {
        const { deps, calls } = fakeWeb();
        await runWebUpdate(deps);
        expect(calls.filter((c) => c.startsWith("deploy"))).toEqual([`deploy ${WEB_STACK}`]);
    });

    it("builds with exactly the deployment's three values (D9, G19)", async () => {
        const { deps, calls } = fakeWeb();
        await runWebUpdate(deps);
        const build: string = calls.find((c) => c.startsWith("build "))!;
        expect(JSON.parse(build.slice(6))).toEqual({
            RAIDEN_BACKEND_URL: "https://abc.lambda-url.us-east-1.on.aws/",
            RAIDEN_WEB_RETURN_URL: "https://d1.cloudfront.net/",
            RAIDEN_GITHUB_CLIENT_ID: "Iv1.abc",
        });
    });

    it("never reads the client secret store (G9)", async () => {
        const { deps, calls } = fakeWeb();
        await runWebUpdate(deps);
        expect(calls.filter((c) => c.startsWith("read"))).toEqual(["read arn:settings"]);
    });

    it("refuses to build or upload when no client ID is set (G20)", async () => {
        const { deps, calls } = fakeWeb({}, null);
        await expect(runWebUpdate(deps)).rejects.toThrow(/client ID/);
        expect(calls.some((c) => c.startsWith("build") || c.startsWith("put"))).toBe(false);
    });

    it("uploads only the changed files with their content types (G21)", async () => {
        const { deps, calls } = fakeWeb();
        await runWebUpdate(deps);
        expect(calls.filter((c) => c.startsWith("put"))).toEqual(["put bucket index.html text/html; charset=utf-8"]);
    });

    it("fails when the backend is not deployed", async () => {
        const { deps } = fakeWeb({ outputs: async () => null });
        await expect(runWebUpdate(deps)).rejects.toThrow(/aws:setup/);
    });
});
