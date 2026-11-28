// The real AWS calls the commands make. Only the commands import this file; the stacks and the
// tests never do (G3).
import { CloudFormationClient, DescribeStacksCommand } from "@aws-sdk/client-cloudformation";
import { BOOTSTRAP_STACK } from "./names.ts";
import type { Outputs } from "./setup.ts";

const cfn: CloudFormationClient = new CloudFormationClient({});

// The stack's outputs, or null when the stack does not exist.
export async function stackOutputs(stack: string): Promise<Outputs | null> {
    try {
        const res = await cfn.send(new DescribeStacksCommand({ StackName: stack }));
        const s = res.Stacks?.[0];
        if (!s || s.StackStatus === "DELETE_COMPLETE") {
            return null;
        }
        const out: Outputs = {};
        for (const o of s.Outputs ?? []) {
            if (o.OutputKey && o.OutputValue !== undefined) {
                out[o.OutputKey] = o.OutputValue;
            }
        }
        return out;
    } catch (err) {
        if (err instanceof Error && /does not exist/.test(err.message)) {
            return null;
        }
        throw err;
    }
}

export async function bootstrapExists(): Promise<boolean> {
    return (await stackOutputs(BOOTSTRAP_STACK)) !== null;
}

// A new or recycled function can take a few seconds to start, so health is retried briefly.
export async function healthOk(backendUrl: string, attempts: number = 6): Promise<boolean> {
    const url: string = new URL("health", backendUrl).toString();
    for (let i = 0; i < attempts; i++) {
        try {
            const res: Response = await fetch(url);
            if (res.ok && ((await res.json()) as { status?: string }).status === "ok") {
                return true;
            }
        } catch {
            // Not reachable yet; retry.
        }
        await new Promise((r) => setTimeout(r, 5000));
    }
    return false;
}
