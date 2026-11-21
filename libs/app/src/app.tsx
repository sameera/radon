import type { VNode } from "preact";
import { useState } from "preact/hooks";
import { PlaceholderPage } from "./pages.tsx";
import { Sidebar, type PageId } from "./sidebar.tsx";

// The current page is in-memory state: switching never touches the address, and a reload
// always opens Grooming.
export function App(): VNode {
    const [page, setPage] = useState<PageId>("grooming");
    return (
        <div class="rd-app">
            <Sidebar current={page} onSelect={setPage} />
            <main class="rd-main">
                <PlaceholderPage page={page} />
            </main>
        </div>
    );
}
