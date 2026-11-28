// `pnpm aws:setup` — creates or updates the whole deployment. Running it again on an unchanged
// deployment changes nothing (G2).
import { bootstrapExists, buildWeb, healthOk, listLocal, listRemote, putObject, readSecret, stackOutputs } from "../aws.ts";
import { bootstrapArgs, deployArgs, runCdk } from "../cdk.ts";
import { runSetup } from "../setup.ts";

try {
    await runSetup({
        bootstrapExists,
        bootstrap: () => runCdk(bootstrapArgs()),
        deploy: (stack: string) => runCdk(deployArgs(stack)),
        outputs: stackOutputs,
        readSecret,
        buildWeb,
        listLocal,
        listRemote,
        putObject,
        health: (url: string) => healthOk(url),
        log: (line: string) => console.log(line),
    });
} catch (err) {
    console.error(`Setup failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
}
