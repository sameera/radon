// The web view update: deploy the web hosting stack, build the web view against the deployment,
// and upload the changed files (D2, D9, D10). Setup runs the same path once settings exist.
import { BACKEND_STACK, WEB_STACK } from "./names.ts";
import type { Outputs } from "./setup.ts";
import { CACHE_CONTROL, contentType, planUpload, type LocalFile } from "./upload.ts";
import { readClientId, webBuildEnv } from "./web-build.ts";

export interface WebDeps {
    deploy(stack: string): Promise<void>;
    outputs(stack: string): Promise<Outputs | null>;
    readSecret(id: string): Promise<string | null>;
    // Runs the existing web view build with these values in its environment; returns its folder.
    buildWeb(env: Record<string, string>): Promise<string>;
    listLocal(dir: string): Promise<LocalFile[]>;
    // Each stored key with the MD5 of its content.
    listRemote(bucket: string): Promise<Map<string, string>>;
    putObject(bucket: string, file: LocalFile, headers: { contentType: string; cacheControl: string }): Promise<void>;
    deleteObjects(bucket: string, keys: string[]): Promise<void>;
    // When the newest stored file was written, or null for an empty bucket.
    newestObject(bucket: string): Promise<Date | null>;
    // When the newest completed invalidation was created, or null when none completed.
    lastInvalidated(distributionId: string): Promise<Date | null>;
    // Sends one invalidation for every path and waits until it completes (D10).
    invalidate(distributionId: string): Promise<void>;
    log(line: string): void;
}

export interface WebUpdateResult {
    webViewUrl: string;
    uploaded: number;
    deleted: number;
}

// Deploys the web hosting stack (a no-op when nothing changed) and returns its outputs.
export async function deployWebStack(deps: Pick<WebDeps, "deploy" | "outputs">): Promise<Outputs> {
    await deps.deploy(WEB_STACK);
    const web: Outputs | null = await deps.outputs(WEB_STACK);
    if (!web?.WebViewUrl || !web.BucketName || !web.DistributionId) {
        throw new Error(`stack ${WEB_STACK} is missing its outputs`);
    }
    return web;
}

export async function runWebUpdate(deps: WebDeps): Promise<WebUpdateResult> {
    const backend: Outputs | null = await deps.outputs(BACKEND_STACK);
    if (!backend?.BackendUrl || !backend.SignInSettingsArn) {
        throw new Error("the backend is not deployed; run pnpm aws:setup first");
    }
    const web: Outputs = await deployWebStack(deps);
    return uploadWebView(deps, backend, web);
}

export async function uploadWebView(deps: WebDeps, backend: Outputs, web: Outputs): Promise<WebUpdateResult> {
    const clientId: string | null = await readClientId(deps.readSecret, backend);
    const env: Record<string, string> = webBuildEnv(backend.BackendUrl!, web.WebViewUrl!, clientId);
    const dir: string = await deps.buildWeb(env);
    const local: LocalFile[] = await deps.listLocal(dir);
    // Every type is checked before the first upload, so a bad file uploads nothing.
    const types: Map<string, string> = new Map(local.map((f) => [f.key, contentType(f.key)]));
    const plan = planUpload(local, await deps.listRemote(web.BucketName!));
    for (const f of plan.uploads) {
        await deps.putObject(web.BucketName!, f, { contentType: types.get(f.key)!, cacheControl: CACHE_CONTROL });
    }
    if (plan.deletes.length) {
        await deps.deleteObjects(web.BucketName!, plan.deletes);
    }
    // Only a change is invalidated, so a repeated run clears no cache (G2). A file stored after the
    // last completed invalidation is also a change the edge has not seen: a run that uploaded and
    // then failed at the invalidation gets it on the retry. The command reports success only once
    // the edge serves the new files (G23).
    if (plan.uploads.length || plan.deletes.length) {
        deps.log(`Uploaded ${plan.uploads.length} and removed ${plan.deletes.length} file(s). Clearing the CloudFront cache...`);
        await deps.invalidate(web.DistributionId!);
    } else if (await edgeBehind(deps, web)) {
        deps.log("The stored files are newer than the last cache clear. Clearing the CloudFront cache...");
        await deps.invalidate(web.DistributionId!);
    } else {
        deps.log("The web view is unchanged.");
    }
    return { webViewUrl: web.WebViewUrl!, uploaded: plan.uploads.length, deleted: plan.deletes.length };
}

async function edgeBehind(deps: WebDeps, web: Outputs): Promise<boolean> {
    const newest: Date | null = await deps.newestObject(web.BucketName!);
    if (!newest) {
        return false;
    }
    const cleared: Date | null = await deps.lastInvalidated(web.DistributionId!);
    return !cleared || newest.getTime() > cleared.getTime();
}
