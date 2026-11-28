import type { VNode } from "preact";
import { useRef } from "preact/hooks";
import type { LiveSource } from "./livebacklog.tsx";
import { BandPage } from "./bands.tsx";

interface GroomingProps {
    backlogWidth?: number;
    onBacklogWidth?: (value: number, final: boolean) => void;
    // Set when the host can read GitHub as a signed-in person.
    live?: LiveSource;
}

export const DEFAULT_BACKLOG_WIDTH: number = 360;
const MIN_BACKLOG: number = 240;
const MIN_GOALS: number = 360;
const DIVIDER_WIDTH: number = 16;
const FALLBACK_MAX: number = 720;
const STEP: number = 16;
const BIG_STEP: number = 64;

// The preferred width is the lead's choice. The shown width is that choice fitted between the
// two panels' minimum widths at the current size.
export function limits(space: number): { min: number; max: number } {
    return { min: MIN_BACKLOG, max: space > 0 ? Math.max(MIN_BACKLOG, space - MIN_GOALS - DIVIDER_WIDTH) : FALLBACK_MAX };
}
export function fit(preferred: number, space: number): number {
    const { min, max } = limits(space);
    return Math.min(max, Math.max(min, preferred));
}

interface DividerProps {
    width: number;
    min: number;
    max: number;
    // Which side of the divider the backlog is on. The arrow keys and a drag move the divider in
    // their own direction, so with the backlog on the right, Left widens it (D16).
    side?: "left" | "right";
    // The width a reset (double click or Enter) returns to.
    defaultWidth?: number;
    onChange: (value: number, final: boolean) => void;
}

export function Divider({ width, min, max, side = "left", defaultWidth = DEFAULT_BACKLOG_WIDTH, onChange }: DividerProps): VNode {
    const drag = useRef<{ x: number; width: number } | null>(null);
    const clamp = (v: number): number => Math.min(max, Math.max(min, v));
    // How far the backlog grows when the divider moves `dx` to the right.
    const grow = (dx: number): number => (side === "left" ? dx : -dx);
    return (
        <div
            class="rd-divider"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize backlog"
            aria-valuenow={width}
            aria-valuemin={min}
            aria-valuemax={max}
            tabIndex={0}
            onPointerDown={(e: PointerEvent) => {
                drag.current = { x: e.clientX, width };
                (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
            }}
            onPointerMove={(e: PointerEvent) => {
                if (drag.current) {
                    onChange(clamp(drag.current.width + grow(e.clientX - drag.current.x)), false);
                }
            }}
            onPointerUp={(e: PointerEvent) => {
                if (drag.current) {
                    onChange(clamp(drag.current.width + grow(e.clientX - drag.current.x)), true);
                    drag.current = null;
                    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
                }
            }}
            onDblClick={() => onChange(clamp(defaultWidth), true)}
            onKeyDown={(e: KeyboardEvent) => {
                const step: number = e.shiftKey ? BIG_STEP : STEP;
                const next: number | null =
                    e.key === "ArrowLeft"
                        ? width + grow(-step)
                        : e.key === "ArrowRight"
                          ? width + grow(step)
                          : e.key === "Home"
                            ? min
                            : e.key === "End"
                              ? max
                              : e.key === "Enter"
                                ? defaultWidth
                                : null;
                if (next !== null) {
                    e.preventDefault();
                    onChange(clamp(next), true);
                }
            }}
        />
    );
}

// For a signed-in lead with a live GitHub connection, Grooming is the band view. A host with no
// live connection shows only a note: there is no sample page (story #104, D10, G18, G23).
export function GroomingPage({ live, backlogWidth, onBacklogWidth }: GroomingProps): VNode {
    return live ? (
        <BandPage live={live} backlogWidth={backlogWidth} onBacklogWidth={onBacklogWidth} />
    ) : (
        <section class="rd-groom" aria-labelledby="rd-groom-title">
            <header class="rd-groom__header">
                <h1 class="rd-text-view-title" id="rd-groom-title">
                    Backlog grooming
                </h1>
            </header>
            <p class="rd-groom-note" role="note">
                Grooming needs a GitHub sign-in. Sign in to see the repository's sprints, goals and backlog.
            </p>
        </section>
    );
}
