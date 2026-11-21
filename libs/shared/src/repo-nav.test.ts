// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { findRepoNav, injectMenuItem, injectTab, sync } from "./repo-nav.ts";

function item(key: string, label: string, href: string, current: boolean = false): string {
    return (
        `<li class="prc-UnderlineNav-UnderlineNavItem"><a ${current ? "aria-current=\"page\"" : ""} ` +
        `data-tab-item="${key}" data-react-nav="repo" data-turbo-frame="repo-content-turbo-frame" ` +
        `class="prc-components-UnderlineItem" href="${href}" data-discover="true">` +
        `<span data-component="icon"><svg class="octicon"></svg></span>` +
        `<span data-component="text" data-content="${label}">${label}</span>` +
        `<span data-component="counter">9</span></a></li>`
    );
}

function repoBar(extra: string = ""): string {
    return (
        `<nav aria-label="Repository"><ul role="list">` +
        item("code", "Code", "/acme/app", true) +
        item("issues", "Issues", "/acme/app/issues") +
        item("pull-requests", "Pull requests", "/acme/app/pulls") +
        item("actions", "Actions", "/acme/app/actions") +
        `</ul><div><button data-component="overflow-menu-button" aria-expanded="false">More</button></div></nav>${extra}`
    );
}

describe("repo tab bar", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
    });

    it("adds a Raiden tab after Pull requests", () => {
        document.body.innerHTML = repoBar();
        sync(document);
        const labels: string[] = Array.from(
            document.querySelectorAll("nav[aria-label=\"Repository\"] li [data-component=\"text\"]"),
        ).map((e: Element) => e.textContent ?? "");
        expect(labels).toEqual(["Code", "Issues", "Pull requests", "Raiden", "Actions"]);
    });

    it("copies GitHub's classes and drops state and routing attributes", () => {
        document.body.innerHTML = repoBar();
        sync(document);
        const a: HTMLAnchorElement = document.querySelector("[data-raiden-tab] a")!;
        expect(a.className).toBe("prc-components-UnderlineItem");
        expect(a.getAttribute("href")).toBe("/acme/app/raiden");
        expect(a.hasAttribute("aria-current")).toBe(false);
        expect(a.hasAttribute("data-react-nav")).toBe(false);
        expect(a.hasAttribute("data-turbo-frame")).toBe(false);
        expect(a.querySelector("[data-component=\"counter\"]")).toBeNull();
    });

    it("adds the tab once", () => {
        document.body.innerHTML = repoBar();
        sync(document);
        sync(document);
        expect(document.querySelectorAll("[data-raiden-tab]").length).toBe(1);
    });

    it("re-adds the tab after the bar is re-rendered", () => {
        document.body.innerHTML = repoBar();
        sync(document);
        document.body.innerHTML = repoBar();
        sync(document);
        expect(document.querySelectorAll("[data-raiden-tab]").length).toBe(1);
    });

    it("adds nothing outside a repository", () => {
        document.body.innerHTML =
            "<nav aria-label=\"Organization\"><ul><li><a data-tab-item=\"overview\" href=\"/acme\">Overview</a></li></ul></nav>";
        sync(document);
        expect(document.querySelector("[data-raiden-tab]")).toBeNull();
        expect(findRepoNav(document)).toBeNull();
    });

    it("adds to the menu when the tab is hidden and the menu is open", () => {
        const menu: string =
            "<ul role=\"menu\"><li role=\"none\"><a role=\"menuitem\" href=\"/acme/app/security\"><span>Security</span><span>3</span></a></li></ul>";
        document.body.innerHTML = repoBar(menu);
        const repo = findRepoNav(document)!;
        injectTab(repo);
        document.querySelector("button")!.setAttribute("aria-expanded", "true");
        (document.querySelector("[data-raiden-tab]") as HTMLElement).style.visibility = "hidden";
        expect(injectMenuItem(document, repo)).toBe(true);
        const added: HTMLAnchorElement = document.querySelector("[role=\"menu\"] [data-raiden-tab] a")!;
        expect(added.getAttribute("href")).toBe("/acme/app/raiden");
        expect(added.textContent).toBe("Raiden");
        expect(injectMenuItem(document, repo)).toBe(false);
    });

    it("leaves the menu alone when the tab is visible", () => {
        document.body.innerHTML = repoBar("<ul role=\"menu\"><li><a href=\"/acme/app/security\">Security</a></li></ul>");
        const repo = findRepoNav(document)!;
        injectTab(repo);
        document.querySelector("button")!.setAttribute("aria-expanded", "true");
        expect(injectMenuItem(document, repo)).toBe(false);
    });
});
