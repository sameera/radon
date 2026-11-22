import { describe, expect, it } from "vitest";
import { teamSettings } from "./team-settings.ts";

describe("web team settings", () => {
    it("reads empty values when the build set none", () => {
        expect(teamSettings()).toEqual({ clientId: "", backendUrl: "", returnUrl: "" });
    });
});
