import type { ComponentChildren, VNode } from "preact";
import { useEffect, useState } from "preact/hooks";

interface TooltipProps {
    text: string;
    children: ComponentChildren;
}

// Shows `text` beside the control while the pointer is over it or it has keyboard focus. Escape
// hides it until the pointer or the focus comes back. It never takes focus and never catches the
// pointer. It is hidden from assistive technology: the control's own name already says it.
export function Tooltip({ text, children }: TooltipProps): VNode {
    const [pointer, setPointer] = useState<boolean>(false);
    const [focus, setFocus] = useState<boolean>(false);
    const [dismissed, setDismissed] = useState<boolean>(false);
    const shown: boolean = (pointer || focus) && !dismissed;
    useEffect(() => {
        if (!shown) {
            return;
        }
        const onKey = (e: KeyboardEvent): void => {
            if (e.key === "Escape") {
                setDismissed(true);
            }
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [shown]);
    const update = (set: (v: boolean) => void, value: boolean, other: boolean): void => {
        set(value);
        if (!value && !other) {
            setDismissed(false);
        }
        if (value) {
            setDismissed(false);
        }
    };
    return (
        <span
            class="rd-tooltip-wrap"
            onMouseEnter={() => update(setPointer, true, focus)}
            onMouseLeave={() => update(setPointer, false, focus)}
            onFocusIn={() => update(setFocus, true, pointer)}
            onFocusOut={() => update(setFocus, false, pointer)}
        >
            {children}
            {shown && (
                <span class="rd-tooltip" aria-hidden="true">
                    {text}
                </span>
            )}
        </span>
    );
}
