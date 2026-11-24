import type { VNode } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { RepoBreadcrumb } from "./banner.tsx";
import type { Repo } from "./repo.tsx";

const address = (repo: Repo): string => `${repo.owner}/${repo.name}`;

// The match rule (D4): an entry stays when its "owner/name" contains the typed text, case and
// outer spaces ignored. Empty text keeps every entry. Order is the loaded list's own.
export function matchRepos(repos: Repo[], text: string): Repo[] {
    const needle: string = text.trim().toLowerCase();
    if (!needle) {
        return repos;
    }
    return repos.filter((r: Repo) => address(r).toLowerCase().includes(needle));
}

let menus: number = 0;

interface RepoMenuProps {
    // The shared repository. The breadcrumb shows it; the list marks it.
    current: Repo | null;
    // The loaded list, read in memory. The menu never fetches (D5).
    repos: Repo[];
    loading: boolean;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onPick: (repo: Repo) => void;
}

// The breadcrumb and the searchable repository menu it opens (D3): a search box with a
// single-choice list. Focus stays in the search box; Up and Down move the highlight, Enter or a
// click picks. Escape, a click outside, Tab and a pick close it.
export function RepoMenu({ current, repos, loading, open, onOpenChange, onPick }: RepoMenuProps): VNode {
    const [text, setText] = useState<string>("");
    const [active, setActive] = useState<number>(0);
    const wrap = useRef<HTMLDivElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const input = useRef<HTMLInputElement>(null);
    const list = useRef<HTMLUListElement>(null);
    const base: string = useMemo<string>(() => `rd-repo-menu-${++menus}`, []);
    const shown: Repo[] = useMemo<Repo[]>(() => matchRepos(repos, text), [repos, text]);
    const highlight: number = shown.length === 0 ? -1 : Math.min(active, shown.length - 1);

    useEffect(() => {
        if (!open) {
            return;
        }
        input.current?.focus();
        const outside = (e: Event): void => {
            if (!wrap.current || !e.composedPath().includes(wrap.current)) {
                onOpenChange(false);
            }
        };
        document.addEventListener("mousedown", outside);
        return () => document.removeEventListener("mousedown", outside);
    }, [open]);

    useEffect(() => {
        if (open && highlight >= 0) {
            const row: Element | undefined = list.current?.children[highlight];
            (row as HTMLElement | undefined)?.scrollIntoView?.({ block: "nearest" });
        }
    }, [open, highlight]);

    const close = (focusTrigger: boolean): void => {
        onOpenChange(false);
        if (focusTrigger) {
            trigger.current?.focus();
        }
    };
    const choose = (repo: Repo): void => {
        close(true);
        if (!current || address(current) !== address(repo)) {
            onPick(repo);
        }
    };

    const message: string | null =
        shown.length > 0 ? null : repos.length > 0 ? "No repository matches" : loading ? "Loading repositories" : "No repositories to show";
    const optionId = (i: number): string => `${base}-opt-${i}`;

    return (
        <div class="rd-menu-wrap rd-banner__repo" ref={wrap}>
            <RepoBreadcrumb
                current={current}
                expanded={open}
                buttonRef={trigger}
                onOpen={() => {
                    if (!open) {
                        setText("");
                        setActive(0);
                    }
                    onOpenChange(!open);
                }}
            />
            {open && (
                <div class="rd-menu rd-menu--start rd-search-menu">
                    <input
                        ref={input}
                        class="rd-input rd-search-menu__input"
                        type="text"
                        role="combobox"
                        aria-label="Search repositories"
                        aria-expanded="true"
                        aria-autocomplete="list"
                        aria-controls={`${base}-list`}
                        aria-activedescendant={highlight >= 0 ? optionId(highlight) : undefined}
                        placeholder="Find a repository"
                        autocomplete="off"
                        spellcheck={false}
                        value={text}
                        onInput={(e) => {
                            setText(e.currentTarget.value);
                            setActive(0);
                        }}
                        onKeyDown={(e: KeyboardEvent) => {
                            if (e.key === "ArrowDown") {
                                e.preventDefault();
                                setActive(Math.min(highlight + 1, shown.length - 1));
                            } else if (e.key === "ArrowUp") {
                                e.preventDefault();
                                setActive(Math.max(highlight - 1, 0));
                            } else if (e.key === "Enter") {
                                e.preventDefault();
                                if (highlight >= 0) {
                                    choose(shown[highlight]);
                                }
                            } else if (e.key === "Escape") {
                                e.preventDefault();
                                e.stopPropagation();
                                close(true);
                            } else if (e.key === "Tab") {
                                close(false);
                            }
                        }}
                    />
                    {message ? (
                        <p class="rd-search-menu__status rd-text-body" role="status">
                            {message}
                        </p>
                    ) : (
                        <ul ref={list} id={`${base}-list`} class="rd-search-menu__list" role="listbox" aria-label="Repositories">
                            {shown.map((repo: Repo, i: number) => (
                                <li
                                    key={address(repo)}
                                    id={optionId(i)}
                                    role="option"
                                    aria-selected={current !== null && address(current) === address(repo)}
                                    class={i === highlight ? "rd-search-menu__option rd-search-menu__option--active rd-text-body" : "rd-search-menu__option rd-text-body"}
                                    onMouseDown={(e: MouseEvent) => e.preventDefault()}
                                    onClick={() => choose(repo)}
                                >
                                    {address(repo)}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
