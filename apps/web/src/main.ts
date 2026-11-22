import appCss from "@raiden/app/app.css";
import componentsCss from "@raiden/design-system/components.css";
import tokensCss from "@raiden/design-system/tokens.css";
import { boot } from "./boot.ts";
import { webPreferences } from "./prefs.ts";
import { registerWorker } from "./sw.ts";

void boot(document, window, { css: `${tokensCss}\n${componentsCss}\n${appCss}`, prefs: webPreferences() });
void registerWorker(navigator);
