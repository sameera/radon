import type { ComponentChildren, VNode } from "preact";
import { GoalIcon, GroomingIcon, SettingsIcon, SidebarIcon, TimelineIcon } from "./icons.tsx";
import { Tooltip } from "./tooltip.tsx";
import { PROJECT_NAME, SPRINT } from "./sample.ts";

export type PageId = "goal" | "grooming" | "timeline" | "settings";

interface NavItemProps {
    page: PageId;
    current: PageId;
    onSelect: (page: PageId) => void;
    icon: VNode;
    label: string;
    // A count badge. It shows only when above zero. `countWords` is how it reads aloud.
    count?: number;
    countWords?: string;
    // The short count text for the tooltip, for example "3 not planned".
    tipCount?: string;
    children: ComponentChildren;
}

function NavItem({ page, current, onSelect, icon, label, count = 0, countWords, tipCount, children }: NavItemProps): VNode {
    const tip: string = count > 0 && tipCount ? `${label}, ${tipCount}` : label;
    return (
        <Tooltip text={tip}>
            <button
                type="button"
                class="rd-nav-item"
                aria-label={count > 0 && countWords ? `${label}, ${countWords}` : label}
                data-label={label}
                aria-current={page === current ? "page" : undefined}
                onClick={() => onSelect(page)}
            >
                {icon}
                <span class="rd-nav-item__label">{children}</span>
                {count > 0 && (
                    <span class="rd-nav-item__count" aria-hidden="true">
                        {count}
                    </span>
                )}
            </button>
        </Tooltip>
    );
}

interface SidebarProps {
    current: PageId;
    onSelect: (page: PageId) => void;
    collapsed: boolean;
    onToggle: () => void;
    // The epics not planned in any goal. It shows on the Grooming item.
    unplanned?: number;
}

export function Sidebar({ current, onSelect, collapsed, onToggle, unplanned = 0 }: SidebarProps): VNode {
    const item = { current, onSelect };
    return (
        <nav class={`rd-nav${collapsed ? " rd-nav--collapsed" : ""}`} aria-label="Raiden pages">
            <button
                type="button"
                class="rd-icon-btn rd-nav__toggle"
                aria-expanded={!collapsed}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                onClick={onToggle}
            >
                <SidebarIcon />
            </button>
            <div class="rd-nav__brand">
                <span class="rd-nav__word">Raiden</span>
                <span class="rd-nav__proj" title={`Project: ${PROJECT_NAME}`}>
                    {PROJECT_NAME}
                </span>
            </div>
            <div class="rd-nav__group">Sprint</div>
            <NavItem page="goal" icon={<GoalIcon />} label="Sprint goal" {...item}>
                Sprint goal
            </NavItem>
            <NavItem page="grooming" icon={<GroomingIcon />} label="Grooming"
                count={unplanned}
                tipCount={`${unplanned} not planned`}
                countWords={`${unplanned} ${unplanned === 1 ? "epic" : "epics"} not planned`}
                {...item}
            >
                Grooming
            </NavItem>
            <div class="rd-nav__group">Roadmap</div>
            <NavItem page="timeline" icon={<TimelineIcon />} label="Timeline" {...item}>
                Timeline
            </NavItem>
            <div class="rd-nav__sep" />
            <NavItem page="settings" icon={<SettingsIcon />} label="Settings" {...item}>
                Settings
            </NavItem>
            <div class="rd-nav__foot">
                <b>{SPRINT.current}</b> ends in {SPRINT.daysLeft} days
                <br />
                Next: {SPRINT.next.name}, {SPRINT.next.dates}
            </div>
        </nav>
    );
}
