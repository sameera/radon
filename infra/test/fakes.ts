// A fake deployment for the web view update and setup tests. It records every AWS call.
import type { WebDeps } from "../src/update-web.ts";
import { BACKEND_STACK } from "../src/names.ts";
import type { Outputs } from "../src/setup.ts";

export function fakeWeb(over: Partial<WebDeps> = {}, settings: string | null = '{"clientId":"Iv1.abc"}') {
    const calls: string[] = [];
    const lines: string[] = [];
    const deps: WebDeps = {
        deploy: async (stack: string) => {
            calls.push(`deploy ${stack}`);
        },
        outputs: async (stack: string): Promise<Outputs | null> => {
            if (stack === BACKEND_STACK) {
                return {
                    BackendUrl: "https://abc.lambda-url.us-east-1.on.aws/",
                    SignInSettingsArn: "arn:settings",
                    ClientSecretArn: "arn:secret",
                    FunctionName: "raiden-backend",
                };
            }
            return { WebViewUrl: "https://d1.cloudfront.net/", BucketName: "bucket", DistributionId: "E1" };
        },
        readSecret: async (id: string) => {
            calls.push(`read ${id}`);
            return settings;
        },
        buildWeb: async (env: Record<string, string>) => {
            calls.push(`build ${JSON.stringify(env)}`);
            return "dist/apps/web";
        },
        listLocal: async () => [
            { key: "index.html", md5: "1", path: "dist/apps/web/index.html" },
            { key: "main.js", md5: "2", path: "dist/apps/web/main.js" },
        ],
        listRemote: async () => new Map([["main.js", "2"]]),
        putObject: async (bucket: string, file: { key: string }, type: string) => {
            calls.push(`put ${bucket} ${file.key} ${type}`);
        },
        log: (line: string) => {
            lines.push(line);
        },
        ...over,
    };
    return { deps, calls, lines };
}
