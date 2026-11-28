// `pnpm aws:settings` — gives the deployed backend its GitHub App settings. It takes no arguments
// and writes nothing to disk; the client secret comes from a hidden prompt or standard input (G8).
import { healthOk, putSecret, recycleFunction, stackOutputs } from "../aws.ts";
import { assertNoArguments, runSettings } from "../settings.ts";
import { openTerminal, type Terminal } from "../terminal.ts";

let term: Terminal | null = null;
try {
    assertNoArguments(process.argv.slice(2));
    term = openTerminal();
    await runSettings({
        outputs: stackOutputs,
        ask: term.ask,
        askSecret: term.askSecret,
        putSecret,
        recycle: recycleFunction,
        health: (url: string) => healthOk(url),
        now: () => new Date().toISOString(),
        log: (line: string) => console.log(line),
    });
} catch (err) {
    console.error(`Settings failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
} finally {
    term?.close();
}
