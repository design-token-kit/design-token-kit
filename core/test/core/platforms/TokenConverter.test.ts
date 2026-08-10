import { describe, expect, it } from "vitest";
import type { TokenConverter } from "#/core/platforms/TokenConverter";
import { AndroidTokenConverter } from "#/core/platforms/android/AndroidTokenConverter";
import { CssTokenConverter } from "#/core/platforms/css/CssTokenConverter";
import { FigmaScriptTokenConverter } from "#/core/platforms/figma-script/FigmaScriptTokenConverter";
import { ScssTokenConverter } from "#/core/platforms/scss/ScssTokenConverter";
import { SwiftUiTokenConverter } from "#/core/platforms/swiftui/SwiftUiTokenConverter";
import { TailwindTokenConverter } from "#/core/platforms/tailwind/TailwindTokenConverter";

describe("TokenConverter", () => {
    it("is implemented by every platform converter", () => {
        const converters: TokenConverter[] = [
            new AndroidTokenConverter(),
            new CssTokenConverter(),
            new FigmaScriptTokenConverter(),
            new ScssTokenConverter(),
            new SwiftUiTokenConverter(),
            new TailwindTokenConverter(),
        ];

        expect(converters).toHaveLength(6);
    });
});
