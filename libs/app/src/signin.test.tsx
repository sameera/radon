// @vitest-environment jsdom
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountApp } from "./mount.tsx";
import { createSignInController, type SignInPort } from "./signin.ts";

let root: HTMLElement;
let unmount: () => void;
let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
    root = document.createElement("div");
    document.body.append(root);
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
});
afterEach(() => {
    unmount();
    root.remove();
    vi.unstubAllGlobals();
});

async function open(port?: SignInPort, initial?: { notice?: boolean }): Promise<void> {
    await act(async () => {
        const signIn = port ? createSignInController(port, initial) : undefined;
        unmount = await mountApp(root, { css: "", signIn, repoUrl: "https://github.com/acme/widgets" });
    });
}
// Clicks, then lets the sign-in promise chain finish before the next check.
async function click(): Promise<void> {
    await act(async () => {
        button()!.click();
        await new Promise((r) => setTimeout(r, 0));
    });
}
const account = (): HTMLElement | null => root.querySelector<HTMLElement>(".rd-nav__account");
const button = (): HTMLButtonElement | null => root.querySelector<HTMLButtonElement>(".rd-nav__account button");

describe("sign-in control in the shell", () => {
    it("shows nothing when the host gives no sign-in, and the pages still render (G23)", async () => {
        await open();
        expect(account()).toBeNull();
        expect(root.querySelector(".rd-nav")).not.toBeNull();
        expect(root.querySelector(".rd-main")!.textContent).toContain("Grooming");
    });

    it("blocks navigation and page actions while signed out", async () => {
        await open({ status: async () => null, signIn: async () => null });
        expect(button()!.textContent).toBe("Sign in with GitHub");
        expect(root.querySelector(".rd-main")).toBeNull();
        expect(root.querySelector(".rd-nav")).toBeNull();
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("shows the username after a stored sign-in is found, as after a reload (G14)", async () => {
        await open({ status: async () => "octo", signIn: async () => null });
        expect(account()!.textContent).toContain("octo");
        expect(button()).toBeNull();
    });

    it("signs in on click and shows the username", async () => {
        const signIn = vi.fn(async () => ({ login: "octo" }));
        await open({ status: async () => null, signIn });
        await click();
        expect(signIn).toHaveBeenCalledTimes(1);
        expect(account()!.textContent).toContain("octo");
    });

    it("closes the pages when a foreground check finds that the session ended", async () => {
        const status = vi.fn(async (): Promise<string | null> => "octo");
        await open({ status, signIn: async () => null });
        expect(root.querySelector(".rd-main")).not.toBeNull();
        status.mockResolvedValue(null);
        await act(async () => {
            window.dispatchEvent(new Event("focus"));
        });
        expect(root.querySelector(".rd-main")).toBeNull();
        expect(button()?.textContent).toBe("Sign in with GitHub");
    });

    it("checks the session while the app is left open", async () => {
        vi.useFakeTimers();
        try {
            const status = vi.fn(async () => "octo");
            await open({ status, signIn: async () => null });
            await act(async () => {
                await vi.advanceTimersByTimeAsync(60_000);
            });
            expect(status).toHaveBeenCalledTimes(2);
            expect(root.querySelector(".rd-main")).not.toBeNull();
        } finally {
            vi.useRealTimers();
        }
    });

    it("retries an unavailable session check without asking the user to sign in again", async () => {
        const status = vi.fn(async () => "octo").mockRejectedValueOnce(new Error("offline"));
        const signIn = vi.fn(async () => null);
        await open({ status, signIn });
        expect(root.querySelector(".rd-main")).toBeNull();
        expect(button()?.textContent).toBe("Retry");
        await click();
        expect(root.querySelector(".rd-main")).not.toBeNull();
        expect(signIn).not.toHaveBeenCalled();
    });

    it("shows that sign-in did not finish and stays signed out when the sign-in fails (G13)", async () => {
        await open({ status: async () => null, signIn: async () => null });
        await click();
        const alert: HTMLElement = account()!.querySelector<HTMLElement>("[role=alert]")!;
        expect(alert.textContent).toBe("Sign-in did not finish");
        expect(button()).not.toBeNull();
    });

    it("clears the message when the user tries again", async () => {
        const answers = [null, { login: "octo" }];
        await open({ status: async () => null, signIn: async () => answers.shift()! });
        await click();
        await click();
        expect(account()!.querySelector("[role=alert]")).toBeNull();
        expect(account()!.textContent).toContain("octo");
    });

    it("shows the message from the start when the host reports a failed return (web view)", async () => {
        await open({ status: async () => null, signIn: async () => null }, { notice: true });
        expect(account()!.querySelector("[role=alert]")!.textContent).toBe("Sign-in did not finish");
    });

    it("treats a throwing port as a sign-in that did not finish", async () => {
        await open({
            status: async () => null,
            signIn: async () => {
                throw new Error("x");
            },
        });
        await click();
        expect(account()!.querySelector("[role=alert]")).not.toBeNull();
    });
});
