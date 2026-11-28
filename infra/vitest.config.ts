import { defineConfig } from "vitest/config";

// The infrastructure tests synthesize templates and run local builds. None of them needs AWS
// credentials or calls AWS (G3).
export default defineConfig({
    test: { environment: "node", testTimeout: 120_000 },
});
