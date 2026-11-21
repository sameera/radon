import type { VNode } from "preact";

const SVG = { viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", "stroke-width": 1.5, "aria-hidden": true };

export function GoalIcon(): VNode {
    return (
        <svg {...SVG}>
            <circle cx="8" cy="8" r="6" />
            <circle cx="8" cy="8" r="3" />
        </svg>
    );
}
export function GroomingIcon(): VNode {
    return (
        <svg {...SVG} stroke-linecap="round" stroke-linejoin="round">
            <path d="M2 4h6M2 8h4M2 12h6" />
            <path d="M10 4.5h4v7h-4z" />
        </svg>
    );
}
export function TimelineIcon(): VNode {
    return (
        <svg {...SVG} stroke-linecap="round">
            <path d="M2.5 4h6M5.5 8h8M3.5 12h5" />
        </svg>
    );
}
export function SettingsIcon(): VNode {
    return (
        <svg {...SVG} stroke-linecap="round">
            <circle cx="8" cy="8" r="2.2" />
            <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" />
        </svg>
    );
}
