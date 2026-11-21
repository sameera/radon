import { sync } from "./repo-nav.ts";

// GitHub re-renders the tab bar on in-page navigation and on hydration, which drops the
// injected tab. Re-sync on every DOM change, at most once per frame.
let scheduled: boolean = false;

function schedule(): void {
    if (scheduled) {
        return;
    }
    scheduled = true;
    requestAnimationFrame(() => {
        scheduled = false;
        sync(document);
    });
}

new MutationObserver(schedule).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["aria-expanded"],
});
window.addEventListener("resize", schedule);
sync(document);
