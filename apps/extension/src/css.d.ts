declare module "*.css" {
    const text: string;
    export default text;
}

declare const chrome: {
    runtime: { getURL(path: string): string };
    storage?: {
        local: {
            get(key: string): Promise<Record<string, unknown>>;
            set(items: Record<string, unknown>): Promise<void>;
        };
    };
};
