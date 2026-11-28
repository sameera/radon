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
import {
    CloudFrontClient,
    CreateInvalidationCommand,
    ListInvalidationsCommand,
    waitUntilInvalidationCompleted,
} from "@aws-sdk/client-cloudfront";
import { DeleteObjectsCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
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

// When the newest stored file was written, or null for an empty bucket.
export async function newestObject(bucket: string): Promise<Date | null> {
    let newest: Date | null = null;
    let token: string | undefined;
    do {
        const res = await s3.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }));
        for (const o of res.Contents ?? []) {
            if (o.LastModified && (!newest || o.LastModified > newest)) {
                newest = o.LastModified;
            }
        }
        token = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (token);
    return newest;
}

export async function putObject(
    bucket: string,
    file: LocalFile,
    headers: { contentType: string; cacheControl: string },
): Promise<void> {
    await s3.send(
        new PutObjectCommand({
            Bucket: bucket,
            Key: file.key,
            Body: await readFile(file.path),
            ContentType: headers.contentType,
            CacheControl: headers.cacheControl,
        }),
    );
}

export async function deleteObjects(bucket: string, keys: string[]): Promise<void> {
    for (let i = 0; i < keys.length; i += 1000) {
        const batch: string[] = keys.slice(i, i + 1000);
        await s3.send(
            new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: batch.map((Key: string) => ({ Key })) } }),
        );
    }
}

const cloudfront: CloudFrontClient = new CloudFrontClient({});

// One invalidation for every path, which counts as one path in the free monthly allowance (D10).
export async function invalidateAll(distributionId: string): Promise<void> {
    const res = await cloudfront.send(
        new CreateInvalidationCommand({
            DistributionId: distributionId,
            InvalidationBatch: { CallerReference: `raiden-${Date.now()}`, Paths: { Quantity: 1, Items: ["/*"] } },
        }),
    );
    await waitUntilInvalidationCompleted(
        { client: cloudfront, maxWaitTime: 900 },
        { DistributionId: distributionId, Id: res.Invalidation!.Id! },
    );
}

// When the newest completed invalidation was created, or null when none completed.
export async function lastInvalidated(distributionId: string): Promise<Date | null> {
    let last: Date | null = null;
    let marker: string | undefined;
    do {
        const res = await cloudfront.send(new ListInvalidationsCommand({ DistributionId: distributionId, Marker: marker }));
        for (const i of res.InvalidationList?.Items ?? []) {
            if (i.Status === "Completed" && i.CreateTime && (!last || i.CreateTime > last)) {
                last = i.CreateTime;
            }
        }
        marker = res.InvalidationList?.IsTruncated ? res.InvalidationList.NextMarker : undefined;
    } while (marker);
    return last;
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
