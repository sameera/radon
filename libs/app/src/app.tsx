import type { VNode } from "preact";
import { useMemo, useState } from "preact/hooks";
import { GatewayContext, type GitHubGateway } from "./gateway.ts";
import { Account } from "./account.tsx";
import { useSignIn, type SignInController } from "./signin.ts";
import { Banner } from "./banner.tsx";
import { RepoMenu } from "./repomenu.tsx";
import { AccountMenu } from "./accountmenu.tsx";
import { GroomingPage } from "./grooming.tsx";
import { PlaceholderPage } from "./pages.tsx";
import { RepoContext, useRepo, useRepoStore, type RepoStore } from "./repo.tsx";
import { useRepoList } from "./repolist.ts";
import { pickRepository, REMEMBERED, useRemembered } from "./remember.ts";
import type { PreferenceStore } from "./mount.tsx";
import { Sidebar, type PageId } from "./sidebar.tsx";

export interface AppProps {
    // The repository context. The host writes it; every page reads it (D1).
    repo: RepoStore;
    sidebarCollapsed?: boolean;
    onSidebarCollapsed?: (value: boolean) => void;
    backlogWidth?: number;
    onBacklogWidth?: (value: number) => void;
    // When set, the shell draws the banner above the sidebar and the page. The extension never sets it.
    banner?: { icon: string };
    signInLogo?: string;
    signIn?: SignInController;
    gateway?: GitHubGateway;
    prefs?: PreferenceStore;
}

// The current page is in-memory state: switching never touches the address, and a reload
// always opens Grooming.
function Shell({
    sidebarCollapsed = false,
    onSidebarCollapsed,
    backlogWidth: initialWidth,
    onBacklogWidth,
    banner,
    signInLogo,
    signIn,
    gateway,
    prefs,
}: Omit<AppProps, "repo">): VNode {
    const [backlogWidth, setBacklogWidth] = useState<number | undefined>(initialWidth);
    const [collapsed, setCollapsed] = useState<boolean>(sidebarCollapsed);
    const [page, setPage] = useState<PageId>("grooming");
    // The one banner menu open, if any: opening one closes the other (G16).
    const [menu, setMenu] = useState<"repo" | "account" | null>(null);
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
    const list = useRepoList(pickable ? protectedGateway : undefined, auth?.login, (fresh) => {
        // A complete list without the current repository means the person lost it (D7).
        const now = repoStore?.get();
        if (now && !fresh.some((r) => r.owner === now.owner && r.name === now.name)) {
            repoStore?.set(null);
            void prefs?.set(REMEMBERED, null);
        }
    }, prefs);
    // The live backlog reads GitHub as the signed-in person, through the shell's gateway (G1).
    const live = useMemo(
        () => (protectedGateway && signIn && auth?.login ? { gateway: protectedGateway, login: auth.login } : undefined),
        [protectedGateway, signIn, auth?.login],
    );
    const account = signIn && auth ? <Account signIn={signIn} state={auth} showUser={!banner} /> : undefined;
    if (signIn && !auth?.login) {
        return (
            <main class="rd-sign-in">
                {signInLogo && <img class="rd-sign-in__logo" src={signInLogo} alt="" width={112} height={112} />}
                <h1>Sign in to Raiden</h1>
                {account}
            </main>
        );
    }

    const layout: VNode = (
        <div class={banner ? "rd-app rd-app--framed" : "rd-app"}>
            <Sidebar
                current={page}
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
                    <PickPrompt />
                ) : page === "grooming" ? (
                    <GroomingPage
                        live={live}
                        backlogWidth={backlogWidth}
                        onBacklogWidth={(value: number, final: boolean) => {
                            setBacklogWidth(value);
                            if (final) {
                                onBacklogWidth?.(value);
                            }
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
                        <RepoMenu
                            current={current}
                            repos={list.repos}
                            loading={list.loading}
                            open={menu === "repo"}
                            onOpenChange={(o: boolean) => setMenu(o ? "repo" : null)}
                            onPick={(repo) => pickRepository(repoStore, prefs, auth.login!, repo)}
                        />
                    ) : undefined
                }
                account={
                    auth?.login ? (
                        <AccountMenu
                            login={auth.login}
                            onSignOut={signIn?.signOut}
                            open={menu === "account"}
                            onOpenChange={(o: boolean) => setMenu(o ? "account" : null)}
                        />
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
function PickPrompt(): VNode {
    return (
        <p class="rd-pick-prompt" role="status">
            Pick a repository to see its work.
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
