declare module "*.css" {
    const text: string;
    export default text;
}

// The small part of the Chrome extension API that Raiden uses.
declare const chrome: {
    runtime: {
        id: string;
        getURL(path: string): string;
        sendMessage(message: unknown): Promise<unknown>;
        onMessage: {
            addListener(
                listener: (message: unknown, sender: { id?: string }, respond: (response: unknown) => void) => boolean,
            ): void;
        };
    };
    identity: {
        getRedirectURL(): string;
        launchWebAuthFlow(details: { url: string; interactive: boolean }): Promise<string | undefined>;
    };
    storage?: {
        local: {
            get(key: string): Promise<Record<string, unknown>>;
            set(items: Record<string, unknown>): Promise<void>;
        };
    };
};
