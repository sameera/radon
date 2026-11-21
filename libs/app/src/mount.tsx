import { render } from "preact";
import { App } from "./app.tsx";

export interface AppOptions {
    // Stylesheet text for the isolated boundary: tokens, design-system components, app layout.
    css?: string;
}

// Mounts the Raiden app into a shadow root (or any element). Returns a function that removes it.
export async function mountApp(root: ShadowRoot | HTMLElement, options: AppOptions = {}): Promise<() => void> {
    const doc: Document = root.ownerDocument;
    const style: HTMLStyleElement = doc.createElement("style");
    style.textContent = options.css ?? "";
    const container: HTMLElement = doc.createElement("div");
    container.className = "rd-root";
    root.append(style, container);
    render(<App />, container);
    return () => {
        render(null, container);
        container.remove();
        style.remove();
    };
}
