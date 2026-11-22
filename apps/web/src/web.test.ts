// @vitest-environment jsdom
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { boot, HOST_ID } from "./boot.ts";
import { webPreferences } from "./prefs.ts";

type Listener = () => void;

function stubMedia(dark: boolean): { flip(next: boolean): void } {
    let matches: boolean = dark;
    const listeners: Set<Listener> = new Set();
    const query = {
        get matches(): boolean {
            return matches;
        },
        addEventListener: (_: string, l: Listener) => listeners.add(l),
        removeEventListener: (_: string, l: Listener) => listeners.delete(l),
    };
    vi.stubGlobal("matchMedia", () => query);
    window.matchMedia = (() => query) as unknown as typeof window.matchMedia;
    return {
        flip(next: boolean): void {
            matches = next;
            listeners.forEach((l: Listener) => l());
        },
    };
}

let unmount: (() => void) | undefined;
const host = (): HTMLElement => document.getElementById(HOST_ID)!;
const shadow = (): ShadowRoot => host().shadowRoot!;
async function open(): Promise<void> {
    await act(async () => {
        unmount = await boot(document, window, { css: ".x{}", prefs: webPreferences() });
    });
}

beforeEach(() => {
    localStorage.clear();
    document.head.innerHTML = "";
    document.body.innerHTML = "";
    vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => {
    unmount?.();
    unmount = undefined;
    vi.unstubAllGlobals();
});

describe("web view content (G1, G2, G3, G4)", () => {
    it("shows the sidebar and the Grooming page with no extension and no GitHub page", async () => {
        stubMedia(false);
        expect((globalThis as { chrome?: unknown }).chrome).toBeUndefined();
        await open();
        expect(shadow().querySelector(".rd-nav")).not.toBeNull();
        expect(shadow().querySelector(".rd-nav__word")!.textContent).toBe("Raiden");
        expect(shadow().querySelector(".rd-nav-item[aria-current=\"page\"]")!.textContent).toContain("Grooming");
        expect(document.querySelector("[data-raiden-hidden], [data-raiden-tab], [data-raiden-host]")).toBeNull();
        expect(document.body.children).toHaveLength(1);
    });

    it("never changes the address when pages switch", async () => {
        stubMedia(false);
        const before: string = location.href;
        await open();
        const timeline = Array.from(shadow().querySelectorAll<HTMLElement>(".rd-nav-item")).find((e) =>
            e.textContent?.includes("Timeline"),
        )!;
        await act(async () => timeline.click());
        expect(location.href).toBe(before);
    });

    it("sends no network request", async () => {
        stubMedia(false);
        await open();
        expect(fetch).not.toHaveBeenCalled();
    });

    it("declares the display font on the document from its own address (G9)", async () => {
        stubMedia(false);
        await open();
        const css: string = document.getElementById("raiden-font")!.textContent!;
        expect(css).toContain("Bricolage Grotesque");
        expect(css).toContain("url(fonts/bricolage-grotesque.woff2)");
        expect(css).not.toMatch(/https?:|\/\//);
    });
});

describe("theme (G5)", () => {
    it("is dark when the system is dark, set before the shell shows", async () => {
        stubMedia(true);
        await open();
        expect(host().getAttribute("data-theme")).toBe("dark");
    });

    it("is light when the system is light", async () => {
        stubMedia(false);
        await open();
        expect(host().getAttribute("data-theme")).toBe("light");
    });

    it("follows a change of the system setting without a reload", async () => {
        const media = stubMedia(false);
        await open();
        media.flip(true);
        expect(host().getAttribute("data-theme")).toBe("dark");
        media.flip(false);
        expect(host().getAttribute("data-theme")).toBe("light");
    });
});

describe("saved choices (G6, G7, G8)", () => {
    const toggle = (): HTMLElement => shadow().querySelector<HTMLElement>(".rd-nav__toggle")!;

    it("keeps its choices under a Raiden prefix in its own storage and restores them on reload", async () => {
        stubMedia(false);
        await open();
        await act(async () => toggle().click());
        expect(localStorage.getItem("raiden:sidebarCollapsed")).toBe("true");
        unmount!();
        await open();
        expect(shadow().querySelector(".rd-nav--collapsed")).not.toBeNull();
    });

    it("opens with defaults when storage throws", async () => {
        stubMedia(false);
        vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
            throw new Error("blocked");
        });
        vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
            throw new Error("blocked");
        });
        await open();
        expect(shadow().querySelector(".rd-nav")).not.toBeNull();
        await expect(webPreferences().set("showIssues", false)).resolves.toBeUndefined();
        vi.restoreAllMocks();
    });

    it("opens with defaults when a stored value is of the wrong kind", async () => {
        stubMedia(false);
        localStorage.setItem("raiden:sidebarCollapsed", JSON.stringify("yes"));
        localStorage.setItem("raiden:backlogWidth", "not json{");
        localStorage.setItem("raiden:showIssues", JSON.stringify(3));
        await open();
        expect(shadow().querySelector(".rd-nav")).not.toBeNull();
        expect(shadow().querySelector(".rd-nav--collapsed")).toBeNull();
    });

    it("never touches an extension store", async () => {
        const set = vi.fn();
        vi.stubGlobal("chrome", { storage: { local: { get: vi.fn(), set } } });
        stubMedia(false);
        await open();
        await webPreferences().set("showIssues", false);
        expect(set).not.toHaveBeenCalled();
    });
});

describe("banner (G17, G18, G10)", () => {
    it("shows the banner with the Raiden icon from its own address, above the sidebar", async () => {
        stubMedia(false);
        await open();
        const frame: Element = shadow().querySelector(".rd-frame")!;
        expect(frame.firstElementChild!.classList.contains("rd-banner")).toBe(true);
        const mark: Element = frame.querySelector(".rd-banner img")!;
        expect(mark.getAttribute("src")).toBe("raiden-128x.png");
        expect(frame.querySelector(".rd-banner__word")!.textContent).toBe("Raiden");
        expect(fetch).not.toHaveBeenCalled();
    });
});
