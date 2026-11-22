// Entry of the extension's background service worker.
import { createWorker } from "./worker.ts";
import { teamSettings } from "./team-settings.ts";

const worker = createWorker({
    settings: teamSettings(),
    extensionId: chrome.runtime.id,
    redirectUri: chrome.identity.getRedirectURL(),
    launch: async (url: string): Promise<string | undefined> => chrome.identity.launchWebAuthFlow({ url, interactive: true }),
    storage: {
        get: async (key: string): Promise<unknown> => (await chrome.storage!.local.get(key))[key],
        set: async (key: string, value: unknown): Promise<void> => {
            await chrome.storage!.local.set({ [key]: value });
        },
    },
    fetch: (input, init) => fetch(input, init),
});

chrome.runtime.onMessage.addListener((message: unknown, sender: { id?: string }, respond: (r: unknown) => void) => {
    const pending: Promise<unknown> | null = worker.handle(message, sender);
    if (!pending) {
        return false;
    }
    void pending.then(respond);
    return true;
});
