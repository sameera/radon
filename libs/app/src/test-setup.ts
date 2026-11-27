import { afterAll } from "vitest";

// Preact runs effects after the next frame, with a 35 ms timer as fallback. Wait that timer out so
// it never fires after the test file's jsdom window is torn down.
afterAll(() => new Promise<void>((resolve) => setTimeout(resolve, 50)));
