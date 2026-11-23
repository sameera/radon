import { useEffect } from "preact/hooks";
import type { PreferenceStore } from "./mount.tsx";
import type { Repo, RepoStore } from "./repo.tsx";

export const REMEMBERED: string = "repository";

// The stored shape: the login of the person who wrote it, plus the repository's owner, name and
// address. Never a token or other sign-in data (G14).
export interface Remembered extends Repo {
    login: string;
}

export function readRemembered(value: unknown, login: string): Repo | null {
    if (typeof value !== "object" || value === null) {
        return null;
    }
    const v = value as Record<string, unknown>;
    if (
        v.login !== login ||
        typeof v.owner !== "string" ||
        typeof v.name !== "string" ||
        typeof v.url !== "string"
    ) {
        return null;
    }
    return { owner: v.owner, name: v.name, url: v.url };
}

export function writeRemembered(prefs: PreferenceStore | undefined, login: string, repo: Repo): void {
    const value: Remembered = { login, owner: repo.owner, name: repo.name, url: repo.url };
    void prefs?.set(REMEMBERED, value);
}

// The web view's repository source, part one (D6): once sign-in resolves to a username, the
// remembered repository, if that person wrote it, becomes current at once. A value another person
// wrote is ignored. Signing out leaves the context at "none". Does nothing unless `enabled`.
export function useRemembered(
    enabled: boolean,
    login: string | null | undefined,
    prefs: PreferenceStore | undefined,
    store: RepoStore | undefined,
): void {
    useEffect(() => {
        if (!enabled || !store) {
            return;
        }
        if (!login) {
            store.set(null);
            return;
        }
        let live = true;
        void prefs?.get(REMEMBERED).then((value: unknown) => {
            const repo: Repo | null = readRemembered(value, login);
            // A pick made while this read was pending wins.
            if (live && repo && store.get() === null) {
                store.set(repo);
            }
        });
        return () => {
            live = false;
        };
    }, [enabled, login, prefs, store]);
}
