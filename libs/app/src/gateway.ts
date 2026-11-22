import { createContext } from "preact";
import { useContext } from "preact/hooks";
import type { GitHubRequest, GitHubResult } from "@raiden/shared";

// What a host gives the shell, the same way it gives the preference store. Pages ask the gateway
// for GitHub data and never see a token (D6). A failure arrives as a result, with its kind.
export interface GitHubGateway {
    request(request: GitHubRequest): Promise<GitHubResult>;
}

export const GatewayContext = createContext<GitHubGateway | undefined>(undefined);

export function useGateway(): GitHubGateway | undefined {
    return useContext(GatewayContext);
}
