// Entry of the app bundle. It loads only when the Raiden address opens.
import { createSignInController, mountApp, type PreferenceStore } from "@raiden/app";
import appCss from "@raiden/app/app.css";
import componentsCss from "@raiden/design-system/components.css";
import tokensCss from "@raiden/design-system/tokens.css";

import { extensionSignInPort } from "./port.ts";

export function mountRaiden(root: ShadowRoot, prefs: PreferenceStore, repoUrl: string): Promise<() => void> {
    return mountApp(root, { css: `${tokensCss}\n${componentsCss}\n${appCss}`, prefs,
        repoUrl,
        // The tab asks the background worker. Tokens stay in the worker (G3).
        signIn: createSignInController(extensionSignInPort((message) => chrome.runtime.sendMessage(message))),
    });
}
