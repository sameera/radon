import type { ComponentChildren, VNode } from "preact";
import { GoalIcon, GroomingIcon, SettingsIcon, TimelineIcon } from "./icons.tsx";
import { PROJECT_NAME, SPRINT } from "./sample.ts";

export type PageId = "goal" | "grooming" | "timeline" | "settings";

interface NavItemProps {
    page: PageId;
    current: PageId;
    onSelect: (page: PageId) => void;
    icon: VNode;
    children: ComponentChildren;
}

function NavItem({ page, current, onSelect, icon, children }: NavItemProps): VNode {
    return (
        <button
            type="button"
            class="rd-nav-item"
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
}

export function Sidebar({ current, onSelect }: SidebarProps): VNode {
    const item = { current, onSelect };
    return (
        <nav class="rd-nav" aria-label="Raiden pages">
            <div class="rd-nav__brand">
                <span class="rd-nav__word">Raiden</span>
                <span class="rd-nav__proj" title={`Project: ${PROJECT_NAME}`}>
                    {PROJECT_NAME}
                </span>
            </div>
            <div class="rd-nav__group">Sprint</div>
            <NavItem page="goal" icon={<GoalIcon />} {...item}>
                Sprint goal
            </NavItem>
            <NavItem page="grooming" icon={<GroomingIcon />} {...item}>
                Grooming
            </NavItem>
            <div class="rd-nav__group">Roadmap</div>
            <NavItem page="timeline" icon={<TimelineIcon />} {...item}>
                Timeline
            </NavItem>
            <div class="rd-nav__sep" />
            <NavItem page="settings" icon={<SettingsIcon />} {...item}>
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
