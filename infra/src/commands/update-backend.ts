// `pnpm aws:update-backend` — deploys changed backend code. Stored data is never replaced (G13).
import { healthOk, stackOutputs } from "../aws.ts";
import { deployArgs, runCdk } from "../cdk.ts";
import { runBackendUpdate } from "../update-backend.ts";

try {
    await runBackendUpdate({
        deploy: (stack: string) => runCdk(deployArgs(stack)),
        outputs: stackOutputs,
        health: (url: string) => healthOk(url),
        log: (line: string) => console.log(line),
    });
} catch (err) {
    console.error(`Backend update failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
}
