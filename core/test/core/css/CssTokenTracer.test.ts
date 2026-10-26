import { describe, expect, it } from "vitest";
import {
    CssTokenTracer,
    type CssDeclaration,
    type CssElementStyles,
    type CssPropertyTrace,
} from "#/core/platforms/css/CssTokenTracer";
import { CssTokenMap, type CssTokenMapEntry } from "#/core/platforms/css/CssTokenMap";
import { TokenLayers } from "#/core/check/TokenLayers";
import { TokenPath } from "#/core/model/TokenPath";

function declaration(property: string, value: string, selector = ".card", important = false): CssDeclaration {
    return { property, value, selector, important };
}

function styles(label: string, declarations: CssDeclaration[], parent?: CssElementStyles): CssElementStyles {
    return { label, declarations, parent };
}

function entry(customProperty: string, path: string, description?: string): CssTokenMapEntry {
    return { customProperty, path: TokenPath.parse(path), type: "color", description, source: undefined };
}

const map = new CssTokenMap([
    entry("--component-card-bg", "component.card.bg", "Card surface"),
    entry("--semantic-surface", "semantic.surface"),
    entry("--primitive-white", "primitive.white"),
]);

const root: CssElementStyles = styles("html", [
    declaration("--component-card-bg", "var(--semantic-surface)", ":root"),
    declaration("--semantic-surface", "var(--primitive-white)", ":root"),
    declaration("--primitive-white", "#ffffff", ":root"),
]);

function traceOf(traces: CssPropertyTrace[], property: string): CssPropertyTrace {
    const trace = traces.find((candidate) => candidate.property === property);
    if (trace === undefined) throw new Error(`no trace for ${property}`);
    return trace;
}

