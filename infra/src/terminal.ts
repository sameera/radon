// Terminal prompts for the settings command. On a terminal the secret prompt echoes nothing;
// when standard input is piped, each answer is read from it a line at a time (G8).
import { createInterface, type Interface } from "node:readline";

export interface Terminal {
    ask(question: string, suggested?: string): Promise<string>;
    askSecret(question: string): Promise<string>;
    close(): void;
}

export function openTerminal(): Terminal {
    let muted: boolean = false;
    const rl: Interface = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
    // readline echoes typed characters through this method; while muted, it writes nothing.
    const internal = rl as unknown as { _writeToOutput: (s: string) => void };
    const write = internal._writeToOutput.bind(rl);
    internal._writeToOutput = (s: string): void => {
        if (!muted) {
            write(s);
        }
    };
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
            process.stdout.write(`${q}: `);
            muted = true;
            try {
                return await question("");
            } finally {
                muted = false;
                if (process.stdin.isTTY) {
                    process.stdout.write("\n");
                }
            }
        },
        close: () => rl.close(),
    };
}
