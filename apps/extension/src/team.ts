// Team build settings for the extension (D10). They are read from the environment when the
// extension is built, and fixed in the bundle.
export interface ExtensionTeam {
    backendUrl: string;
    extensionKey: string;
}

// Adds the one host permission for the team's backend and the fixed key that keeps the
// extension's ID, and so its return address, stable (G12, R1).
export function teamManifest(manifest: Record<string, unknown>, team: ExtensionTeam): Record<string, unknown> {
    const out: Record<string, unknown> = { ...manifest };
    if (team.backendUrl) {
        out.host_permissions = [`${new URL(team.backendUrl).origin}/*`];
    }
    if (team.extensionKey) {
        out.key = team.extensionKey;
    }
    return out;
}
