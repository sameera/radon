import { mountApp, type PreferenceStore, type SignInController, type GitHubGateway } from "@raiden/app";
import { applyTheme } from "./theme.ts";

export interface WebOptions {
    css: string;
    prefs: PreferenceStore;
    signIn?: SignInController;
    gateway?: GitHubGateway;
}

export const HOST_ID: string = "raiden-web";
const FONT_STYLE_ID: string = "raiden-font";

// A shadow root ignores font declarations made inside it, so the display font is declared on the
// document, as the extension does. The file comes from the web view's own address.
function declareFont(doc: Document): void {
    if (doc.getElementById(FONT_STYLE_ID)) {
        return;
    }
    const style: HTMLStyleElement = doc.createElement("style");
    style.id = FONT_STYLE_ID;
    style.textContent =
        `@font-face{font-family:"Bricolage Grotesque";font-style:normal;font-weight:200 800;font-display:swap;` +
        `src:url(fonts/bricolage-grotesque.woff2) format("woff2")}`;
    doc.head.append(style);
}

// Opens the Raiden pages in a shadow root on the page. The theme is set before the shell mounts,
// and the shell reads the stored preferences before its first render.
export async function boot(doc: Document, win: Window, options: WebOptions): Promise<() => void> {
    declareFont(doc);
    const host: HTMLElement = doc.createElement("div");
    host.id = HOST_ID;
    const stopTheme: () => void = applyTheme(host, win);
    doc.body.append(host);
    const unmount: () => void = await mountApp(host.attachShadow({ mode: "open" }), {
        css: options.css,
        prefs: options.prefs,
        signIn: options.signIn,
        gateway: options.gateway,
        banner: { icon: "raiden-128x.png" },
    });
    return () => {
        unmount();
        stopTheme();
        host.remove();
    };
}
