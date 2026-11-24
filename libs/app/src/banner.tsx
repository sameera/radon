import type { RefObject, VNode } from "preact";
import type { Repo } from "./repo.tsx";

// The banner across the top of a host that has no page of its own around Raiden. It carries the
// Raiden mark, supplied by the host so this library imports nothing from an app, then the word.
// While someone is signed in it also carries the repository breadcrumb and, at the right end,
// the account avatar and its menu.
export function Banner({ icon, picker, account }: { icon: string; picker?: VNode; account?: VNode }): VNode {
    return (
        <header class="rd-banner">
            <img class="rd-banner__mark" src={icon} alt="" />
            <span class="rd-banner__word rd-text-wordmark">Raiden</span>
            {picker}
            {account}
        </header>
    );
}

interface RepoBreadcrumbProps {
    // The shared repository, not the loaded list, so a current repository a stale list lacks still shows (D2).
    current: Repo | null;
    expanded?: boolean;
    onOpen?: () => void;
    buttonRef?: RefObject<HTMLButtonElement | null>;
}

// The current repository as owner, a slash, then name, like GitHub's header breadcrumb (D1). It is
// one button: the owner is no separate target. With no repository it shows the prompt instead (D2).
export function RepoBreadcrumb({ current, expanded = false, onOpen, buttonRef }: RepoBreadcrumbProps): VNode {
    return (
        <button
            ref={buttonRef}
            type="button"
            class="rd-breadcrumb rd-text-body"
            aria-label={current ? `Repository: ${current.owner}/${current.name}` : "Pick a repository"}
            aria-haspopup="listbox"
            aria-expanded={expanded}
            onClick={() => onOpen?.()}
        >
            {current ? (
                <>
                    <span class="rd-breadcrumb__owner">{current.owner}</span>
                    <span class="rd-breadcrumb__sep" aria-hidden="true">/</span>
                    <span class="rd-breadcrumb__name">{current.name}</span>
                </>
            ) : (
                <span class="rd-breadcrumb__prompt">Pick a repository</span>
            )}
        </button>
    );
}
