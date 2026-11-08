import { describe, expect, it, vi } from "vitest";
import {
    ANALYTICS_DISTINCT_ID_STORAGE_KEY,
    getOrCreateAnalyticsDistinctId,
} from "#/figma-plugin/analytics/AnalyticsIdentity";

describe("analytics identity", () => {
    it("stores and reuses one distinct ID across plugin launches", async () => {
        let storedValue: unknown;
        const clientStorage = {
            getAsync: vi.fn(async (key: string) => key === ANALYTICS_DISTINCT_ID_STORAGE_KEY ? storedValue : undefined),
            setAsync: vi.fn(async (_key: string, value: string) => {
                storedValue = value;
            }),
        };

        const firstDistinctId = await getOrCreateAnalyticsDistinctId(clientStorage);
        const secondDistinctId = await getOrCreateAnalyticsDistinctId(clientStorage);

        expect(firstDistinctId).toBe(secondDistinctId);
        expect(firstDistinctId).toMatch(/^dtk-[a-z0-9-]{16,128}$/);
        expect(clientStorage.setAsync).toHaveBeenCalledTimes(1);
    });

    it("replaces an invalid stored value without using personal data", async () => {
        const clientStorage = {
            getAsync: vi.fn().mockResolvedValue("developer@example.com"),
            setAsync: vi.fn().mockResolvedValue(undefined),
        };

        const distinctId = await getOrCreateAnalyticsDistinctId(clientStorage);

        expect(distinctId).toMatch(/^dtk-[a-z0-9-]{16,128}$/);
        expect(clientStorage.setAsync).toHaveBeenCalledWith(
            ANALYTICS_DISTINCT_ID_STORAGE_KEY,
            distinctId,
        );
    });

    it("falls back to an ephemeral ID when client storage fails", async () => {
        const clientStorage = {
            getAsync: vi.fn().mockRejectedValue(new Error("storage unavailable")),
            setAsync: vi.fn(),
        };

        const distinctId = await getOrCreateAnalyticsDistinctId(clientStorage);

        expect(distinctId).toMatch(/^dtk-[a-z0-9-]{16,128}$/);
        expect(clientStorage.setAsync).not.toHaveBeenCalled();
    });
});
