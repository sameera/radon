// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isRaidenAddress, resolveTheme, syncRaiden, type RaidenRuntime } from "./raiden-page.ts";
import { sync } from "./repo-nav.ts";

function item(key: string, label: string, href: string, current: boolean = false): string {
    return (
        `<li class="prc-UnderlineNav-UnderlineNavItem"><a ${current ? "aria-current=\"page\"" : ""} ` +
        `data-tab-item="${key}" class="prc-components-UnderlineItem" href="${href}">` +
        `<span data-component="icon"></span><span data-component="text">${label}</span></a></li>`
    );
}

function page(): void {
    document.documentElement.setAttribute("data-color-mode", "light");
    document.body.innerHTML =
        `<nav aria-label="Repository"><ul>` +
        item("code", "Code", "/acme/app", true) +
        item("pull-requests", "Pull requests", "/acme/app/pulls") +
        `</ul></nav><div id="repo-content-turbo-frame">GitHub content</div>`;
    sync(document);
}

function runtime(): RaidenRuntime {
    return { mount: vi.fn<(root: ShadowRoot) => void>(), unmount: vi.fn<(root: ShadowRoot) => void>() };
}

const AT_RAIDEN = { pathname: "/acme/app", search: "?raiden=1" };
const AT_ISSUES = { pathname: "/acme/app/issues", search: "" };
const content = (): HTMLElement => document.querySelector<HTMLElement>("#repo-content-turbo-frame")!;
const host = (): HTMLElement | null => document.querySelector<HTMLElement>("[data-raiden-host]");

describe("Raiden address", () => {
    it("is the repository main page with the raiden marker", () => {
        expect(isRaidenAddress(AT_RAIDEN, "/acme/app")).toBe(true);
        expect(isRaidenAddress({ pathname: "/acme/app/", search: "?raiden=1" }, "/acme/app")).toBe(true);
    });
    it("is not any other address", () => {
        expect(isRaidenAddress({ pathname: "/acme/app", search: "" }, "/acme/app")).toBe(false);
        expect(isRaidenAddress({ pathname: "/acme/app/issues", search: "?raiden=1" }, "/acme/app")).toBe(false);
    });
});

describe("theme", () => {
    it("follows GitHub's color mode and resolves auto through the system preference", () => {
        const root: HTMLElement = document.documentElement;
        root.setAttribute("data-color-mode", "dark");
        expect(resolveTheme(document, false)).toBe("dark");
        root.setAttribute("data-color-mode", "light");
        expect(resolveTheme(document, true)).toBe("light");
        root.setAttribute("data-color-mode", "auto");
        expect(resolveTheme(document, true)).toBe("dark");
        expect(resolveTheme(document, false)).toBe("light");
    });
});

describe("Raiden page on the repository main page", () => {
    beforeEach(page);

    it("replaces the content below the tab bar and marks only the Raiden tab as current", () => {
        const rt = runtime();
        syncRaiden(document, { location: AT_RAIDEN, prefersDark: false }, rt);
        expect(content().style.display).toBe("none");
        expect(host()).not.toBeNull();
        expect(host()!.previousElementSibling).toBe(content());
        expect(rt.mount).toHaveBeenCalledTimes(1);
        expect(vi.mocked(rt.mount).mock.calls[0]![0]).toBe(host()!.shadowRoot);
        const current: Element[] = Array.from(document.querySelectorAll("nav [aria-current]"));
        expect(current.length).toBe(1);
        expect(current[0]!.closest("[data-raiden-tab]")).not.toBeNull();
    });

    it("mounts once however often it syncs", () => {
        const rt = runtime();
        for (let i = 0; i < 3; i++) {
            syncRaiden(document, { location: AT_RAIDEN, prefersDark: false }, rt);
        }
        expect(rt.mount).toHaveBeenCalledTimes(1);
        expect(document.querySelectorAll("[data-raiden-host]").length).toBe(1);
    });

    it("sets the theme on the host and updates it when the mode changes", () => {
        const rt = runtime();
        syncRaiden(document, { location: AT_RAIDEN, prefersDark: false }, rt);
        expect(host()!.getAttribute("data-theme")).toBe("light");
        document.documentElement.setAttribute("data-color-mode", "auto");
        syncRaiden(document, { location: AT_RAIDEN, prefersDark: true }, rt);
        expect(host()!.getAttribute("data-theme")).toBe("dark");
        expect(rt.mount).toHaveBeenCalledTimes(1);
    });

    it("leaves no Raiden page behind when the address changes, and restores GitHub's page", () => {
        const rt = runtime();
        syncRaiden(document, { location: AT_RAIDEN, prefersDark: false }, rt);
        syncRaiden(document, { location: AT_ISSUES, prefersDark: false }, rt);
        expect(host()).toBeNull();
        expect(rt.unmount).toHaveBeenCalledTimes(1);
        expect(content().style.display).toBe("");
        expect(content().hasAttribute("data-raiden-hidden")).toBe(false);
        expect(document.querySelector("[data-tab-item=\"code\"]")!.getAttribute("aria-current")).toBe("page");
        expect(document.querySelector("[data-raiden-tab] a")!.hasAttribute("aria-current")).toBe(false);
    });

    it("does nothing at an ordinary repository address", () => {
        const rt = runtime();
        syncRaiden(document, { location: AT_ISSUES, prefersDark: false }, rt);
        expect(host()).toBeNull();
        expect(rt.mount).not.toHaveBeenCalled();
        expect(content().style.display).toBe("");
    });

    it("keeps the host and its page when GitHub re-renders its content or tab bar", () => {
        const rt = runtime();
        syncRaiden(document, { location: AT_RAIDEN, prefersDark: false }, rt);
        const first: HTMLElement = host()!;
        content().replaceWith(Object.assign(document.createElement("div"), { id: "repo-content-turbo-frame" }));
        document.querySelector("nav")!.remove();
        syncRaiden(document, { location: AT_RAIDEN, prefersDark: false }, rt);
        expect(host()).toBe(first);
        expect(rt.mount).toHaveBeenCalledTimes(1);
        expect(rt.unmount).not.toHaveBeenCalled();
        expect(content().style.display).toBe("none");
    });

    it("re-strips Code's current mark if GitHub sets it again", () => {
        const rt = runtime();
        syncRaiden(document, { location: AT_RAIDEN, prefersDark: false }, rt);
        document.querySelector("[data-tab-item=\"code\"]")!.setAttribute("aria-current", "page");
        syncRaiden(document, { location: AT_RAIDEN, prefersDark: false }, rt);
        expect(document.querySelectorAll("nav [aria-current]").length).toBe(1);
    });
});

describe("pages that are not repository pages", () => {
    it("gets no Raiden page", () => {
        document.body.innerHTML = `<nav aria-label="Organization"><ul></ul></nav><div id="repo-content-turbo-frame"></div>`;
        const rt = runtime();
        syncRaiden(document, { location: AT_RAIDEN, prefersDark: false }, rt);
        expect(host()).toBeNull();
        expect(rt.mount).not.toHaveBeenCalled();
    });
});
