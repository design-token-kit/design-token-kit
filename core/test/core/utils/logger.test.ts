import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logInfo, logError } from "#/utils/logger";

describe("logger", () => {
    beforeEach(() => {
        vi.spyOn(console, "log").mockImplementation(() => {});
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("logInfo", () => {
        it("calls console.log with the message", () => {
            logInfo("hello");
            expect(console.log).toHaveBeenCalledWith("hello");
        });

        it("calls console.log exactly once", () => {
            logInfo("once");
            expect(console.log).toHaveBeenCalledTimes(1);
        });

        it("passes the message unchanged", () => {
            logInfo("  spaces  ");
            expect(console.log).toHaveBeenCalledWith("  spaces  ");
        });
    });

    describe("logError", () => {
        it("calls console.error with the message", () => {
            logError("something went wrong");
            expect(console.error).toHaveBeenCalledWith("something went wrong");
        });

        it("calls console.error exactly once", () => {
            logError("once");
            expect(console.error).toHaveBeenCalledTimes(1);
        });

        it("does not call console.log", () => {
            logError("error");
            expect(console.log).not.toHaveBeenCalled();
        });

        it("does not call console.error from logInfo", () => {
            logInfo("info");
            expect(console.error).not.toHaveBeenCalled();
        });
    });
});
