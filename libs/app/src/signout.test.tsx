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

async function open(port: SignInPort, initial: { signedOut?: boolean } = {}): Promise<void> {
    await act(async () => {
        unmount = await mountApp(root, {
            css: "",
            banner: { icon: "raiden-128x.png" },
            signIn: createSignInController(port, initial),
            repoUrl: "https://github.com/acme/widgets",
        });
    });
}
const avatar = (): HTMLButtonElement | null => root.querySelector<HTMLButtonElement>("button.rd-banner__avatar");
const item = (): HTMLElement | null => root.querySelector<HTMLElement>("[role=menuitem]");
const choose = async (): Promise<void> => {
    await act(async () => {
        avatar()!.click();
    });
    await act(async () => {
        item()!.click();
    });
};

describe("sign-out in the shell (#60)", () => {
    it("shows no Sign out item and no menu when the host supplies no sign-out step (D4)", async () => {
        await open({ status: async () => "octo", signIn: async () => null });
        expect(avatar()).toBeNull();
        expect(root.querySelector(".rd-banner__account img")).not.toBeNull();
        expect(root.querySelector("[role=menu]")).toBeNull();
    });

    it("calls the host's step once when Sign out is chosen", async () => {
        const signOut = vi.fn(() => new Promise<void>(() => undefined));
        await open({ status: async () => "octo", signIn: async () => null, signOut });
        await choose();
        expect(signOut).toHaveBeenCalledTimes(1);
    });

    it("shows the sign-in screen at once, with no page, banner, list, avatar or menu, while the step runs (G12)", async () => {
        await open({ status: async () => "octo", signIn: async () => null, signOut: () => new Promise<void>(() => undefined) });
        await choose();
        expect(root.querySelector(".rd-sign-in")).not.toBeNull();
        expect(root.querySelector(".rd-main")).toBeNull();
        expect(root.querySelector(".rd-nav")).toBeNull();
        expect(root.querySelector(".rd-banner")).toBeNull();
        expect(root.querySelector("[role=menu]")).toBeNull();
        expect(avatar()).toBeNull();
        expect(root.querySelector("select")).toBeNull();
    });

    it("keeps Sign in disabled until the host reloads the page", async () => {
        const signIn = vi.fn(async () => null);
        await open({ status: async () => "octo", signIn, signOut: () => new Promise<void>(() => undefined) });
        await choose();
        const button = root.querySelector<HTMLButtonElement>(".rd-sign-in button")!;
        expect(button.disabled).toBe(true);
    });

    it("warns that GitHub may still be signed in and links to GitHub's sign-out, right after Sign out (D8, G16)", async () => {
        await open({ status: async () => "octo", signIn: async () => null, signOut: () => new Promise<void>(() => undefined) });
        await choose();
        const link = root.querySelector<HTMLAnchorElement>(".rd-sign-in a")!;
        expect(root.querySelector(".rd-sign-in")!.textContent).toContain("may still be signed in to GitHub");
        expect(link.getAttribute("href")).toBe("https://github.com/logout");
        expect(link.getAttribute("rel")).toContain("noopener");
    });

    it("shows the warning on a sign-in screen that opens after a Sign out, and not otherwise", async () => {
        await open({ status: async () => null, signIn: async () => null }, { signedOut: true });
        expect(root.querySelector(".rd-sign-in")!.textContent).toContain("may still be signed in to GitHub");
        unmount();
        await open({ status: async () => null, signIn: async () => null });
        expect(root.querySelector(".rd-sign-in")!.textContent).not.toContain("may still be signed in");
        expect(root.querySelector(".rd-sign-in a")).toBeNull();
    });

    it("returns to the real session state when the host step fails", async () => {
        const status = vi.fn(async (): Promise<string | null> => "octo");
        await open({ status, signIn: async () => null, signOut: async () => { throw new Error("no"); } });
        await choose();
        await act(async () => {
            await new Promise((r) => setTimeout(r, 0));
        });
        expect(root.querySelector(".rd-main")).not.toBeNull();
    });

    it("does not offer Sign out in a host with no banner", async () => {
        await act(async () => {
            unmount = await mountApp(root, {
                css: "",
                signIn: createSignInController({ status: async () => "octo", signIn: async () => null, signOut: async () => undefined }),
                repoUrl: "https://github.com/acme/widgets",
            });
        });
        expect(avatar()).toBeNull();
        expect(root.querySelector("[role=menu]")).toBeNull();
    });
});
