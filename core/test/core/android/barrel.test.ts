import { describe, it, expect } from "vitest";
import { AndroidTokenConverter } from "#/index";

describe("core barrel", () => {
    it("exports AndroidTokenConverter", () => {
        expect(typeof AndroidTokenConverter).toBe("function");
    });
});
