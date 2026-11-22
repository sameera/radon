// Entry of the app bundle. It loads only when the Raiden address opens.
import { mountApp, type PreferenceStore } from "@raiden/app";
import appCss from "@raiden/app/app.css";
import componentsCss from "@raiden/design-system/components.css";
import tokensCss from "@raiden/design-system/tokens.css";

export function mountRaiden(root: ShadowRoot, prefs: PreferenceStore, repoUrl: string): Promise<() => void> {
    return mountApp(root, { css: `${tokensCss}\n${componentsCss}\n${appCss}`, prefs, repoUrl });
}
