// The web view has no GitHub color mode to follow, so the theme is the system preference only.
export function applyTheme(host: HTMLElement, win: Window): () => void {
    const query: MediaQueryList = win.matchMedia("(prefers-color-scheme: dark)");
    const set = (): void => host.setAttribute("data-theme", query.matches ? "dark" : "light");
    set();
    query.addEventListener("change", set);
    return () => query.removeEventListener("change", set);
}
