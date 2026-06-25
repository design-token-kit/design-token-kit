import { describe, it, expect } from "vitest";
import { DurationValue } from "#/core/model/values/DurationValue";

describe("DurationValue", () => {
    it.each([
        [200, "ms", "200ms"],
        [0.3, "s", "0.3s"],
    ] as const)("serializes %s%s to %s", (value, unit, expected) => {
        expect(new DurationValue(value, unit).toString()).toBe(expected);
    });

    describe("toMs", () => {
        it("returns value as-is for ms unit", () => {
            expect(new DurationValue(300, "ms").toMs()).toBe(300);
        });

        it("converts seconds to milliseconds", () => {
            expect(new DurationValue(0.3, "s").toMs()).toBe(300);
        });
    });
});
