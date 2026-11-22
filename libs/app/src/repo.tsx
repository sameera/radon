import { createContext } from "preact";
import { useContext, useEffect, useState } from "preact/hooks";

// One repository: its owner, its name, and its github.com address.
export interface Repo {
    owner: string;
    name: string;
    url: string;
}

// The repository context (D1): the one shared, changeable holder of the current repository.
// A host writes it through its repository source. Any component reads it with useRepo() and
// re-renders when it changes. "none" is null.
export interface RepoStore {
    get(): Repo | null;
    set(repo: Repo | null): void;
    subscribe(listener: () => void): () => void;
}

export function sameRepo(a: Repo | null, b: Repo | null): boolean {
    return a === b || (a !== null && b !== null && a.owner === b.owner && a.name === b.name && a.url === b.url);
}

// Works out the repository from its web address, for example https://github.com/acme/widgets.
export function repoFromUrl(url: string | undefined): Repo | null {
    if (!url) {
        return null;
    }
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return null;
    }
    const [owner, name]: string[] = parsed.pathname.split("/").filter(Boolean);
    if (!owner || !name) {
        return null;
    }
    return { owner, name, url: `${parsed.origin}/${owner}/${name}` };
}

export function createRepoStore(initial: Repo | null = null): RepoStore {
    let current: Repo | null = initial;
    const listeners: Set<() => void> = new Set();
    return {
        get: () => current,
        set(repo: Repo | null): void {
            if (sameRepo(current, repo)) {
                return;
            }
            current = repo;
            listeners.forEach((l) => l());
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
    };
}

export const RepoContext = createContext<RepoStore | undefined>(undefined);

// The current repository, or null for "none". Re-renders the component when it changes.
export function useRepo(): Repo | null {
    const store: RepoStore | undefined = useContext(RepoContext);
    const [repo, setRepo] = useState<Repo | null>(store?.get() ?? null);
    useEffect(() => {
        if (!store) {
            return;
        }
        setRepo(store.get());
        return store.subscribe(() => setRepo(store.get()));
    }, [store]);
    return store ? repo : null;
}

export function useRepoStore(): RepoStore | undefined {
    return useContext(RepoContext);
}
