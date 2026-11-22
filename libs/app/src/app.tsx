import type { VNode } from "preact";
import { useMemo, useState } from "preact/hooks";
import { GatewayContext, type GitHubGateway } from "./gateway.ts";
import { Account } from "./account.tsx";
import { useSignIn, type SignInController } from "./signin.ts";
import { Banner } from "./banner.tsx";
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
    // When set, the shell draws the banner above the sidebar and the page. The extension never sets it.
    banner?: { icon: string };
    signIn?: SignInController;
    gateway?: GitHubGateway;
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
    banner,
    signIn,
    gateway,
}: AppProps): VNode {
    const [backlogWidth, setBacklogWidth] = useState<number | undefined>(initialWidth);
    const [collapsed, setCollapsed] = useState<boolean>(sidebarCollapsed);
    const [page, setPage] = useState<PageId>("grooming");
    const [showIssues, setShowIssues] = useState<boolean>(initialShowIssues);
    const state = useSession(session);
    const auth = useSignIn(signIn);
    const protectedGateway = useMemo<GitHubGateway | undefined>(() => {
        if (!gateway || !signIn) {
            return gateway;
        }
        return {
            async request(request) {
                if (!signIn.get().login) {
                    return { ok: false, kind: "sign-in-needed" };
                }
                const result = await gateway.request(request);
                if (!result.ok && result.kind === "sign-in-needed") {
                    signIn.check();
                }
                return result;
            },
        };
    }, [gateway, signIn]);
    const account = signIn && auth ? <Account signIn={signIn} state={auth} /> : undefined;
    const layout: VNode = signIn && !auth?.login ? (
        <main class="rd-sign-in">
            {account}
        </main>
    ) : (
        <div class={banner ? "rd-app rd-app--framed" : "rd-app"}>
            <Sidebar
                current={page}
                unplanned={unplannedEpicCount(INITIATIVES, state)}
                onSelect={setPage}
                account={account}
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
    const framed: VNode = banner ? (
        <div class="rd-frame">
            <Banner icon={banner.icon} />
            {layout}
        </div>
    ) : (
        layout
    );
    return <GatewayContext.Provider value={protectedGateway}>{framed}</GatewayContext.Provider>;
}
