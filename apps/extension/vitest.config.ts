import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const lib = (path: string): string => fileURLToPath(new URL(`../../libs/${path}`, import.meta.url));

export default defineConfig({
    esbuild: { jsx: "automatic", jsxImportSource: "preact" },
    resolve: {
        alias: [
            { find: /^@raiden\/shared$/, replacement: lib("shared/src/index.ts") },
            { find: /^@raiden\/app$/, replacement: lib("app/src/index.ts") },
            { find: /^@raiden\/app\/(.*)$/, replacement: lib("app/src/$1") },
        ],
    },
    test: { environment: "node" },
});
