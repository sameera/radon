import type { VNode } from "preact";
import { useState } from "preact/hooks";
import { GroomingPage } from "./grooming.tsx";
import { PlaceholderPage } from "./pages.tsx";
import { INITIATIVES } from "./sample.ts";
import { unplannedEpicCount } from "./plan.ts";
import { useSession, type SessionStore } from "./session.ts";
import { Sidebar, type PageId } from "./sidebar.tsx";

export interface AppProps {
    session: SessionStore;
    repoUrl?: string;
    showIssues: boolean;
    onShowIssues: (value: boolean) => void;
    sidebarCollapsed?: boolean;
    onSidebarCollapsed?: (value: boolean) => void;
    backlogWidth?: number;
    onBacklogWidth?: (value: number) => void;
}

// The current page is in-memory state: switching never touches the address, and a reload
// always opens Grooming. The session state lives in the store, so it survives page switches.
export function App({
    session,
    repoUrl,
    showIssues: initialShowIssues,
    onShowIssues,
    sidebarCollapsed = false,
    onSidebarCollapsed,
    backlogWidth: initialWidth,
    onBacklogWidth,
}: AppProps): VNode {
    const [backlogWidth, setBacklogWidth] = useState<number | undefined>(initialWidth);
    const [collapsed, setCollapsed] = useState<boolean>(sidebarCollapsed);
    const [page, setPage] = useState<PageId>("grooming");
    const [showIssues, setShowIssues] = useState<boolean>(initialShowIssues);
    const state = useSession(session);
    return (
        <div class="rd-app">
            <Sidebar
                current={page}
                unplanned={unplannedEpicCount(INITIATIVES, state)}
                onSelect={setPage}
                collapsed={collapsed}
                onToggle={() => {
                    setCollapsed(!collapsed);
                    onSidebarCollapsed?.(!collapsed);
                }}
            />
            <main class="rd-main">
                {page === "grooming" ? (
                    <GroomingPage
                        session={session}
                        repoUrl={repoUrl}
                        state={state}
                        showIssues={showIssues}
                        backlogWidth={backlogWidth}
                        onBacklogWidth={(value: number, final: boolean) => {
                            setBacklogWidth(value);
                            if (final) {
                                onBacklogWidth?.(value);
                            }
                        }}
                        onShowIssues={(value: boolean) => {
                            setShowIssues(value);
                            onShowIssues(value);
                        }}
                    />
                ) : (
                    <PlaceholderPage page={page} />
                )}
            </main>
        </div>
    );
}
