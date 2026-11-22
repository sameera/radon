import type { VNode } from "preact";

// The banner across the top of a host that has no page of its own around Raiden. It carries the
// Raiden mark, supplied by the host so this library imports nothing from an app, then the word.
export function Banner({ icon }: { icon: string }): VNode {
    return (
        <header class="rd-banner">
            <img class="rd-banner__mark" src={icon} alt="" />
            <span class="rd-banner__word rd-text-wordmark">Raiden</span>
        </header>
    );
}
