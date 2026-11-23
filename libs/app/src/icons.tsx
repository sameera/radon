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

export function ChevronIcon({ open }: { open: boolean }): VNode {
    return (
        <svg {...SVG} stroke-linecap="round" stroke-linejoin="round" style={open ? undefined : "transform: rotate(-90deg)"}>
            <path d="M4 6l4 4 4-4" />
        </svg>
    );
}

export function MoreIcon(): VNode {
    return (
        <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <circle cx="3" cy="8" r="1.3" />
            <circle cx="8" cy="8" r="1.3" />
            <circle cx="13" cy="8" r="1.3" />
        </svg>
    );
}
export function GripIcon(): VNode {
    return (
        <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <circle cx="6" cy="4" r="1.1" />
            <circle cx="10" cy="4" r="1.1" />
            <circle cx="6" cy="8" r="1.1" />
            <circle cx="10" cy="8" r="1.1" />
            <circle cx="6" cy="12" r="1.1" />
            <circle cx="10" cy="12" r="1.1" />
        </svg>
    );
}
export function PlusIcon(): VNode {
    return (
        <svg {...SVG} stroke-linecap="round" aria-hidden="true">
            <path d="M8 3v10M3 8h10" />
        </svg>
    );
}
export function SidebarIcon(): VNode {
    return (
        <svg {...SVG} stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="3" width="12" height="10" rx="1.5" />
            <path d="M6 3v10" />
        </svg>
    );
}
export function CloseIcon(): VNode {
    return (
        <svg {...SVG} stroke-linecap="round">
            <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
    );
}

// A neutral person mark. It stands in for an avatar picture that did not load.
export function PersonIcon(): VNode {
    return (
        <svg {...SVG} stroke-linecap="round" stroke-linejoin="round">
            <circle cx="8" cy="5.5" r="2.5" />
            <path d="M3 13.5c0-2.5 2.2-4 5-4s5 1.5 5 4" />
        </svg>
    );
}
