const NAV_SELECTOR: string = "nav[aria-label=\"Repository\"]";
const TAB_ATTR: string = "data-raiden-tab";
const REPO_PATH: RegExp = /^\/[^/]+\/[^/]+$/;

const ICON_SVG: string =
    "<svg aria-hidden=\"true\" focusable=\"false\" class=\"octicon\" viewBox=\"0 0 16 16\" width=\"16\" height=\"16\" fill=\"currentColor\" display=\"inline-block\" overflow=\"visible\" style=\"vertical-align:text-bottom\">" +
    "<path fill-rule=\"evenodd\" d=\"M8 .94 15.06 8 8 15.06.94 8 8 .94Zm0 2.12L3.06 8 8 12.94 12.94 8 8 3.06Z\"></path></svg>";

export interface RepoNav {
    nav: HTMLElement;
    list: HTMLElement;
    base: string;
}

// The tab bar is `nav[aria-label="Repository"]` on repository pages only. Organization and
// profile pages use other labels, so a missing match means "not a repository page".
export function findRepoNav(doc: Document): RepoNav | null {
    const nav: HTMLElement | null = doc.querySelector<HTMLElement>(NAV_SELECTOR);
    const list: HTMLElement | null = nav?.querySelector<HTMLElement>(":scope > ul") ?? null;
    const code: HTMLAnchorElement | null =
        list?.querySelector<HTMLAnchorElement>("a[data-tab-item=\"code\"]") ?? null;
    if (!nav || !list || !code) {
        return null;
    }
    const base: string = new URL(code.href, doc.baseURI).pathname.replace(/\/+$/, "");
    if (!REPO_PATH.test(base)) {
        return null;
    }
    return { nav, list, base };
}

function raidenHref(base: string): string {
    return `${base}/raiden`;
}

// Clone an existing tab so size, spacing, font and theme colors come from GitHub's own classes.
function buildTab(template: HTMLElement, base: string): HTMLElement {
    const li: HTMLElement = template.cloneNode(true) as HTMLElement;
    li.setAttribute(TAB_ATTR, "");
    const a: HTMLAnchorElement = li.querySelector<HTMLAnchorElement>("a")!;
    for (const name of Array.from(a.getAttributeNames())) {
        if (name !== "class") {
            a.removeAttribute(name);
        }
    }
    a.setAttribute("data-tab-item", "raiden");
    a.setAttribute("href", raidenHref(base));
    li.querySelector("[data-component=\"counter\"]")?.remove();
    const icon: Element | null = li.querySelector("[data-component=\"icon\"]");
    if (icon) {
        icon.innerHTML = ICON_SVG;
    }
    const text: Element | null = li.querySelector("[data-component=\"text\"]");
    if (text) {
        text.setAttribute("data-content", "Raiden");
        text.textContent = "Raiden";
    }
    return li;
}

// Adds the Raiden tab after Pull requests (or at the end). Returns true when it added one.
export function injectTab(repo: RepoNav): boolean {
    if (repo.list.querySelector(`[${TAB_ATTR}]`)) {
        return false;
    }
    const code: HTMLElement | null = repo.list
        .querySelector("a[data-tab-item=\"code\"]")
        ?.closest("li") as HTMLElement | null;
    if (!code) {
        return false;
    }
    const tab: HTMLElement = buildTab(code, repo.base);
    const anchor: Element | null =
        repo.list.querySelector("a[data-tab-item=\"pull-requests\"]")?.closest("li") ?? null;
    if (anchor) {
        anchor.after(tab);
    } else {
        repo.list.append(tab);
    }
    return true;
}

// True when the tab is not visible in the bar: hidden by GitHub's overflow logic, or clipped
// past the right edge of the nav.
export function isTabHidden(repo: RepoNav): boolean {
    const tab: HTMLElement | null = repo.list.querySelector<HTMLElement>(`[${TAB_ATTR}]`);
    if (!tab) {
        return false;
    }
    const style: CSSStyleDeclaration = getComputedStyle(tab);
    if (style.display === "none" || style.visibility === "hidden") {
        return true;
    }
    const rect: DOMRect = tab.getBoundingClientRect();
    const limit: DOMRect = repo.list.getBoundingClientRect();
    return rect.width > 0 && rect.right > limit.right + 1;
}

// GitHub renders the "More" menu only while it is open. When it is open and lists repository
// tabs, add a Raiden entry if the tab does not fit in the bar. Returns true when it added one.
export function injectMenuItem(doc: Document, repo: RepoNav): boolean {
    const button: Element | null = repo.nav.querySelector(
        "button[data-component=\"overflow-menu-button\"][aria-expanded=\"true\"]",
    );
    if (!button || !isTabHidden(repo)) {
        return false;
    }
    for (const menu of Array.from(doc.querySelectorAll<HTMLElement>("[role=\"menu\"]"))) {
        if (menu.querySelector(`[${TAB_ATTR}]`)) {
            continue;
        }
        const links: HTMLAnchorElement[] = Array.from(
            menu.querySelectorAll<HTMLAnchorElement>("a[href]"),
        ).filter((a: HTMLAnchorElement) => a.getAttribute("href")?.startsWith(`${repo.base}/`));
        const last: HTMLAnchorElement | undefined = links[links.length - 1];
        if (!last) {
            continue;
        }
        const item: HTMLElement = (last.closest("li") ?? last).cloneNode(true) as HTMLElement;
        item.setAttribute(TAB_ATTR, "");
        const a: HTMLAnchorElement | null = item instanceof HTMLAnchorElement
            ? item
            : item.querySelector<HTMLAnchorElement>("a");
        if (!a) {
            continue;
        }
        a.setAttribute("href", raidenHref(repo.base));
        a.removeAttribute("aria-current");
        relabel(a, "Raiden");
        (last.closest("li") ?? last).after(item);
        return true;
    }
    return false;
}

// Sets the visible label of a cloned menu entry and drops its counter, keeping icon markup.
function relabel(root: HTMLElement, label: string): void {
    const walker: TreeWalker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const texts: Text[] = [];
    while (walker.nextNode()) {
        const node: Text = walker.currentNode as Text;
        if (node.data.trim() !== "") {
            texts.push(node);
        }
    }
    texts.forEach((node: Text, index: number) => {
        if (index === 0) {
            node.data = label;
        } else {
            node.parentElement?.remove();
        }
    });
}

export function sync(doc: Document): void {
    const repo: RepoNav | null = findRepoNav(doc);
    if (!repo) {
        return;
    }
    injectTab(repo);
    injectMenuItem(doc, repo);
}
