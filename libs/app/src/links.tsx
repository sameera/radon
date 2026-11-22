import type { ComponentChildren, VNode } from "preact";

// The address of a page in the current repository, or null when no repository is known.
export function repoPage(repoUrl: string | undefined, path: string): string | null {
    return repoUrl ? `${repoUrl.replace(/\/+$/, "")}/${path}` : null;
}

interface ExternalLinkProps {
    href: string;
    class?: string;
    children: ComponentChildren;
}

// A native link that opens GitHub in a new tab with no handle back to Raiden. It is not
// draggable, so a drag that starts on it drags the row it sits in. The click stays inside Raiden:
// GitHub's own handlers listen on the page and must not take over the click. The browser still
// opens the link.
export function ExternalLink({ href, class: className, children }: ExternalLinkProps): VNode {
    return (
        <a
            class={className}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            draggable={false}
            onClick={(e: MouseEvent) => e.stopPropagation()}
        >
            {children}
        </a>
    );
}
