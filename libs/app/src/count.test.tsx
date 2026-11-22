// @vitest-environment jsdom
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mountApp } from "./mount.tsx";
import { deleteGoal, planItem, unplanItem } from "./plan.ts";
import { INITIATIVES } from "./sample.ts";
import { createSessionStore, type SessionStore } from "./session.ts";

let root: HTMLElement;
let unmount: () => void;
let session: SessionStore;

async function open(): Promise<void> {
    session = createSessionStore();
    await act(async () => {
        unmount = await mountApp(root, { session });
    });
}
const $ = <T extends Element>(sel: string): T => root.querySelector<T>(sel)!;
const $$ = <T extends Element>(sel: string): T[] => Array.from(root.querySelectorAll<T>(sel));
const item = (name: string): HTMLButtonElement =>
    $$<HTMLButtonElement>(".rd-nav-item").find((b) => b.dataset["label"] === name)!;
const badge = (): HTMLElement | null => item("Grooming").querySelector<HTMLElement>(".rd-nav-item__count");
const change = (fn: Parameters<SessionStore["change"]>[0]): Promise<void> => act(() => session.change(fn));
const planAllEpics = (): Promise<void> =>
    change((s) => {
        let next = s;
        for (const init of INITIATIVES) {
            next = planItem(INITIATIVES, next, "init", init.num, "g1");
        }
        return next;
    });

beforeEach(() => {
    root = document.createElement("div");
    document.body.append(root);
});
afterEach(() => {
    unmount?.();
    root.remove();
});

describe("not-planned count on the Grooming sidebar item", () => {
    it("shows the number of epics not planned in any goal", async () => {
        await open();
        // 9 epics, 5 planned at the start.
        expect(badge()!.textContent).toBe("4");
    });

    it("says the count in words for assistive technology", async () => {
        await open();
        expect(item("Grooming").getAttribute("aria-label")).toBe("Grooming, 4 epics not planned");
        await change((s) => unplanItem(unplanItem(s, "epic", 31), "epic", 40));
        expect(item("Grooming").getAttribute("aria-label")).toBe("Grooming, 6 epics not planned");
    });

    it("uses the singular for one epic", async () => {
        await open();
        await planAllEpics();
        await change((s) => unplanItem(unplanItem(s, "init", 15), "epic", 60));
        expect(item("Grooming").getAttribute("aria-label")).toBe("Grooming, 2 epics not planned");
        await change((s) => planItem(INITIATIVES, s, "epic", 61, "g1"));
        expect(item("Grooming").getAttribute("aria-label")).toBe("Grooming, 1 epic not planned");
    });

    it("shows no count when every epic is planned", async () => {
        await open();
        await planAllEpics();
        expect(badge()).toBeNull();
        expect(item("Grooming").getAttribute("aria-label")).toBe("Grooming");
    });

    it("shows no count on the other items", async () => {
        await open();
        for (const name of ["Sprint goal", "Timeline", "Settings"]) {
            expect(item(name).querySelector(".rd-nav-item__count")).toBeNull();
        }
    });

    it("changes with each plan change, with no reload, and always adds up to the header", async () => {
        await open();
        const header = (): number => Number($(".rd-groom__summary").textContent!.split(" ")[0]);
        const shown = (): number => Number(badge()?.textContent ?? 0);
        expect(shown() + header()).toBe(9);
        await change((s) => planItem(INITIATIVES, s, "epic", 41, "g3"));
        expect(shown()).toBe(3);
        expect(shown() + header()).toBe(9);
        await change((s) => unplanItem(s, "epic", 41));
        expect(shown()).toBe(4);
        await change((s) => deleteGoal(s, "g1"));
        expect(shown()).toBe(6);
        expect(shown() + header()).toBe(9);
    });

    it("counts an epic once when its initiative and the epic are both planned", async () => {
        await open();
        // Epic 50 is planned in g1 and its initiative 14 in g2: one planned epic each.
        await change((s) => planItem(INITIATIVES, s, "init", 12, "g3"));
        expect(badge()!.textContent).toBe("3");
    });

    it("follows the plan on another page, and in the dragged page after a switch back", async () => {
        await open();
        await act(() => item("Timeline").click());
        expect(badge()!.textContent).toBe("4");
        await change((s) => planItem(INITIATIVES, s, "init", 13, "g1"));
        expect(badge()!.textContent).toBe("2");
        await act(() => item("Grooming").click());
        expect(badge()!.textContent).toBe("2");
        expect($(".rd-groom__summary").textContent).toBe("7 of 9 epics planned");
    });

    it("keeps the count after a remount, because the session state survives", async () => {
        await open();
        await change((s) => planItem(INITIATIVES, s, "init", 13, "g1"));
        unmount();
        await act(async () => {
            unmount = await mountApp(root, { session });
        });
        expect(badge()!.textContent).toBe("2");
    });

    it("keeps the count visible in the collapsed rail", async () => {
        await open();
        await act(() => $<HTMLButtonElement>(".rd-nav__toggle").click());
        expect(badge()!.textContent).toBe("4");
    });
});
