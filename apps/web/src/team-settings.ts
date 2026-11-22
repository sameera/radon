import type { TeamSettings } from "@raiden/shared";

export interface WebTeam extends TeamSettings {
    // The web view's registered return address.
    returnUrl: string;
}

// Replaced by esbuild's `define` with the team's values at build time (D10).
declare const __RAIDEN_TEAM__: WebTeam | undefined;

export function teamSettings(): WebTeam {
    return typeof __RAIDEN_TEAM__ === "undefined" ? { clientId: "", backendUrl: "", returnUrl: "" } : __RAIDEN_TEAM__;
}
