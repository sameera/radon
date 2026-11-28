// Story #98: the settings command (D6, D7, G7, G8, G10).
import { describe, expect, it } from "vitest";
import { assertNoArguments, runSettings, suggestAddresses, type SettingsDeps } from "../src/settings.ts";
import { BACKEND_STACK, WEB_STACK } from "../src/names.ts";
import type { Outputs } from "../src/setup.ts";

const SECRET: string = "0123456789abcdef-secret";

function fake(answers: Record<string, string>, over: Partial<SettingsDeps> = {}) {
    const calls: string[] = [];
    const lines: string[] = [];
    const writes: Record<string, string> = {};
    const deps: SettingsDeps = {
        outputs: async (stack: string): Promise<Outputs | null> =>
            stack === BACKEND_STACK
                ? {
                      BackendUrl: "https://abc.lambda-url.us-east-1.on.aws/",
                      FunctionName: "raiden-backend",
                      ClientSecretArn: "arn:secret",
                      SignInSettingsArn: "arn:settings",
                  }
                : stack === WEB_STACK
                  ? { WebViewUrl: "https://d1.cloudfront.net/" }
                  : null,
        ask: async (question: string, suggested?: string) => {
            const key: string | undefined = Object.keys(answers).find((k) => question.includes(k));
            const a: string = key ? answers[key]! : "";
            return a || suggested || "";
        },
        askSecret: async () => {
            calls.push("askSecret");
            return answers.secret ?? SECRET;
        },
        putSecret: async (id: string, value: string) => {
            calls.push(`put ${id}`);
            writes[id] = value;
        },
        recycle: async (fn: string, version: string) => {
            calls.push(`recycle ${fn} ${version}`);
        },
        health: async () => {
            calls.push("health");
            return true;
        },
        now: () => "2026-11-27T10:00:00.000Z",
        log: (line: string) => {
            lines.push(line);
        },
        ...over,
    };
    return { deps, calls, lines, writes };
}

describe("suggestAddresses", () => {
    it("derives origins and return addresses from the web view address and the extension ID", () => {
        expect(suggestAddresses("https://d1.cloudfront.net/", "abcdef")).toEqual({
            allowedRedirects: ["https://d1.cloudfront.net/", "https://abcdef.chromiumapp.org/"],
            allowedOrigins: ["https://d1.cloudfront.net", "chrome-extension://abcdef"],
        });
        expect(suggestAddresses(null, "")).toEqual({ allowedRedirects: [], allowedOrigins: [] });
    });
});

describe("settings command", () => {
    it("takes no command-line arguments, so the secret is never one (G8)", () => {
        expect(() => assertNoArguments(["--client-secret", SECRET])).toThrow();
        expect(() => assertNoArguments([SECRET])).toThrow();
        expect(() => assertNoArguments([])).not.toThrow();
    });

    it("writes the secret alone to its store and the rest to the sign-in settings store (D6)", async () => {
        const { deps, writes, calls } = fake({ "client ID": "Iv1.abc", "extension ID": "abcdef" });
        await runSettings(deps);
        expect(calls).toContain("askSecret");
        expect(writes["arn:secret"]).toBe(SECRET);
        expect(JSON.parse(writes["arn:settings"]!)).toEqual({
            clientId: "Iv1.abc",
            allowedRedirects: ["https://d1.cloudfront.net/", "https://abcdef.chromiumapp.org/"],
            allowedOrigins: ["https://d1.cloudfront.net", "chrome-extension://abcdef"],
        });
        expect(writes["arn:settings"]).not.toContain(SECRET);
    });

    it("recycles the function with a value that holds no secret, then checks health (D7, G10)", async () => {
        const { deps, calls } = fake({ "client ID": "Iv1.abc" });
        await runSettings(deps);
        const recycle: string = calls.find((c) => c.startsWith("recycle"))!;
        expect(recycle).toBe("recycle raiden-backend 2026-11-27T10:00:00.000Z");
        expect(calls.indexOf(recycle)).toBeGreaterThan(calls.indexOf("put arn:settings"));
        expect(calls.indexOf("health")).toBeGreaterThan(calls.indexOf(recycle));
    });

    it("never prints the secret (G7)", async () => {
        const { deps, lines } = fake({ "client ID": "Iv1.abc" });
        await runSettings(deps);
        expect(lines.join("\n")).not.toContain(SECRET);
    });

    it("refuses an empty client ID or secret and writes nothing", async () => {
        const cases: Record<string, string>[] = [{ "client ID": "" }, { "client ID": "Iv1.abc", secret: " " }];
        for (const answers of cases) {
            const { deps, calls } = fake(answers);
            await expect(runSettings(deps)).rejects.toThrow();
            expect(calls.some((c) => c.startsWith("put"))).toBe(false);
        }
    });

    it("fails when the backend is not deployed", async () => {
        const { deps } = fake({ "client ID": "Iv1.abc" }, { outputs: async () => null });
        await expect(runSettings(deps)).rejects.toThrow(/setup/);
    });

    it("fails when health is not ok after the recycle", async () => {
        const { deps } = fake({ "client ID": "Iv1.abc" }, { health: async () => false });
        await expect(runSettings(deps)).rejects.toThrow(/health/);
    });
});
