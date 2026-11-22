// Entry of the app bundle. It loads only when the Raiden address opens.
import {
    createRepoStore,
    createSignInController,
    mountApp,
    repoFromUrl,
    type PreferenceStore,
    type RepoStore,
} from "@raiden/app";
import appCss from "@raiden/app/app.css";
import componentsCss from "@raiden/design-system/components.css";
import tokensCss from "@raiden/design-system/tokens.css";

import { extensionGateway } from "./gateway.ts";
import { extensionSignInPort } from "./port.ts";

// The extension is the repository source for each mounted tab: the current repository is the one
// on the github.com page (D3). It never lets the person pick one and stores nothing (G5).
const repos: WeakMap<ShadowRoot, RepoStore> = new WeakMap();

// Called when GitHub's in-page navigation moves the open Raiden tab to a different repository.
export function setRepository(root: ShadowRoot, repoUrl: string): void {
    const repo = repoFromUrl(repoUrl);
    if (repo) {
        repos.get(root)?.set(repo);
    }
}

export function mountRaiden(root: ShadowRoot, prefs: PreferenceStore, repoUrl: string): Promise<() => void> {
    const repo: RepoStore = createRepoStore(repoFromUrl(repoUrl));
    repos.set(root, repo);
    return mountApp(root, { css: `${tokensCss}\n${componentsCss}\n${appCss}`, prefs,
        repo,
        // The tab asks the background worker. Tokens stay in the worker (G3).
        // GitHub requests pass to the background worker, which holds the token (D6).
        gateway: extensionGateway((message) => chrome.runtime.sendMessage(message)),
        signIn: createSignInController(extensionSignInPort((message) => chrome.runtime.sendMessage(message))),
    });
}
