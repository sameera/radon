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
    // The web address of the repository the user is on, for example https://github.com/acme/widgets.
    // The host works it out from the page. Without it, the page builds no GitHub links.
    repoUrl?: string;
    // Set by a host with no page around Raiden. Carries the icon the banner shows. The extension leaves it off.
    banner?: { icon: string };
}

const SHOW_ISSUES: string = "showIssues";
const SIDEBAR_COLLAPSED: string = "sidebarCollapsed";
const BACKLOG_WIDTH: string = "backlogWidth";

// Mounts the Raiden app into a shadow root (or any element). The stored preferences are read
// before the first render, so the page never flashes the wrong state. Returns a function that
// removes the app.
export async function mountApp(root: ShadowRoot | HTMLElement, options: AppOptions = {}): Promise<() => void> {
    const [storedIssues, storedCollapsed, storedWidth]: unknown[] = await Promise.all([
        options.prefs?.get(SHOW_ISSUES),
        options.prefs?.get(SIDEBAR_COLLAPSED),
        options.prefs?.get(BACKLOG_WIDTH),
    ]);
    const showIssues: boolean = typeof storedIssues === "boolean" ? storedIssues : true;
    const collapsed: boolean = typeof storedCollapsed === "boolean" ? storedCollapsed : false;
    const backlogWidth: number | undefined =
        typeof storedWidth === "number" && Number.isFinite(storedWidth) ? storedWidth : undefined;
    const doc: Document = root.ownerDocument;
    const style: HTMLStyleElement = doc.createElement("style");
    style.textContent = options.css ?? "";
    const container: HTMLElement = doc.createElement("div");
    container.className = "rd-root";
    // GitHub's keyboard shortcuts listen on the page. Raiden sits in a shadow root, so the page
    // cannot tell that a lead is typing in a field. Keys typed in a field stay inside Raiden.
    const keepInside = (e: KeyboardEvent): void => {
        const origin: EventTarget | undefined = e.composedPath()[0];
        if (origin instanceof HTMLInputElement || origin instanceof HTMLTextAreaElement) {
            e.stopPropagation();
        }
    };
    for (const type of ["keydown", "keyup", "keypress"]) {
        container.addEventListener(type, keepInside as EventListener);
    }
    root.append(style, container);
    render(
        <App
            session={options.session ?? sharedSession()}
            repoUrl={options.repoUrl}
            banner={options.banner}
            showIssues={showIssues}
            onShowIssues={(value: boolean) => void options.prefs?.set(SHOW_ISSUES, value)}
            sidebarCollapsed={collapsed}
            onSidebarCollapsed={(value: boolean) => void options.prefs?.set(SIDEBAR_COLLAPSED, value)}
            backlogWidth={backlogWidth}
            onBacklogWidth={(value: number) => void options.prefs?.set(BACKLOG_WIDTH, value)}
        />,
        container,
    );
    return () => {
        render(null, container);
        container.remove();
        style.remove();
    };
}
