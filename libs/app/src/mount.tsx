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

// Mounts the Raiden app into a shadow root (or any element). The stored preferences are read
// before the first render, so the page never flashes the wrong state. Returns a function that
// removes the app.
export async function mountApp(root: ShadowRoot | HTMLElement, options: AppOptions = {}): Promise<() => void> {
    const stored: unknown = await options.prefs?.get(SHOW_ISSUES);
    const showIssues: boolean = typeof stored === "boolean" ? stored : true;
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
        />,
        container,
    );
    return () => {
        render(null, container);
        container.remove();
        style.remove();
    };
}
