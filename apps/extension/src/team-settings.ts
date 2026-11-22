import type { TeamSettings } from "@raiden/shared";

// Replaced by esbuild's `define` with the team's values at build time.
declare const __RAIDEN_TEAM__: TeamSettings | undefined;

export function teamSettings(): TeamSettings {
    return typeof __RAIDEN_TEAM__ === "undefined" ? { clientId: "", backendUrl: "" } : __RAIDEN_TEAM__;
}
