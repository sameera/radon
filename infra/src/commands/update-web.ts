// `pnpm aws:update-web` — builds the web view against the deployment and uploads it. It never
// touches the backend, its code or its settings (G16), and never reads the client secret (G9).
import { buildWeb, deleteObjects, invalidateAll, listLocal, listRemote, putObject, readSecret, stackOutputs } from "../aws.ts";
import { deployArgs, runCdk } from "../cdk.ts";
import { runWebUpdate } from "../update-web.ts";

try {
    const result = await runWebUpdate({
        deploy: (stack: string) => runCdk(deployArgs(stack)),
        outputs: stackOutputs,
        readSecret,
        buildWeb,
        listLocal,
        listRemote,
        putObject,
        deleteObjects,
        invalidate: invalidateAll,
        log: (line: string) => console.log(line),
    });
    console.log(`Web view address: ${result.webViewUrl}`);
} catch (err) {
    console.error(`Web view update failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
}
