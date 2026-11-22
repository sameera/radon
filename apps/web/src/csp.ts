// Fills the team's backend address into the page's content security policy at build time (G22).
export function withBackend(html: string, backendUrl: string): string {
    const origin: string = backendUrl ? ` ${new URL(backendUrl).origin}` : "";
    return html.replace("/*BACKEND*/", () => origin);
}
