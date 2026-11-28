// Story #100: the web view build gets its three settings from the deployment (D9, G9, G19, G20).
import { describe, expect, it } from "vitest";
import { readClientId, webBuildEnv } from "../src/web-build.ts";

describe("web build settings", () => {
    it("passes exactly the backend address, the web view address and the client ID", () => {
        expect(webBuildEnv("https://abc.lambda-url.us-east-1.on.aws/", "https://d1.cloudfront.net/", "Iv1.abc")).toEqual({
            RAIDEN_BACKEND_URL: "https://abc.lambda-url.us-east-1.on.aws/",
            RAIDEN_WEB_RETURN_URL: "https://d1.cloudfront.net/",
            RAIDEN_GITHUB_CLIENT_ID: "Iv1.abc",
        });
    });

    it("refuses to build when no client ID is set (G20)", () => {
        expect(() => webBuildEnv("https://b/", "https://w/", "")).toThrow(/client ID/);
        expect(() => webBuildEnv("https://b/", "https://w/", null)).toThrow(/aws:settings/);
    });

    it("reads the client ID from the sign-in settings store only, never the client secret store (G9)", async () => {
        const reads: string[] = [];
        const id = await readClientId(
            async (store: string) => {
                reads.push(store);
                return JSON.stringify({ clientId: "Iv1.abc", allowedRedirects: [], allowedOrigins: [] });
            },
            { SignInSettingsArn: "arn:settings", ClientSecretArn: "arn:secret" },
        );
        expect(id).toBe("Iv1.abc");
        expect(reads).toEqual(["arn:settings"]);
    });

    it("finds no client ID in an empty store", async () => {
        expect(await readClientId(async () => null, { SignInSettingsArn: "arn:settings" })).toBeNull();
    });
});
