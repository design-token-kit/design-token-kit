import { describe, it, expect } from "vitest";
import { SwiftUiTokenConverter } from "#/index";

describe("core barrel", () => {
    it("exports SwiftUiTokenConverter", () => {
        expect(typeof SwiftUiTokenConverter).toBe("function");
    });
});
