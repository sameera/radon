// @vitest-environment jsdom
import { render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GatewayContext, useGateway, type GitHubGateway } from "./gateway.ts";
import { mountApp } from "./mount.tsx";

let root: HTMLElement;
beforeEach(() => {
    root = document.createElement("div");
    document.body.append(root);
});
afterEach(() => {
    root.remove();
    vi.unstubAllGlobals();
});

describe("GitHub gateway in the shell", () => {
    it("gives pages the host's gateway and nothing else, so pages never see a token (D6)", async () => {
        const gateway: GitHubGateway = { request: vi.fn(async () => ({ ok: true as const, status: 200, body: { n: 1 } })) };
        let seen: GitHubGateway | undefined;
        function Probe() {
            seen = useGateway();
            return null;
        }
        await act(async () => render(<GatewayContext.Provider value={gateway}><Probe /></GatewayContext.Provider>, root));
        expect(seen).toBe(gateway);
        expect(Object.keys(seen!)).toEqual(["request"]);
    });

    it("has no gateway in a host that gives none", async () => {
        let seen: GitHubGateway | undefined | "unset" = "unset";
        function Probe() {
            seen = useGateway();
            return null;
        }
        await act(async () => render(<Probe />, root));
        expect(seen).toBeUndefined();
    });

    it("renders pages and sends no request on mount, signed in or not (G23)", async () => {
        const fetchSpy = vi.fn();
        vi.stubGlobal("fetch", fetchSpy);
        const gateway: GitHubGateway = { request: vi.fn() };
        let unmount: () => void = () => undefined;
        await act(async () => {
            unmount = await mountApp(root, { css: "", gateway, repoUrl: "https://github.com/acme/widgets" });
        });
        expect(root.querySelector(".rd-main")!.textContent).toContain("Grooming");
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(gateway.request).not.toHaveBeenCalled();
        unmount();
    });
});
