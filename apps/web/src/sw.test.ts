import { describe, expect, it, vi } from "vitest";
import { OFFLINE_PATH, PRECACHE, registerWorker, setUpWorker } from "./sw.ts";

type Handler = (event: unknown) => void;

function setup(cacheName: string, existing: string[] = [], net?: () => Promise<Response>) {
    const handlers: Record<string, Handler> = {};
    const store: Map<string, Map<string, Response>> = new Map(existing.map((n) => [n, new Map()]));
    const caches = {
        async open(name: string) {
            if (!store.has(name)) store.set(name, new Map());
            const c = store.get(name)!;
            return {
                async addAll(urls: string[]) {
                    for (const u of urls) c.set(new URL(u, "https://x.test/app/").href, new Response(u));
                },
            };
        },
        async keys() {
            return [...store.keys()];
        },
        async delete(name: string) {
            return store.delete(name);
        },
        async match(req: string | Request) {
            const url: string = typeof req === "string" ? req : req.url;
            for (const c of store.values()) {
                const hit = c.get(url);
                if (hit) return hit;
            }
            return undefined;
        },
    };
    const fetchFn = vi.fn(net ?? (async () => new Response("net")));
    const scope = {
        registration: { scope: "https://x.test/app/" },
        addEventListener: (type: string, h: Handler) => (handlers[type] = h),
        skipWaiting: vi.fn(),
        clients: { claim: vi.fn() },
    };
    setUpWorker(scope as never, caches as never, fetchFn as never, cacheName);
    const waits: Promise<unknown>[] = [];
    const wait = (p: Promise<unknown>): void => void waits.push(p);
    return { handlers, store, fetchFn, scope, waits, wait };
}
const nav = (url = "https://x.test/app/"): Request => ({ url, mode: "navigate" }) as unknown as Request;

describe("offline worker (G14, G15, G16)", () => {
    it("caches the offline page and what it needs when it installs", async () => {
        const w = setup("raiden-1");
        w.handlers.install({ waitUntil: w.wait });
        await Promise.all(w.waits);
        const cached = [...w.store.get("raiden-1")!.keys()];
        expect(cached).toEqual(PRECACHE.map((p) => new URL(p, "https://x.test/app/").href));
        expect(PRECACHE).toContain(OFFLINE_PATH);
        expect(PRECACHE.some((p) => p.endsWith(".woff2"))).toBe(true);
        expect(PRECACHE.some((p) => p.endsWith(".png"))).toBe(true);
    });

    it("deletes every older cache when it activates", async () => {
        const w = setup("raiden-2", ["raiden-1", "raiden-2", "other"]);
        w.handlers.activate({ waitUntil: w.wait });
        await Promise.all(w.waits);
        expect([...w.store.keys()]).toEqual(["raiden-2"]);
    });

    it("sends a page load to the network and returns what it gets", async () => {
        const w = setup("raiden-1");
        w.handlers.install({ waitUntil: w.wait });
        await Promise.all(w.waits);
        let reply: Promise<Response> | undefined;
        w.handlers.fetch({ request: nav(), respondWith: (p: Promise<Response>) => (reply = p) });
        expect(await (await reply!).text()).toBe("net");
        expect(w.fetchFn).toHaveBeenCalledTimes(1);
    });

    it("returns the cached offline page when the page load fails", async () => {
        const w = setup("raiden-1", [], async () => {
            throw new TypeError("offline");
        });
        w.handlers.install({ waitUntil: w.wait });
        await Promise.all(w.waits);
        let reply: Promise<Response> | undefined;
        w.handlers.fetch({ request: nav(), respondWith: (p: Promise<Response>) => (reply = p) });
        expect(await (await reply!).text()).toBe(new URL(OFFLINE_PATH, "https://x.test/app/").href);
    });

    it("leaves every other request alone", async () => {
        const w = setup("raiden-1");
        const respondWith = vi.fn();
        w.handlers.fetch({ request: new Request("https://x.test/app/main.js"), respondWith });
        expect(respondWith).not.toHaveBeenCalled();
    });

    it("never answers from a cache while online", async () => {
        const w = setup("raiden-1");
        w.handlers.install({ waitUntil: w.wait });
        await Promise.all(w.waits);
        for (const url of ["https://x.test/app/", "https://x.test/app/offline.html"]) {
            let reply: Promise<Response> | undefined;
            w.handlers.fetch({ request: nav(url), respondWith: (p: Promise<Response>) => (reply = p) });
            expect(await (await reply!).text()).toBe("net");
        }
    });

    it("takes over open pages at once", async () => {
        const w = setup("raiden-1");
        w.handlers.install({ waitUntil: w.wait });
        w.handlers.activate({ waitUntil: w.wait });
        await Promise.all(w.waits);
        expect(w.scope.skipWaiting).toHaveBeenCalled();
        expect(w.scope.clients.claim).toHaveBeenCalled();
    });
});

describe("registration", () => {
    it("registers the worker by a relative address", async () => {
        const register = vi.fn(async () => ({}));
        await registerWorker({ serviceWorker: { register } } as never);
        expect(register).toHaveBeenCalledWith("./sw.js");
    });

    it("does nothing in a browser without service workers", async () => {
        await expect(registerWorker({} as never)).resolves.toBeUndefined();
    });

    it("survives a failed registration", async () => {
        const register = vi.fn(async () => {
            throw new Error("no");
        });
        await expect(registerWorker({ serviceWorker: { register } } as never)).resolves.toBeUndefined();
    });
});
