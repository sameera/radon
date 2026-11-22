import { findRepoNav, RAIDEN_PARAM, type RepoNav } from "./repo-nav.ts";

const HOST_ATTR: string = "data-raiden-host";
const HIDDEN_ATTR: string = "data-raiden-hidden";
const STRIPPED_ATTR: string = "data-raiden-stripped";
const BASE_ATTR: string = "data-raiden-base";
const REPO_ATTR: string = "data-raiden-repo";
const CONTENT_SELECTORS: string[] = ["#repo-content-turbo-frame", "#js-repo-pjax-container", "main"];

export interface RaidenRuntime {
    mount(root: ShadowRoot, repoUrl: string): void;
    // The page is showing and GitHub's in-page navigation moved to a different repository (D3).
    update(root: ShadowRoot, repoUrl: string): void;
    unmount(root: ShadowRoot): void;
}

export interface PageEnv {
    location: { pathname: string; search: string };
    prefersDark: boolean;
}

export function isRaidenAddress(location: PageEnv["location"], base: string): boolean {
    return (
        location.pathname.replace(/\/+$/, "") === base &&
        new URLSearchParams(location.search).has(RAIDEN_PARAM)
    );
}

// GitHub keeps its mode on <html data-color-mode>. "auto" follows the system preference.
export function resolveTheme(doc: Document, prefersDark: boolean): "light" | "dark" {
    const mode: string | null = doc.documentElement.getAttribute("data-color-mode");
    if (mode === "dark") {
        return "dark";
    }
    if (mode === "light") {
        return "light";
    }
    return prefersDark ? "dark" : "light";
}

function findContent(doc: Document): HTMLElement | null {
    for (const selector of CONTENT_SELECTORS) {
        const found: HTMLElement | null = doc.querySelector<HTMLElement>(selector);
        if (found) {
            return found;
        }
    }
    return null;
}

function setAttr(el: Element, name: string, value: string): void {
    if (el.getAttribute(name) !== value) {
        el.setAttribute(name, value);
    }
}

// Every write below is guarded: the extension re-syncs on DOM changes, and an unguarded write
// would trigger the next sync.
function hideContent(doc: Document, content: HTMLElement): void {
    for (const other of Array.from(doc.querySelectorAll<HTMLElement>(`[${HIDDEN_ATTR}]`))) {
        if (other !== content) {
            restoreContent(other);
        }
    }
    if (!content.hasAttribute(HIDDEN_ATTR)) {
        content.setAttribute(HIDDEN_ATTR, content.style.display);
    }
    if (content.style.display !== "none") {
        content.style.display = "none";
    }
}

function restoreContent(el: HTMLElement): void {
    el.style.display = el.getAttribute(HIDDEN_ATTR) ?? "";
    el.removeAttribute(HIDDEN_ATTR);
}

function markCurrent(doc: Document, repo: RepoNav): void {
    const own: Element | null = repo.list.querySelector("[data-raiden-tab] a");
    if (own) {
        setAttr(own, "aria-current", "page");
    }
    for (const a of Array.from(repo.list.querySelectorAll("a[aria-current]"))) {
        if (a !== own) {
            setAttr(a, STRIPPED_ATTR, a.getAttribute("aria-current") ?? "page");
            a.removeAttribute("aria-current");
        }
    }
}

function unmark(doc: Document): void {
    for (const a of Array.from(doc.querySelectorAll(`[${STRIPPED_ATTR}]`))) {
        a.setAttribute("aria-current", a.getAttribute(STRIPPED_ATTR) ?? "page");
        a.removeAttribute(STRIPPED_ATTR);
    }
    doc.querySelector("[data-raiden-tab] a[aria-current]")?.removeAttribute("aria-current");
}

function deactivate(doc: Document, runtime: RaidenRuntime): void {
    const host: HTMLElement | null = doc.querySelector<HTMLElement>(`[${HOST_ATTR}]`);
    if (host) {
        if (host.shadowRoot) {
            runtime.unmount(host.shadowRoot);
        }
        host.remove();
    }
    for (const el of Array.from(doc.querySelectorAll<HTMLElement>(`[${HIDDEN_ATTR}]`))) {
        restoreContent(el);
    }
    unmark(doc);
}

// The page is showing already. Hide GitHub's content again if it was re-rendered, keep the host
// next to it, and refresh the theme.
function keepPage(doc: Document, host: HTMLElement, env: PageEnv): void {
    const content: HTMLElement | null = findContent(doc);
    if (content) {
        hideContent(doc, content);
        if (host.previousElementSibling !== content) {
            content.after(host);
        }
    }
    setAttr(host, "data-theme", resolveTheme(doc, env.prefersDark));
}

// Shows the Raiden page on the Raiden address and removes it everywhere else. The host sits
// next to GitHub's content, not inside it, so GitHub re-rendering that content keeps the page.
export function syncRaiden(doc: Document, env: PageEnv, runtime: RaidenRuntime): void {
    const repo: RepoNav | null = findRepoNav(doc);
    const host: HTMLElement | null = doc.querySelector<HTMLElement>(`[${HOST_ATTR}]`);
    if (!repo) {
        // GitHub may drop the tab bar for a moment while it re-renders. Keep the page then.
        const base: string | null = host?.getAttribute(BASE_ATTR) ?? null;
        if (host && base !== null && isRaidenAddress(env.location, base)) {
            keepPage(doc, host, env);
        } else {
            deactivate(doc, runtime);
        }
        return;
    }
    if (!isRaidenAddress(env.location, repo.base)) {
        deactivate(doc, runtime);
        return;
    }
    if (host) {
        keepPage(doc, host, env);
        markCurrent(doc, repo);
        if (host.shadowRoot && host.getAttribute(REPO_ATTR) !== repo.url) {
            host.setAttribute(REPO_ATTR, repo.url);
            runtime.update(host.shadowRoot, repo.url);
        }
        return;
    }
    const content: HTMLElement | null = findContent(doc);
    if (!content) {
        return;
    }
    hideContent(doc, content);
    const page: HTMLElement = doc.createElement("div");
    page.setAttribute(HOST_ATTR, "");
    page.setAttribute(BASE_ATTR, repo.base);
    page.setAttribute(REPO_ATTR, repo.url);
    const root: ShadowRoot = page.attachShadow({ mode: "open" });
    content.after(page);
    runtime.mount(root, repo.url);
    setAttr(page, "data-theme", resolveTheme(doc, env.prefersDark));
    markCurrent(doc, repo);
}
