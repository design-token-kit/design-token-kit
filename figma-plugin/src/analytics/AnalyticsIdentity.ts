export const ANALYTICS_DISTINCT_ID_STORAGE_KEY = "design-token-kit.analytics.distinct-id";

export interface AnalyticsClientStorage {
    getAsync(key: string): Promise<unknown>;
    setAsync(key: string, value: string): Promise<void>;
}

export async function getOrCreateAnalyticsDistinctId(
    clientStorage: AnalyticsClientStorage,
): Promise<string> {
    try {
        const storedDistinctId = await clientStorage.getAsync(ANALYTICS_DISTINCT_ID_STORAGE_KEY);
        if (isAnalyticsDistinctId(storedDistinctId)) {
            return storedDistinctId;
        }

        const distinctId = createAnalyticsDistinctId();
        await clientStorage.setAsync(ANALYTICS_DISTINCT_ID_STORAGE_KEY, distinctId);
        return distinctId;
    } catch {
        return createAnalyticsDistinctId();
    }
}

export function isAnalyticsDistinctId(value: unknown): value is string {
    return typeof value === "string"
        && /^dtk-[a-z0-9-]{16,128}$/.test(value);
}

export function createAnalyticsDistinctId(): string {
    const cryptoApi = (globalThis as {
        crypto?: { randomUUID?: () => string };
    }).crypto;

    if (cryptoApi?.randomUUID !== undefined) {
        return `dtk-${cryptoApi.randomUUID()}`;
    }

    return `dtk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}
