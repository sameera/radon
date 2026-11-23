// @vitest-environment jsdom
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountApp } from "./mount.tsx";
import { createSignInController, type SignInPort } from "./signin.ts";

let root: HTMLElement;
let unmount: () => void;

beforeEach(() => {
    root = document.createElement("div");
    document.body.append(root);
    vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => {
    unmount();
    root.remove();
    vi.unstubAllGlobals();
});

async function open(login: string | null, banner: boolean = true): Promise<void> {
    const port: SignInPort = { status: async () => login, signIn: async () => null, signOut: async () => undefined };
    await act(async () => {
        unmount = await mountApp(root, {
            css: "",
            banner: banner ? { icon: "raiden-128x.png" } : undefined,
            signIn: createSignInController(port),
            repoUrl: "https://github.com/acme/widgets",
        });
    });
}
const avatar = (): HTMLButtonElement | null => root.querySelector<HTMLButtonElement>(".rd-banner__avatar");
const menu = (): HTMLElement | null => root.querySelector<HTMLElement>(".rd-banner [role=menu]");
const press = async (target: Element | Document, key: string): Promise<void> => {
    await act(async () => {
        target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, composed: true }));
    });
};

describe("account menu in the banner (#59)", () => {
    it("shows the avatar at the right end of the banner, after the repository drop-down (G1)", async () => {
        await open("octo");
        const banner: HTMLElement = root.querySelector(".rd-banner")!;
        expect(banner.lastElementChild!.contains(avatar())).toBe(true);
        expect(banner.querySelector(".rd-banner__repo")).not.toBeNull();
        const img: HTMLImageElement = avatar()!.querySelector("img")!;
        expect(img.getAttribute("src")).toBe("https://avatars.githubusercontent.com/octo?size=64");
        expect(img.getAttribute("referrerpolicy")).toBe("no-referrer");
    });

    it("builds the picture address from the username only, with the name escaped", async () => {
        await open("a b/c");
        expect(avatar()!.querySelector("img")!.getAttribute("src")).toBe("https://avatars.githubusercontent.com/a%20b%2Fc?size=64");
    });

    it("opens a menu whose only item is Sign out when the avatar is clicked (G2)", async () => {
        await open("octo");
        expect(menu()).toBeNull();
        await act(async () => {
            avatar()!.click();
        });
        const items: HTMLElement[] = Array.from(menu()!.querySelectorAll<HTMLElement>("[role=menuitem]"));
        expect(items.map((i) => i.textContent)).toEqual(["Sign out"]);
        expect(avatar()!.getAttribute("aria-expanded")).toBe("true");
    });

    it("closes on a click outside the menu (G3)", async () => {
        await open("octo");
        await act(async () => {
            avatar()!.click();
        });
        await act(async () => {
            root.querySelector<HTMLElement>(".rd-main")!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, composed: true }));
        });
        expect(menu()).toBeNull();
        expect(avatar()!.getAttribute("aria-expanded")).toBe("false");
    });

    it("stays open on a click inside the menu's own area", async () => {
        await open("octo");
        await act(async () => {
            avatar()!.click();
        });
        await act(async () => {
            menu()!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, composed: true }));
        });
        expect(menu()).not.toBeNull();
    });

    it("closes on Escape and returns focus to the avatar (G3)", async () => {
        await open("octo");
        await act(async () => {
            avatar()!.click();
        });
        expect(document.activeElement).toBe(menu()!.querySelector("[role=menuitem]"));
        await press(document.activeElement!, "Escape");
        expect(menu()).toBeNull();
        expect(document.activeElement).toBe(avatar());
    });

    it("closes when Sign out is chosen (G3)", async () => {
        await open("octo");
        await act(async () => {
            avatar()!.click();
        });
        await act(async () => {
            menu()!.querySelector<HTMLElement>("[role=menuitem]")!.click();
        });
        expect(menu()).toBeNull();
    });

    it("can be reached and used with the keyboard alone, and names the username (G4)", async () => {
        await open("octo");
        expect(avatar()!.tagName).toBe("BUTTON");
        expect(avatar()!.getAttribute("type")).toBe("button");
        expect(avatar()!.getAttribute("aria-label")).toContain("octo");
        expect(avatar()!.getAttribute("aria-haspopup")).toBe("menu");
        await act(async () => {
            avatar()!.click();
        });
        expect(menu()!.querySelector("[role=menuitem]")!.tagName).toBe("BUTTON");
    });

    it("shows no avatar and no menu on the sign-in screen (G5)", async () => {
        await open(null);
        expect(avatar()).toBeNull();
        expect(root.querySelector("[role=menu]")).toBeNull();
        expect(root.querySelector(".rd-banner")).toBeNull();
    });

    it("shows a neutral mark, still usable, when the picture does not load (G6)", async () => {
        await open("octo");
        await act(async () => {
            avatar()!.querySelector("img")!.dispatchEvent(new Event("error"));
        });
        expect(avatar()!.querySelector("img")).toBeNull();
        expect(avatar()!.querySelector("svg")).not.toBeNull();
        await act(async () => {
            avatar()!.click();
        });
        expect(menu()).not.toBeNull();
    });

    it("replaces the sidebar username in a banner host, so the account shows once (G19 split)", async () => {
        await open("octo");
        expect(root.querySelector(".rd-nav__user")).toBeNull();
    });

    it("keeps the sidebar username where the host sets no banner, with no avatar (G18, G19)", async () => {
        await open("octo", false);
        expect(root.querySelector(".rd-nav__user")!.textContent).toBe("octo");
        expect(avatar()).toBeNull();
        expect(root.querySelector("[role=menu]")).toBeNull();
    });
});
