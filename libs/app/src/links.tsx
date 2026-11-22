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

interface IssueRefProps {
    repoUrl?: string;
    num: number;
    title: string;
}

// The number and title of one issue. The whole reference is a link to the issue in the current
// repository. With no repository address it is plain text.
export function IssueRef({ repoUrl, num, title }: IssueRefProps): VNode {
    const body: VNode = (
        <>
            <span class="rd-ref__num">#{num}</span>
            <span class="rd-ref__title">{title}</span>
        </>
    );
    const href: string | null = repoPage(repoUrl, `issues/${num}`);
    return href === null ? <span class="rd-ref">{body}</span> : <ExternalLink class="rd-ref" href={href}>{body}</ExternalLink>;
}
