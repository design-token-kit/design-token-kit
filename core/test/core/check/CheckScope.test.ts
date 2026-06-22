import { describe, it, expect } from "vitest";
import { CheckScope } from "#/core/check/CheckScope";

describe("CheckScope", () => {
    describe("fromName", () => {
        it("returns the scope with the given name", () => {
            expect(CheckScope.fromName("schema")).toBe(CheckScope.SCHEMA);
            expect(CheckScope.fromName("validate")).toBe(CheckScope.VALIDATE);
            expect(CheckScope.fromName("lint")).toBe(CheckScope.LINT);
        });

        it("throws for an unknown name", () => {
            expect(() => CheckScope.fromName("validation1"))
                .toThrow(/unknown scope 'validation1'/);
        });
    });

    describe("names", () => {
        it("lists all scope names, lowest depth first", () => {
            expect(CheckScope.names()).toEqual(["schema", "validate", "lint"]);
        });
    });

    describe("includes", () => {
        it("includes itself", () => {
            expect(CheckScope.VALIDATE.includes(CheckScope.VALIDATE)).toBe(true);
        });

        it("includes shallower scopes", () => {
            expect(CheckScope.LINT.includes(CheckScope.VALIDATE)).toBe(true);
            expect(CheckScope.LINT.includes(CheckScope.SCHEMA)).toBe(true);
        });

        it("does not include deeper scopes", () => {
            expect(CheckScope.VALIDATE.includes(CheckScope.LINT)).toBe(false);
            expect(CheckScope.SCHEMA.includes(CheckScope.VALIDATE)).toBe(false);
        });
    });
});
