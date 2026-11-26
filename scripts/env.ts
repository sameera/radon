// Loads the repo-root frontend env file into a build's environment, so a build never runs with
// empty team settings because a shell forgot to source the file. Values already in the
// environment win: `process.loadEnvFile` does not overwrite them, so a CI job or a one-off
// `RAIDEN_GITHUB_CLIENT_ID=... node apps/web/build.ts` still takes precedence.
import { existsSync } from "node:fs";
import { join } from "node:path";

// The build scripts already run from the repo root (see the header of each build.ts), so the file
// is found the same way their other paths are.
export const FRONTEND_ENV_PATH: string = join(process.cwd(), ".env.frontend.local");

// Returns whether a file was loaded. A missing file is not an error: the build falls back to the
// environment it was given (an unconfigured build stays unconfigured).
export function loadFrontendEnv(path: string = FRONTEND_ENV_PATH): boolean {
    if (!existsSync(path)) {
        return false;
    }
    process.loadEnvFile(path);
    return true;
}
