import { createSignInController } from "@raiden/app";
import appCss from "@raiden/app/app.css";
import componentsCss from "@raiden/design-system/components.css";
import tokensCss from "@raiden/design-system/tokens.css";
import { boot } from "./boot.ts";
import { webPreferences } from "./prefs.ts";
import { finishReturn, webSignInPort, type WebSignInDeps } from "./signin.ts";
import { registerWorker } from "./sw.ts";
import { teamSettings } from "./team-settings.ts";

const team = teamSettings();
const deps: WebSignInDeps = {
    settings: team,
    returnUrl: team.returnUrl || new URL("./", window.location.href).toString(),
    win: window,
    local: window.localStorage,
    session: window.sessionStorage,
    fetch: (input, init) => fetch(input, init),
};

// A return from GitHub is finished before the shell mounts, so the pages open already signed in
// or signed out, on the first page.
async function start(): Promise<void> {
    const { notice } = await finishReturn(deps);
    await boot(document, window, {
        css: `${tokensCss}\n${componentsCss}\n${appCss}`,
        prefs: webPreferences(),
        signIn: createSignInController(webSignInPort(deps), { notice }),
    });
}

void start();
void registerWorker(navigator);
