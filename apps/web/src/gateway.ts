import { createGitHubClient, type GitHubClient, type TeamSettings } from "@raiden/shared";
import { webRecordStore } from "./signin.ts";

export interface WebGatewayDeps {
    settings: TeamSettings;
    local: Storage;
    fetch: typeof fetch;
}

// The web view runs the shared GitHub client in the page. The record comes from its own storage.
export function webGateway(deps: WebGatewayDeps): GitHubClient {
    const locks = globalThis.navigator?.locks;
    return createGitHubClient({
        settings: deps.settings,
        records: webRecordStore(deps.local),
        fetch: deps.fetch,
        withRefreshLock: locks ? (run) => locks.request("raiden:signin-refresh", run) : undefined,
    });
}
