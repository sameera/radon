import type { ComponentChildren, VNode } from "preact";
import { GoalIcon, GroomingIcon, SettingsIcon, SidebarIcon, TimelineIcon } from "./icons.tsx";
import { PROJECT_NAME, SPRINT } from "./sample.ts";

export type PageId = "goal" | "grooming" | "timeline" | "settings";

interface NavItemProps {
    page: PageId;
    current: PageId;
    onSelect: (page: PageId) => void;
    icon: VNode;
    label: string;
    children: ComponentChildren;
}

function NavItem({ page, current, onSelect, icon, label, children }: NavItemProps): VNode {
    return (
        <button
            type="button"
            class="rd-nav-item"
            aria-label={label}
            data-label={label}
            aria-current={page === current ? "page" : undefined}
            onClick={() => onSelect(page)}
        >
            {icon}
            <span class="rd-nav-item__label">{children}</span>
        </button>
    );
}

interface SidebarProps {
    current: PageId;
    onSelect: (page: PageId) => void;
    collapsed: boolean;
    onToggle: () => void;
}

export function Sidebar({ current, onSelect, collapsed, onToggle }: SidebarProps): VNode {
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
            <NavItem page="grooming" icon={<GroomingIcon />} label="Grooming" {...item}>
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
