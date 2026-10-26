import { describe, expect, it } from "vitest";
import { TokenPath } from "@design-token-kit/core/core/model/TokenPath";
import type {
    CssDeclaration,
    CssPropertyTrace,
    CssTokenLink,
} from "@design-token-kit/core/core/platforms/css/CssTokenTracer";
import { toPropertyViews } from "#/browser-extension/panel/PanelModel";

const declaration: CssDeclaration = {
    property: "background",
    value: "var(--card-bg)",
    important: false,
    selector: ".card",
};

const tokenTrace: CssPropertyTrace = {
    property: "background",
    declaration,
    inheritedFrom: undefined,
    computedValue: "rgb(255, 255, 255)",
    chains: [{
        links: [
            {
                customProperty: "--card-bg",
                declaration: {
                    ...declaration,
                    property: "--card-bg",
                    value: "#fff",
                    selector: ":root[data-theme=\"dark\"]",
                },
                token: {
                    customProperty: "--card-bg",
                    path: TokenPath.parse("component.card.bg"),
                    type: "color",
                    description: "Card surface",
                    source: undefined,
                },
                layer: "component",
                theme: "dark",
            },
        ],
        end: { kind: "value", value: "#fff" },
    }],
};

describe("toPropertyViews", () => {
    it("shows the selector, token path, theme, value and description", () => {
        expect(toPropertyViews([tokenTrace])).toEqual([{
            property: "background",
            origin: ".card",
            computedValue: "rgb(255, 255, 255)",
            rawValue: undefined,
            chains: [{
                links: [{ title: "component.card.bg", theme: "dark" }],
                ending: "= #fff",
                description: "Card surface",
            }],
        }]);
    });

    it("names a link by custom property when the token is unknown", () => {
        const link: CssTokenLink = {
            ...tokenTrace.chains[0].links[0],
            token: undefined,
            layer: undefined,
            theme: undefined,
        };
        const trace: CssPropertyTrace = { ...tokenTrace, chains: [{ ...tokenTrace.chains[0], links: [link] }] };
        expect(toPropertyViews([trace])[0].chains[0]).toEqual({
            links: [{ title: "--card-bg", theme: undefined }],
            ending: "= #fff",
            description: undefined,
        });
    });

    it("marks an inherited property and a value without tokens", () => {
        const trace: CssPropertyTrace = {
            ...tokenTrace,
            property: "padding",
            declaration: { ...declaration, property: "padding", value: "24px" },
            inheritedFrom: "body",
            chains: [],
        };
        expect(toPropertyViews([trace])[0])
            .toMatchObject({ origin: "inherited from body", rawValue: "24px", chains: [] });
    });

    it("explains an undefined custom property and its fallback", () => {
        const trace: CssPropertyTrace = {
            ...tokenTrace,
            chains: [{ links: [], end: { kind: "undefined", customProperty: "--missing", fallback: "blue" } }],
        };
        expect(toPropertyViews([trace])[0].chains[0].ending).toBe("--missing is not defined, fallback: blue");
    });
});
