import { describe, expect, it } from "vitest";
import type { TokenConverter } from "#/core/platforms/TokenConverter";
import { CssTokenConverter } from "#/core/platforms/css/CssTokenConverter";
import { ScssTokenConverter } from "#/core/platforms/scss/ScssTokenConverter";
import { SwiftUiTokenConverter } from "#/core/platforms/swiftui/SwiftUiTokenConverter";
import { TailwindTokenConverter } from "#/core/platforms/tailwind/TailwindTokenConverter";

describe("TokenConverter", () => {
    it("is implemented by every platform converter", () => {
        const converters: TokenConverter[] = [
            new CssTokenConverter(),
            new ScssTokenConverter(),
            new SwiftUiTokenConverter(),
            new TailwindTokenConverter(),
        ];

        expect(converters).toHaveLength(4);
    });
});