describe("CssTokenTracer", () => {
    const tracer = new CssTokenTracer(map, TokenLayers.default());
    const noComputed: ReadonlyMap<string, string> = new Map();

    it("follows a chain of custom properties declared on an ancestor", () => {
        const card = styles("div.card", [declaration("background", "var(--component-card-bg)")], root);
        const trace = traceOf(tracer.trace(card, new Map([["background", "rgb(255, 255, 255)"]])), "background");

        expect(trace.inheritedFrom).toBeUndefined();
        expect(trace.computedValue).toBe("rgb(255, 255, 255)");
        expect(trace.chains).toHaveLength(1);
        const [chain] = trace.chains;
        expect(chain.links.map((link) => link.token?.path.toString())).toEqual([
            "component.card.bg",
            "semantic.surface",
            "primitive.white",
        ]);
        expect(chain.links.map((link) => link.layer)).toEqual(["component", "semantic", "primitive"]);
        expect(chain.links[0].token?.description).toBe("Card surface");
        expect(chain.end).toEqual({ kind: "value", value: "#ffffff" });
    });

    it("names links by custom property only when there is no map", () => {
        const card = styles("div.card", [declaration("background", "var(--component-card-bg)")], root);
        const noMapTracer = new CssTokenTracer(undefined, TokenLayers.default());
        const trace = traceOf(noMapTracer.trace(card, noComputed), "background");

        expect(trace.chains[0].links.map((link) => link.customProperty)).toEqual([
            "--component-card-bg",
            "--semantic-surface",
            "--primitive-white",
        ]);
        expect(trace.chains[0].links.every((link) => link.token === undefined && link.layer === undefined))
            .toBe(true);
    });

    it("reports a value without custom properties as having no chains", () => {
        const card = styles("div.card", [declaration("padding", "24px")], root);
        expect(traceOf(tracer.trace(card, noComputed), "padding").chains).toEqual([]);
    });

    it("takes an inherited property from the nearest ancestor that declares it", () => {
        const body = styles("body", [declaration("color", "var(--primitive-white)", "body")], root);
        const card = styles("div.card", [], body);
        const trace = traceOf(tracer.trace(card, noComputed), "color");

        expect(trace.inheritedFrom).toBe("body");
        expect(trace.declaration.selector).toBe("body");
        expect(trace.chains[0].end).toEqual({ kind: "value", value: "#ffffff" });
    });

    it("does not inherit a property that is not inherited", () => {
        const section = styles("section", [declaration("background", "red", "section")], root);
        const card = styles("div.card", [], section);
        expect(tracer.trace(card, noComputed).map((trace) => trace.property)).not.toContain("background");
    });

    it("lets an important declaration win over an earlier one", () => {
        const card = styles("div.card", [
            declaration("background", "red", "#card"),
            declaration("background", "var(--primitive-white)", ".card", true),
        ], root);
        expect(traceOf(tracer.trace(card, noComputed), "background").declaration.selector).toBe(".card");
    });

    it("takes the theme from the selector of the winning declaration", () => {
        const themedRoot = styles("html", [
            declaration("--semantic-surface", "var(--primitive-white)", ":root[data-theme=\"dark\"]"),
            ...root.declarations,
        ]);
        const card = styles("div.card", [declaration("background", "var(--component-card-bg)")], themedRoot);
        const links = traceOf(tracer.trace(card, noComputed), "background").chains[0].links;

        expect(links.map((link) => link.theme)).toEqual([undefined, "dark", undefined]);
    });

    it("resolves a custom property declared on the element itself first", () => {
        const card = styles("div.card", [
            declaration("background", "var(--semantic-surface)"),
            declaration("--semantic-surface", "#000000"),
        ], root);
        expect(traceOf(tracer.trace(card, noComputed), "background").chains[0].end).toEqual({
            kind: "value",
            value: "#000000",
        });
    });

    it("resolves a custom property at the ancestor that declares it", () => {
        const card = styles("div.card", [
            declaration("background", "var(--component-card-bg)"),
            declaration("--primitive-white", "#000000"),
        ], root);
        expect(traceOf(tracer.trace(card, noComputed), "background").chains[0].end).toEqual({
            kind: "value",
            value: "#ffffff",
        });
    });

    it("ends the chain at an undeclared custom property with its fallback", () => {
        const card = styles("div.card", [declaration("background", "var(--missing, blue)")], root);
        const chain = traceOf(tracer.trace(card, noComputed), "background").chains[0];

        expect(chain.links).toEqual([]);
        expect(chain.end).toEqual({ kind: "undefined", customProperty: "--missing", fallback: "blue" });
    });

    it("ends the chain at a composite value", () => {
        const card = styles("div.card", [
            declaration("border", "var(--border)"),
            declaration("--border", "1px solid var(--primitive-white)"),
        ], root);
        expect(traceOf(tracer.trace(card, noComputed), "border").chains[0].end).toEqual({
            kind: "value",
            value: "1px solid var(--primitive-white)",
        });
    });

    it("traces one chain per var() in the value", () => {
        const card = styles("div.card", [declaration("border", "1px solid var(--primitive-white)")], root);
        expect(traceOf(tracer.trace(card, noComputed), "border").chains).toHaveLength(1);
    });

    it("stops a reference cycle", () => {
        const card = styles("div.card", [
            declaration("color", "var(--a)"),
            declaration("--a", "var(--b)"),
            declaration("--b", "var(--a)"),
        ]);
        const chain = traceOf(tracer.trace(card, noComputed), "color").chains[0];

        expect(chain.links.map((link) => link.customProperty)).toEqual(["--a", "--b"]);
        expect(chain.end).toEqual({ kind: "undefined", customProperty: "--a", fallback: undefined });
    });

    it("lists own properties before inherited ones, each sorted by name", () => {
        const body = styles("body", [declaration("font-size", "16px", "body"), declaration("color", "red", "body")]);
        const card = styles("div.card", [declaration("padding", "1px"), declaration("background", "red")], body);
        expect(tracer.trace(card, noComputed).map((trace) => trace.property)).toEqual([
            "background",
            "padding",
            "color",
            "font-size",
        ]);
    });
});
