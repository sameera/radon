// Terminal prompts for the settings command. On a terminal the secret prompt echoes nothing;
// when standard input is piped, each answer is read from it a line at a time (G8).
import { createInterface, type Interface } from "node:readline";

export interface Terminal {
    ask(question: string, suggested?: string): Promise<string>;
    askSecret(question: string): Promise<string>;
    close(): void;
}

export function openTerminal(): Terminal {
    // While a secret is typed, this holds its prompt; null otherwise.
    let mutedPrompt: string | null = null;
    const rl: Interface = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
    // readline echoes typed characters through this method. While muted it writes only the prompt:
    // a redraw (after a backspace, say) clears the line and writes prompt and answer in one call,
    // so the prompt stays on screen and the answer never appears.
    const internal = rl as unknown as { _writeToOutput: (s: string) => void };
    const write = internal._writeToOutput.bind(rl);
    internal._writeToOutput = (s: string): void => {
        if (mutedPrompt === null) {
            write(s);
        } else if (s.startsWith(mutedPrompt)) {
            write(mutedPrompt);
        }
    };
    // Ctrl+C at a prompt cancels the command. Without this listener readline only pauses, and
    // Node exits with a warning about an unsettled await.
    rl.on("SIGINT", () => {
        process.stdout.write("\nCancelled. Nothing was stored.\n");
        rl.close();
        process.exit(130);
    });
    const lines: AsyncIterator<string> = rl[Symbol.asyncIterator]();
    const question = async (prompt: string): Promise<string> => {
        if (process.stdin.isTTY) {
            return new Promise((resolve) => rl.question(prompt, resolve));
        }
        process.stdout.write(prompt);
        const next = await lines.next();
        process.stdout.write("\n");
        return next.done ? "" : next.value;
    };
    return {
        ask: async (q: string, suggested?: string): Promise<string> => {
            const answer: string = await question(suggested ? `${q} [${suggested}]: ` : `${q}: `);
            return answer.trim() || suggested || "";
        },
        askSecret: async (q: string): Promise<string> => {
            const prompt: string = `${q}: `;
            mutedPrompt = prompt;
            try {
                return await question(prompt);
            } finally {
                mutedPrompt = null;
                if (process.stdin.isTTY) {
                    process.stdout.write("\n");
                }
            }
        },
        close: () => rl.close(),
    };
}
