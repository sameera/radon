import { render } from "preact";
import { App } from "./app.tsx";
import { sharedSession, type SessionStore } from "./session.ts";

// A small key-value store for UI preferences that last across reloads. The host supplies it, so
// this library holds no extension-only code.
export interface PreferenceStore {
    get(key: string): Promise<unknown>;
    set(key: string, value: unknown): Promise<void>;
}

export interface AppOptions {
    // Stylesheet text for the isolated boundary: tokens, design-system components, app layout.
    css?: string;
    prefs?: PreferenceStore;
    session?: SessionStore;
}

const SHOW_ISSUES: string = "showIssues";
const SIDEBAR_COLLAPSED: string = "sidebarCollapsed";

// Mounts the Raiden app into a shadow root (or any element). The stored preferences are read
// before the first render, so the page never flashes the wrong state. Returns a function that
// removes the app.
export async function mountApp(root: ShadowRoot | HTMLElement, options: AppOptions = {}): Promise<() => void> {
    const [storedIssues, storedCollapsed]: unknown[] = await Promise.all([
        options.prefs?.get(SHOW_ISSUES),
        options.prefs?.get(SIDEBAR_COLLAPSED),
    ]);
    const showIssues: boolean = typeof storedIssues === "boolean" ? storedIssues : true;
    const collapsed: boolean = typeof storedCollapsed === "boolean" ? storedCollapsed : false;
    const doc: Document = root.ownerDocument;
    const style: HTMLStyleElement = doc.createElement("style");
    style.textContent = options.css ?? "";
    const container: HTMLElement = doc.createElement("div");
    container.className = "rd-root";
    root.append(style, container);
    render(
        <App
            session={options.session ?? sharedSession()}
            showIssues={showIssues}
            onShowIssues={(value: boolean) => void options.prefs?.set(SHOW_ISSUES, value)}
            sidebarCollapsed={collapsed}
            onSidebarCollapsed={(value: boolean) => void options.prefs?.set(SIDEBAR_COLLAPSED, value)}
        />,
        container,
    );
    return () => {
        render(null, container);
        container.remove();
        style.remove();
    };
}
