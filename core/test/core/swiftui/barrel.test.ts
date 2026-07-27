import { describe, it, expect } from "vitest";
import { DtcgTokenSwiftUiConverter } from "#/index";

describe("core barrel", () => {
    it("exports DtcgTokenSwiftUiConverter", () => {
        expect(typeof DtcgTokenSwiftUiConverter).toBe("function");
    });
});
