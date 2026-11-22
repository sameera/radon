import type { VNode } from "preact";
import { useMemo, useState } from "preact/hooks";
import { GatewayContext, type GitHubGateway } from "./gateway.ts";
import { Account } from "./account.tsx";
import { useSignIn, type SignInController } from "./signin.ts";
import { Banner, RepoPicker } from "./banner.tsx";
import { GroomingPage } from "./grooming.tsx";
import { PlaceholderPage } from "./pages.tsx";
import { RepoContext, useRepo, useRepoStore, type RepoStore } from "./repo.tsx";
import { useRepoList } from "./repolist.ts";
import { REMEMBERED, useRemembered, writeRemembered } from "./remember.ts";
import type { PreferenceStore } from "./mount.tsx";
import { INITIATIVES } from "./sample.ts";
import { unplannedEpicCount } from "./plan.ts";
import { useSession, type SessionStore } from "./session.ts";
import { Sidebar, type PageId } from "./sidebar.tsx";

export interface AppProps {
    session: SessionStore;
    // The repository context. The host writes it; every page reads it (D1).
    repo: RepoStore;
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
    prefs?: PreferenceStore;
}

// The current page is in-memory state: switching never touches the address, and a reload
// always opens Grooming. The session state lives in the store, so it survives page switches.
function Shell({
    session,
    showIssues: initialShowIssues,
    onShowIssues,
    sidebarCollapsed = false,
    onSidebarCollapsed,
    backlogWidth: initialWidth,
    onBacklogWidth,
    banner,
    signIn,
    gateway,
    prefs,
}: Omit<AppProps, "repo">): VNode {
    const [backlogWidth, setBacklogWidth] = useState<number | undefined>(initialWidth);
    const [collapsed, setCollapsed] = useState<boolean>(sidebarCollapsed);
    const [page, setPage] = useState<PageId>("grooming");
    const [showIssues, setShowIssues] = useState<boolean>(initialShowIssues);
    const state = useSession(session);
    const current = useRepo();
    const repoStore = useRepoStore();
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
    // Only a host with a banner lets the person pick a repository, and only while signed in (G5, G6).
    const pickable: boolean = banner !== undefined;
    useRemembered(pickable, auth?.login, prefs, repoStore);
    const repos = useRepoList(pickable ? protectedGateway : undefined, auth?.login, (fresh) => {
        // A complete list without the current repository means the person lost it (D7).
        const now = repoStore?.get();
        if (now && !fresh.some((r) => r.owner === now.owner && r.name === now.name)) {
            repoStore?.set(null);
            void prefs?.set(REMEMBERED, null);
        }
    }, prefs);
    const account = signIn && auth ? <Account signIn={signIn} state={auth} /> : undefined;
    const layout: VNode = signIn && !auth?.login ? (
        <main class="rd-sign-in">
            {!current && <PickPrompt signedIn={false} />}
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
                {!current ? (
                    <PickPrompt signedIn={true} />
                ) : page === "grooming" ? (
                    <GroomingPage
                        session={session}
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
            <Banner
                icon={banner.icon}
                picker={
                    auth?.login ? (
                        <RepoPicker repos={repos} current={current} onPick={(repo) => {
                                repoStore?.set(repo);
                                writeRemembered(prefs, auth.login!, repo);
                            }} />
                    ) : undefined
                }
            />
            {layout}
        </div>
    ) : (
        layout
    );
    return <GatewayContext.Provider value={protectedGateway}>{framed}</GatewayContext.Provider>;
}

// What the main area shows while the current repository is "none" (D2). No page renders then.
function PickPrompt({ signedIn }: { signedIn: boolean }): VNode {
    return (
        <p class="rd-pick-prompt" role="status">
            {signedIn ? "Pick a repository to see its work." : "Sign in, then pick a repository."}
        </p>
    );
}

export function App(props: AppProps): VNode {
    const { repo, ...rest } = props;
    return (
        <RepoContext.Provider value={repo}>
            <Shell {...rest} />
        </RepoContext.Provider>
    );
}
