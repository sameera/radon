import type { VNode } from "preact";
import type { Repo } from "./repo.tsx";

// The banner across the top of a host that has no page of its own around Raiden. It carries the
// Raiden mark, supplied by the host so this library imports nothing from an app, then the word.
// While someone is signed in it also carries the repository drop-down (D5).
export function Banner({ icon, picker }: { icon: string; picker?: VNode }): VNode {
    return (
        <header class="rd-banner">
            <img class="rd-banner__mark" src={icon} alt="" />
            <span class="rd-banner__word rd-text-wordmark">Raiden</span>
            {picker}
        </header>
    );
}

const key = (repo: Repo): string => `${repo.owner}/${repo.name}`;

interface RepoPickerProps {
    repos: Repo[];
    current: Repo | null;
    onPick: (repo: Repo) => void;
}

// The browser's own list control, styled with the design system. It gives type-to-jump, keyboard
// and screen-reader support for a long list without any code of ours.
export function RepoPicker({ repos, current, onPick }: RepoPickerProps): VNode {
    const inList: boolean = current !== null && repos.some((r: Repo) => key(r) === key(current));
    return (
        <select
            class="rd-select rd-banner__repo"
            aria-label="Repository"
            value={current ? key(current) : ""}
            onChange={(e) => {
                const picked: Repo | undefined = repos.find((r: Repo) => key(r) === e.currentTarget.value);
                if (picked) {
                    onPick(picked);
                }
            }}
        >
            {(current === null || !inList) && (
                <option value={current ? key(current) : ""}>{current ? key(current) : "Choose a repository"}</option>
            )}
            {repos.map((r: Repo) => (
                <option value={key(r)} key={key(r)}>
                    {key(r)}
                </option>
            ))}
        </select>
    );
}
