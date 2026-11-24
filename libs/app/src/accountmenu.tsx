import type { VNode } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { PersonIcon } from "./icons.tsx";

// GitHub's public picture for a username. It needs no token and no new permission (D2).
export function avatarUrl(login: string): string {
    return `https://avatars.githubusercontent.com/${encodeURIComponent(login)}?size=64`;
}

interface AccountMenuProps {
    login: string;
    // Absent when the host has no sign-out step. The menu would be empty, so the avatar is only a picture.
    onSignOut?: () => void;
    // The banner holds which of its menus is open, so at most one is (G16).
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

// The signed-in person's avatar at the right end of the banner. It opens a menu that closes itself
// on a click outside, on Escape, on Tab and when its item is chosen. The banner sits outside every
// page, so no page closes it (D3).
export function AccountMenu({ login, onSignOut, open, onOpenChange: setOpen }: AccountMenuProps): VNode {
    const [broken, setBroken] = useState<boolean>(false);
    const wrap = useRef<HTMLDivElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const item = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        setBroken(false);
    }, [login]);

    useEffect(() => {
        if (!open) {
            return;
        }
        item.current?.focus();
        const outside = (e: Event): void => {
            if (!wrap.current || !e.composedPath().includes(wrap.current)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", outside);
        return () => document.removeEventListener("mousedown", outside);
    }, [open]);

    const picture: VNode = broken ? (
        <PersonIcon />
    ) : (
        <img src={avatarUrl(login)} alt="" referrerpolicy="no-referrer" onError={() => setBroken(true)} />
    );
    if (!onSignOut) {
        return (
            <div class="rd-banner__account" role="img" aria-label={`Signed in as ${login}`}>
                <span class="rd-banner__avatar">{picture}</span>
            </div>
        );
    }

    const close = (focusTrigger: boolean): void => {
        setOpen(false);
        if (focusTrigger) {
            trigger.current?.focus();
        }
    };

    return (
        <div class="rd-menu-wrap rd-banner__account" ref={wrap}>
            <button
                ref={trigger}
                type="button"
                class="rd-banner__avatar"
                aria-label={`Account menu for ${login}`}
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={() => setOpen(!open)}
            >
                {picture}
            </button>
            {open && (
                <div
                    class="rd-menu"
                    role="menu"
                    aria-label="Account"
                    onKeyDown={(e: KeyboardEvent) => {
                        if (e.key === "Escape") {
                            e.preventDefault();
                            close(true);
                        } else if (e.key === "Tab") {
                            close(false);
                        }
                    }}
                >
                    <button
                        ref={item}
                        type="button"
                        role="menuitem"
                        class="rd-menu__item"
                        onClick={() => {
                            close(false);
                            onSignOut();
                        }}
                    >
                        Sign out
                    </button>
                </div>
            )}
        </div>
    );
}
