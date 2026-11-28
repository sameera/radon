import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
// The real AWS calls the commands make. Only the commands import this file; the stacks and the
// tests never do (G3).
import { CloudFormationClient, DescribeStacksCommand } from "@aws-sdk/client-cloudformation";
import {
    GetFunctionConfigurationCommand,
    LambdaClient,
    UpdateFunctionConfigurationCommand,
    waitUntilFunctionUpdatedV2,
} from "@aws-sdk/client-lambda";
import { ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { GetSecretValueCommand, PutSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { BOOTSTRAP_STACK } from "./names.ts";
import type { Outputs } from "./setup.ts";
import type { LocalFile } from "./upload.ts";

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

const secrets: SecretsManagerClient = new SecretsManagerClient({});
const lambda: LambdaClient = new LambdaClient({});

export async function putSecret(id: string, value: string): Promise<void> {
    await secrets.send(new PutSecretValueCommand({ SecretId: id, SecretString: value }));
}

// The value of a store, or null when it has none yet.
export async function readSecret(id: string): Promise<string | null> {
    try {
        const res = await secrets.send(new GetSecretValueCommand({ SecretId: id }));
        return res.SecretString ?? null;
    } catch (err) {
        if (err instanceof Error && err.name === "ResourceNotFoundException") {
            return null;
        }
        throw err;
    }
}

// Sets RAIDEN_SETTINGS_VERSION, which holds no secret, so Lambda starts fresh instances that read
// the stores again (D7). Every other configuration value is kept.
export async function recycleFunction(functionName: string, version: string): Promise<void> {
    const current = await lambda.send(new GetFunctionConfigurationCommand({ FunctionName: functionName }));
    await lambda.send(
        new UpdateFunctionConfigurationCommand({
            FunctionName: functionName,
            Environment: { Variables: { ...current.Environment?.Variables, RAIDEN_SETTINGS_VERSION: version } },
        }),
    );
    await waitUntilFunctionUpdatedV2({ client: lambda, maxWaitTime: 300 }, { FunctionName: functionName });
}

const s3: S3Client = new S3Client({});

// Each stored key with the MD5 of its content. A single-part upload's ETag is that MD5.
export async function listRemote(bucket: string): Promise<Map<string, string>> {
    const out: Map<string, string> = new Map();
    let token: string | undefined;
    do {
        const res = await s3.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }));
        for (const o of res.Contents ?? []) {
            if (o.Key && o.ETag) {
                out.set(o.Key, o.ETag.replaceAll('"', ""));
            }
        }
        token = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (token);
    return out;
}

export async function putObject(bucket: string, file: LocalFile, type: string): Promise<void> {
    await s3.send(
        new PutObjectCommand({ Bucket: bucket, Key: file.key, Body: await readFile(file.path), ContentType: type }),
    );
}

// Every file of a build folder, keyed by its path inside the folder.
export async function listLocal(dir: string): Promise<LocalFile[]> {
    const entries = await readdir(dir, { recursive: true, withFileTypes: true });
    const files: LocalFile[] = [];
    for (const e of entries.filter((e) => e.isFile())) {
        const path: string = join(e.parentPath, e.name);
        const md5: string = createHash("md5").update(await readFile(path)).digest("hex");
        files.push({ key: relative(dir, path).split(sep).join("/"), md5, path });
    }
    return files.sort((a, b) => a.key.localeCompare(b.key));
}

// Runs the existing web view build through Nx with the deployment's values in its environment.
// They win over any local settings file (D9).
export function buildWeb(env: Record<string, string>): Promise<string> {
    return new Promise((resolve, reject) => {
        const child = spawn("pnpm", ["exec", "nx", "run", "web:build"], {
            stdio: "inherit",
            env: { ...process.env, ...env },
        });
        child.on("error", reject);
        child.on("exit", (code: number | null) =>
            code === 0 ? resolve("dist/apps/web") : reject(new Error(`the web view build failed with exit code ${code}`)),
        );
    });
}
