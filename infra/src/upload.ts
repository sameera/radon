// Uploads the web view build: only the files whose content changed, each with its content type
// and a revalidate header, the page last, so a page from one build rarely loads the script of
// another, and removed files after the page (D10, D11).

export interface LocalFile {
    key: string;
    md5: string;
    path: string;
}

export const PAGE: string = "index.html";

const TYPES: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json",
    ".webmanifest": "application/manifest+json",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
    ".woff": "font/woff",
};

// The correct type for every file, so Chrome offers to install the web view (G21). A file with an
// unknown type stops the upload instead of being served wrong.
export function contentType(key: string): string {
    const dot: number = key.lastIndexOf(".");
    const type: string | undefined = dot >= 0 ? TYPES[key.slice(dot).toLowerCase()] : undefined;
    if (!type) {
        throw new Error(`no content type known for ${key}`);
    }
    return type;
}

// Every hosted file tells the browser to revalidate on each load: the file names carry no content
// hash, so none may be kept without asking (D11, G24).
export const CACHE_CONTROL: string = "no-cache";

export interface UploadPlan<F extends { key: string; md5: string }> {
    // Changed files, the page last.
    uploads: F[];
    // Stored files the new build no longer has, deleted only after the page (G25).
    deletes: string[];
}

// remote maps each stored key to the MD5 of its content.
export function planUpload<F extends { key: string; md5: string }>(local: F[], remote: Map<string, string>): UploadPlan<F> {
    const changed: F[] = local.filter((f) => remote.get(f.key) !== f.md5);
    const uploads: F[] = [...changed.filter((f) => f.key !== PAGE), ...changed.filter((f) => f.key === PAGE)];
    const keep: Set<string> = new Set(local.map((f) => f.key));
    const deletes: string[] = [...remote.keys()].filter((k) => !keep.has(k)).sort();
    return { uploads, deletes };
}
