import type { VNode } from "preact";
import type { PageId } from "./sidebar.tsx";

interface Placeholder {
    title: string;
    text: string;
}

const PLACEHOLDERS: Record<PageId, Placeholder> = {
    goal: { title: "Sprint goal", text: "The sprint goal page shows the current goal here. It is not built yet." },
    grooming: { title: "Grooming", text: "The grooming page is not built yet." },
    timeline: { title: "Timeline", text: "The timeline shows epics and stories over sprints here. It is not built yet." },
    settings: { title: "Settings", text: "Raiden settings show here. They are not built yet." },
};

export function PlaceholderPage({ page }: { page: PageId }): VNode {
    const { title, text } = PLACEHOLDERS[page];
    return (
        <section class="rd-page" aria-labelledby={`rd-page-${page}`}>
            <h1 class="rd-text-view-title" id={`rd-page-${page}`}>
                {title}
            </h1>
            <p class="rd-page__placeholder">{text}</p>
        </section>
    );
}
