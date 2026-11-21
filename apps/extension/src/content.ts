import { sync, syncRaiden, type PageEnv, type RaidenRuntime } from "@raiden/shared";

interface AppModule {
    mountRaiden(root: ShadowRoot): Promise<() => void>;
}

const FONT_STYLE_ID: string = "raiden-font";
const unmounts: WeakMap<ShadowRoot, () => void> = new WeakMap();
let appModule: Promise<AppModule> | null = null;

// The one Raiden style on the GitHub page itself: font declarations inside the shadow root are
// ignored. GitHub blocks web fonts from other hosts, so the font ships with the extension.
function declareFont(): void {
    if (document.getElementById(FONT_STYLE_ID)) {
        return;
    }
    const style: HTMLStyleElement = document.createElement("style");
    style.id = FONT_STYLE_ID;
    style.textContent =
        `@font-face{font-family:"Bricolage Grotesque";font-style:normal;font-weight:200 800;font-display:swap;` +
        `src:url(${chrome.runtime.getURL("fonts/bricolage-grotesque.woff2")}) format("woff2")}`;
    document.head.append(style);
}

const runtime: RaidenRuntime = {
    mount(root: ShadowRoot): void {
        declareFont();
        appModule ??= import(/* @vite-ignore */ chrome.runtime.getURL("app.js")) as Promise<AppModule>;
        void appModule.then(async (app: AppModule) => {
            if (!root.host.isConnected) {
                return;
            }
            const unmount: () => void = await app.mountRaiden(root);
            if (root.host.isConnected) {
                unmounts.set(root, unmount);
            } else {
                unmount();
            }
        });
    },
    unmount(root: ShadowRoot): void {
        unmounts.get(root)?.();
        unmounts.delete(root);
    },
};

const dark: MediaQueryList = window.matchMedia("(prefers-color-scheme: dark)");

function run(): void {
    sync(document);
    const env: PageEnv = { location, prefersDark: dark.matches };
    syncRaiden(document, env, runtime);
}

// GitHub re-renders the tab bar on in-page navigation and on hydration, which drops the
// injected tab. Re-sync on every DOM change, at most once per frame.
let scheduled: boolean = false;

function schedule(): void {
    if (scheduled) {
        return;
    }
    scheduled = true;
    requestAnimationFrame(() => {
        scheduled = false;
        run();
    });
}

new MutationObserver(schedule).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["aria-expanded", "aria-current", "data-color-mode", "data-light-theme", "data-dark-theme"],
});
window.addEventListener("resize", schedule);
window.addEventListener("popstate", schedule);
dark.addEventListener("change", schedule);
run();
