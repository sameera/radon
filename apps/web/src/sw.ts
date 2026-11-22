// The offline worker's one job: answer a failed page load with the offline page. Online, every
// request goes to the network, so the web view never runs a cached copy of an old build. The
// cache holds only the offline page and what it needs.
export const OFFLINE_PATH: string = "offline.html";
export const PRECACHE: string[] = [OFFLINE_PATH, "fonts/bricolage-grotesque.woff2", "raiden-128x.png"];

interface WorkerEvent {
    waitUntil(work: Promise<unknown>): void;
}
interface FetchEvent {
    request: Request;
    respondWith(reply: Promise<Response>): void;
}
export interface WorkerScope {
    registration: { scope: string };
    addEventListener(type: string, handler: (event: never) => void): void;
    skipWaiting(): void;
    clients: { claim(): Promise<void> | void };
}
export interface WorkerCaches {
    open(name: string): Promise<{ addAll(urls: string[]): Promise<void> }>;
    keys(): Promise<string[]>;
    delete(name: string): Promise<boolean>;
    match(request: string): Promise<Response | undefined>;
}

export function setUpWorker(
    scope: WorkerScope,
    caches: WorkerCaches,
    network: (request: Request) => Promise<Response>,
    cacheName: string,
): void {
    const at = (path: string): string => new URL(path, scope.registration.scope).href;
    scope.addEventListener("install", ((event: WorkerEvent) => {
        scope.skipWaiting();
        event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(PRECACHE.map(at))));
    }) as never);
    scope.addEventListener("activate", ((event: WorkerEvent) => {
        event.waitUntil(
            caches
                .keys()
                .then((names: string[]) => Promise.all(names.filter((n) => n !== cacheName).map((n) => caches.delete(n))))
                .then(() => scope.clients.claim()),
        );
    }) as never);
    scope.addEventListener("fetch", ((event: FetchEvent) => {
        if (event.request.mode !== "navigate") {
            return;
        }
        event.respondWith(
            network(event.request).catch(async () => (await caches.match(at(OFFLINE_PATH))) ?? Response.error()),
        );
    }) as never);
}

// Registers the worker by a relative address, so it works under a sub-path. A browser without
// service workers, or a failed registration, leaves the web view as a normal page.
export async function registerWorker(nav: { serviceWorker?: { register(url: string): Promise<unknown> } }): Promise<void> {
    try {
        await nav.serviceWorker?.register("./sw.js");
    } catch {
        // No offline page; the page itself still works.
    }
}
