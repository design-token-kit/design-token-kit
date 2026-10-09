import { describe, it, expect } from "vitest";
import { IssueCollector } from "#/core/formats/support/IssueCollector";
import { ReadContext, readToken } from "#/core/formats/support/ReadContext";
import { TokenReadError } from "#/core/formats/support/TokenReadError";

function contextOf(collector: IssueCollector): ReadContext {
    return new ReadContext(collector).enter("color").enter("brand");
}

describe("readToken", () => {
    it("returns what the parser read", () => {
        const collector = new IssueCollector("tokens.json");
        expect(readToken(contextOf(collector), () => 42)).toBe(42);
        expect(collector.issues).toHaveLength(0);
    });

    it("reports a read error under its own id at the current path", () => {
        const collector = new IssueCollector("tokens.json");
        const token = readToken(contextOf(collector), () => {
            throw new TokenReadError("invalid-color", "Expected hex color, got: 1");
        });

        expect(token).toBeUndefined();
        expect(collector.issues).toEqual([
            expect.objectContaining({
                id: "invalid-color",
                message: "Expected hex color, got: 1",
                sourcePath: "tokens.json",
                severity: "error",
            }),
        ]);
        expect(collector.issues[0].tokenPath?.toString()).toBe("color.brand");
    });

    it("lets any other error escape as the programming error it is", () => {
        const collector = new IssueCollector("tokens.json");
        expect(() => readToken(contextOf(collector), () => {
            throw new TypeError("Cannot read properties of undefined");
        })).toThrow(TypeError);
        expect(collector.issues).toHaveLength(0);
    });
});
