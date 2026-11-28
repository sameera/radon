// The backend update: the build already ran (the Nx target depends on it), so a failed build
// stops before any upload. Only the backend stack is deployed, with CloudFormation's rollback
// on, and the command ends with a health check (D8, G15, G16).
import { deployBackend, type SetupDeps } from "./setup.ts";

export type BackendUpdateDeps = Pick<SetupDeps, "deploy" | "outputs" | "health" | "log">;

export async function runBackendUpdate(deps: BackendUpdateDeps): Promise<string> {
    let deployed: boolean = false;
    try {
        const backendUrl: string = await deployBackend({
            ...deps,
            deploy: async (stack: string) => {
                await deps.deploy(stack);
                deployed = true;
            },
        });
        deps.log(`Backend updated: ${backendUrl}`);
        return backendUrl;
    } catch (err) {
        const reason: string = err instanceof Error ? err.message : String(err);
        if (!deployed) {
            throw new Error(`${reason}. The backend keeps serving the previous version.`);
        }
        // R2: new code that deploys but fails at start is not undone automatically.
        throw new Error(
            `${reason}. The new code is live but unhealthy; check out the previous commit and run pnpm aws:update-backend again.`,
        );
    }
}

