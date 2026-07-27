# SwiftUI Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a SwiftUI output format to design-token-kit that emits a namespaced-enum Swift API preserving token references, plus an optional CI-only compilation check that never breaks local cross-platform builds.

**Architecture:** Two isolated contours. Contour A is a pure TypeScript converter (`DtcgTokenSwiftUiConverter`) following the existing CSS/SCSS platform pattern - zero Swift dependency, tested with snapshot tests. It emits SwiftUI types fully qualified (`SwiftUI.Color`, `SwiftUI.Font`, ...) so generated enum names like `enum Color` never shadow the framework types. Contour B is an optional `scripts/verify-swift/index.mjs` plus a Swift package fixture whose shim target is named `SwiftUI` (so `import SwiftUI` / `SwiftUI.*` resolve to the shim on Linux and to the real framework on Apple, where the shim target is excluded); it self-skips when no `swift` toolchain is present and runs only in a dedicated CI job.

> Note: Tasks 4, 7 and 8 below reflect the original plan. During implementation, review hardened several things: (1) all emitted SwiftUI types are `SwiftUI.`-qualified to avoid enum/type name collisions; (2) the shim target was renamed from `SwiftUIShim` to `SwiftUI` and is conditionally excluded on Apple platforms via `#if canImport(SwiftUI)` in `Package.swift`; the shim also declares `TimeInterval`. (3) The fixture was relocated from `core/test/fixtures/` to `scripts/verify-swift/fixtures/swiftui-compile/` (next to `verify-swift.mjs` and its `sample-tokens.json` input). (4) The fixture tree now holds only static sources (`Package.swift`, `Sources/SwiftUI/`); `verify-swift.mjs` copies it into the git-ignored `build/swiftui-compile/`, writes the generated `Tokens.swift` there, and runs `swift build` there - so generation never touches the source tree (no `GeneratedTokens/.gitkeep`, no generated-file `.gitignore` entry). See the actual files for the shipped form.

**Tech Stack:** TypeScript, vitest, Node ESM scripts (.mjs), Swift Package Manager (fixture), GitHub Actions.

**Reference spec:** `docs/superpowers/specs/2026-07-24-swiftui-export-design.md`

**Working directory:** All paths are relative to `design-token-kit/` (the inner package repo, the one with its own `.git`).

---

## File Structure

Contour A (TypeScript, tested everywhere):
- Create `core/src/core/platforms/swiftui/TokenSwiftUiConverter.ts` - converter interface.
- Create `core/src/core/platforms/swiftui/ColorSwiftUiSerializer.ts` - `ColorValue` -> `Color(...)`.
- Create `core/src/core/platforms/swiftui/DtcgTokenSwiftUiConverter.ts` - DTCG -> Swift string.
- Create `core/test/core/swiftui/ColorSwiftUiSerializer.test.ts`.
- Create `core/test/core/swiftui/DtcgTokenSwiftUiConverter.test.ts`.
- Modify `core/src/core/io/Format.ts` - add `SWIFT_UI = "swiftui"`.
- Modify `core/src/index.ts` - export converter + types.
- Modify `cli/src/commands/formats.ts` - register writer.

Contour B (optional Swift compile check):
- Create `scripts/verify-swift/fixtures/swiftui-compile/Package.swift`.
- Create `scripts/verify-swift/fixtures/swiftui-compile/Sources/SwiftUIShim/SwiftUIShim.swift`.
- Create `scripts/verify-swift/fixtures/swiftui-compile/Sources/GeneratedTokens/.gitkeep`.
- Create `scripts/verify-swift/index.mjs`.
- Modify `package.json` (root) - add `verify:swift` script.
- Modify `.github/workflows/ci.yml` - add `swift-compile` job.
- Modify `.gitignore` - ignore generated `Tokens.swift`.

---

### Task 1: Add SWIFT_UI to the Format enum

**Files:**
- Modify: `core/src/core/io/Format.ts`
- Test: `core/test/core/io/Format.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `core/test/core/io/Format.test.ts` (append a new test inside the existing describe block; if unsure of structure, read the file first and match its style):

```typescript
import { describe, it, expect } from "vitest";
import { Format } from "#/core/io/Format";

describe("Format swiftui", () => {
    it("exposes the swiftui format value", () => {
        expect(Format.SWIFT_UI).toBe("swiftui");
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd core && npx vitest run test/core/io/Format.test.ts`
Expected: FAIL - `Format.SWIFT_UI` is undefined.

- [ ] **Step 3: Add the enum member**

In `core/src/core/io/Format.ts`, add before the closing brace of the enum:

```typescript
    /**
     * SwiftUI design tokens (namespaced enum of static let).
     */
    SWIFT_UI = "swiftui",
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd core && npx vitest run test/core/io/Format.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add core/src/core/io/Format.ts core/test/core/io/Format.test.ts
git commit -m "feat: add swiftui format enum value"
```

---

### Task 2: ColorSwiftUiSerializer

Serializes `ColorValue` to a SwiftUI `Color(...)` initializer. sRGB default; `display-p3` -> `.displayP3`; `srgb-linear` -> `.linearSRGB`; every other color space falls back to `.sRGB`. Components are the raw 0-1 numbers; `opacity:` is appended only when alpha < 1. Non-numeric components ("none") are treated as 0.

**Files:**
- Create: `core/src/core/platforms/swiftui/ColorSwiftUiSerializer.ts`
- Test: `core/test/core/swiftui/ColorSwiftUiSerializer.test.ts`

- [ ] **Step 1: Write the failing test**

Create `core/test/core/swiftui/ColorSwiftUiSerializer.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { ColorValue } from "#/core/model/values/ColorValue";
import { ColorSwiftUiSerializer } from "#/core/platforms/swiftui/ColorSwiftUiSerializer";

const serializer = new ColorSwiftUiSerializer();

describe("ColorSwiftUiSerializer", () => {
    it("serializes opaque srgb color", () => {
        const color = new ColorValue("srgb", [1, 0.2, 0.2], 1);
        expect(serializer.serialize(color)).toBe("Color(.sRGB, red: 1, green: 0.2, blue: 0.2)");
    });

    it("appends opacity when alpha below 1", () => {
        const color = new ColorValue("srgb", [0, 0, 0], 0.5);
        expect(serializer.serialize(color)).toBe("Color(.sRGB, red: 0, green: 0, blue: 0, opacity: 0.5)");
    });

    it("maps display-p3 to the displayP3 space", () => {
        const color = new ColorValue("display-p3", [1, 0, 0], 1);
        expect(serializer.serialize(color)).toBe("Color(.displayP3, red: 1, green: 0, blue: 0)");
    });

    it("falls back to sRGB for unsupported color spaces", () => {
        const color = new ColorValue("oklch", [0.6, 0.1, 200], 1);
        expect(serializer.serialize(color)).toBe("Color(.sRGB, red: 0.6, green: 0.1, blue: 200)");
    });

    it("treats none components as zero", () => {
        const color = new ColorValue("srgb", ["none", 0.5, 0.5], 1);
        expect(serializer.serialize(color)).toBe("Color(.sRGB, red: 0, green: 0.5, blue: 0.5)");
    });
});
```

Note: confirm the `ColorValue` constructor signature by reading `core/src/core/model/values/ColorValue.ts` first. It is `(colorSpace, components, alpha, hex?)`. If the positional shape differs, adapt the test construction accordingly - the serialized expectations stay the same.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd core && npx vitest run test/core/swiftui/ColorSwiftUiSerializer.test.ts`
Expected: FAIL - module not found.

- [ ] **Step 3: Implement the serializer**

Create `core/src/core/platforms/swiftui/ColorSwiftUiSerializer.ts`:

```typescript
import { ColorValue, type ColorComponent, type ColorSpace } from "#/core/model/values/ColorValue";

const SPACE_MAP: Partial<Record<ColorSpace, string>> = {
    "srgb": ".sRGB",
    "srgb-linear": ".linearSRGB",
    "display-p3": ".displayP3",
};

/**
 * Serializes DTCG color values to SwiftUI Color initializers.
 *
 * @remarks
 * Unsupported color spaces (lab, lch, oklab, oklch, hsl, ...) fall back to
 * sRGB. Components are emitted as raw 0-1 numbers; `opacity:` is added only
 * when alpha is below 1.
 */
export class ColorSwiftUiSerializer {
    serialize(color: ColorValue): string {
        const space = SPACE_MAP[color.colorSpace] ?? ".sRGB";
        const [r, g, b] = color.components;
        const parts = [
            `${space}`,
            `red: ${this.#number(r)}`,
            `green: ${this.#number(g)}`,
            `blue: ${this.#number(b)}`,
        ];
        if (color.alpha < 1) {
            parts.push(`opacity: ${color.alpha}`);
        }
        return `Color(${parts.join(", ")})`;
    }

    #number(component: ColorComponent | undefined): string {
        if (typeof component !== "number") return "0";
        return String(component);
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd core && npx vitest run test/core/swiftui/ColorSwiftUiSerializer.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add core/src/core/platforms/swiftui/ColorSwiftUiSerializer.ts core/test/core/swiftui/ColorSwiftUiSerializer.test.ts
git commit -m "feat: add ColorSwiftUiSerializer"
```

---

### Task 3: Converter interface + scalar tokens + namespaced enum + references

Build the converter skeleton: interface, `convertDocument`, tree walk into nested enums, scalar value mapping, and reference preservation. Composite types come in Task 4.

Structure of the generated file:
- Root `enum DesignTokens { ... }`.
- Each token group becomes a nested `enum <Pascal(groupKey)> { ... }`.
- Each token node becomes `static let <camel(key)> = <value>` (with explicit type annotation for dimension/duration).
- A reference `{a.b.c}` becomes `DesignTokens.<Pascal(a)>.<Pascal(b)>.<camel(c)>`.
- Swift reserved words in identifiers are suffixed with `_` (e.g. `default` -> `default_`, `class` -> `class_`).

Name casing rule: path segments used as enum names are PascalCase; the final leaf identifier is camelCase.

**Files:**
- Create: `core/src/core/platforms/swiftui/TokenSwiftUiConverter.ts`
- Create: `core/src/core/platforms/swiftui/DtcgTokenSwiftUiConverter.ts`
- Test: `core/test/core/swiftui/DtcgTokenSwiftUiConverter.test.ts`

- [ ] **Step 1: Write the failing test**

Create `core/test/core/swiftui/DtcgTokenSwiftUiConverter.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { DtcgJsonReader } from "#/core/io/DtcgJsonReader";
import { DtcgTokenSwiftUiConverter } from "#/core/platforms/swiftui/DtcgTokenSwiftUiConverter";

function convert(json: object): string {
    const doc = new DtcgJsonReader().parse(JSON.stringify(json));
    return new DtcgTokenSwiftUiConverter().convertDocument(doc);
}

describe("DtcgTokenSwiftUiConverter scalars", () => {
    it("wraps output in a DesignTokens enum with SwiftUI import", () => {
        const out = convert({
            color: { base: { red: { $type: "color", $value: "#ff3333" } } },
        });
        expect(out).toContain("import SwiftUI");
        expect(out).toContain("enum DesignTokens {");
    });

    it("emits nested enums for groups and static let for tokens", () => {
        const out = convert({
            spacing: { md: { $type: "dimension", $value: "16px" } },
        });
        expect(out).toContain("enum Spacing {");
        expect(out).toContain("static let md: CGFloat = 16");
    });

    it("preserves references as Swift constant paths", () => {
        const out = convert({
            color: {
                base: { red: { $type: "color", $value: "#ff3333" } },
                semantic: { primary: { $type: "color", $value: "{color.base.red}" } },
            },
        });
        expect(out).toContain("static let primary = DesignTokens.Color.Base.red");
    });

    it("escapes Swift reserved words in identifiers", () => {
        const out = convert({
            color: { default: { $type: "color", $value: "#000000" } },
        });
        expect(out).toContain("static let default_ =");
    });

    it("returns an empty DesignTokens enum for empty input", () => {
        const out = convert({});
        expect(out).toContain("enum DesignTokens {");
        expect(out).not.toContain("static let");
    });
});
```

Note: confirm `DtcgJsonReader` import path and `parse` method by reading `core/src/core/io/DtcgJsonReader.ts` (Task references it the same way `formats.ts` does: `new DtcgJsonReader().parse(content)`).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd core && npx vitest run test/core/swiftui/DtcgTokenSwiftUiConverter.test.ts`
Expected: FAIL - module not found.

- [ ] **Step 3: Create the interface**

Create `core/src/core/platforms/swiftui/TokenSwiftUiConverter.ts`:

```typescript
import type { Dtcg } from "#/core/model/Dtcg";

/**
 * Converter for design tokens to a SwiftUI namespaced-enum API.
 */
export interface TokenSwiftUiConverter {
    /**
     * Converts a single token document to a Swift source string.
     *
     * @param doc - Parsed DTCG document
     * @returns Generated Swift source
     */
    convertDocument(doc: Dtcg): string;
}
```

- [ ] **Step 4: Implement scalar conversion**

Create `core/src/core/platforms/swiftui/DtcgTokenSwiftUiConverter.ts`:

```typescript
import { Dtcg } from "#/core/model/Dtcg";
import { TokenGroup } from "#/core/model/TokenGroup";
import { TokenNode } from "#/core/model/TokenNode";
import { TokenPath } from "#/core/model/TokenPath";
import { TokenReference } from "#/core/model/TokenReference";
import { ColorValue } from "#/core/model/values/ColorValue";
import { DimensionValue } from "#/core/model/values/DimensionValue";
import { DurationValue } from "#/core/model/values/DurationValue";
import { CubicBezierValue } from "#/core/model/values/CubicBezierValue";
import { ColorSwiftUiSerializer } from "#/core/platforms/swiftui/ColorSwiftUiSerializer";
import type { TokenSwiftUiConverter } from "#/core/platforms/swiftui/TokenSwiftUiConverter";

const ROOT = "DesignTokens";
const INDENT = "    ";

const SWIFT_KEYWORDS = new Set([
    "default", "class", "enum", "struct", "case", "let", "var", "func",
    "import", "return", "self", "super", "static", "public", "internal",
    "private", "protocol", "extension", "if", "else", "for", "while",
    "switch", "true", "false", "nil", "in", "where", "guard", "defer",
]);

const colorSerializer = new ColorSwiftUiSerializer();

/**
 * Converts DTCG token documents to a SwiftUI namespaced-enum API.
 *
 * @remarks
 * Groups become nested `enum`s; tokens become `static let`. References to
 * other tokens are preserved as Swift constant paths rooted at DesignTokens,
 * not flattened to literal values.
 */
export class DtcgTokenSwiftUiConverter implements TokenSwiftUiConverter {
    convertDocument(doc: Dtcg): string {
        const body = this.#renderGroupBody(doc, 1);
        const lines = ["import SwiftUI", "", `enum ${ROOT} {`];
        if (body) lines.push(body);
        lines.push("}", "");
        return lines.join("\n");
    }

    #renderGroupBody(group: Dtcg | TokenGroup, depth: number): string {
        const indent = INDENT.repeat(depth);
        const parts: string[] = [];
        for (const [key, child] of group.entries()) {
            if (child instanceof TokenGroup) {
                const inner = this.#renderGroupBody(child, depth + 1);
                const enumLine = `${indent}enum ${pascal(key)} {`;
                parts.push(inner ? `${enumLine}\n${inner}\n${indent}}` : `${enumLine}\n${indent}}`);
            } else if (child instanceof TokenNode) {
                const decl = this.#renderToken(camel(key), child.value);
                if (decl) parts.push(`${indent}${decl}`);
            }
        }
        return parts.join("\n");
    }

    #renderToken(name: string, value: unknown): string | undefined {
        const rendered = renderScalar(value);
        if (!rendered) return undefined;
        return `static let ${name}${rendered.type ? `: ${rendered.type}` : ""} = ${rendered.expr}`;
    }
}

interface Rendered {
    expr: string;
    type?: string;
}

function renderScalar(value: unknown): Rendered | undefined {
    if (value instanceof TokenReference) return { expr: refToSwift(value) };
    if (value instanceof ColorValue) return { expr: colorSerializer.serialize(value) };
    if (value instanceof DimensionValue) return { expr: String(value.value), type: "CGFloat" };
    if (value instanceof DurationValue) return { expr: String(durationSeconds(value)), type: "TimeInterval" };
    if (value instanceof CubicBezierValue) {
        return { expr: `UnitCurve.bezier(startControlPoint: UnitPoint(x: ${value.p1x}, y: ${value.p1y}), endControlPoint: UnitPoint(x: ${value.p2x}, y: ${value.p2y}))` };
    }
    if (typeof value === "number") return { expr: String(value) };
    if (typeof value === "string") return { expr: JSON.stringify(value) };
    return undefined;
}

function durationSeconds(value: DurationValue): number {
    return value.unit === "ms" ? value.value / 1000 : value.value;
}

function refToSwift(ref: TokenReference): string {
    const segments = ref.path.segments();
    const head = segments.slice(0, -1).map(pascal);
    const tail = camel(segments[segments.length - 1]);
    return [ROOT, ...head, tail].join(".");
}

function escapeIdentifier(name: string): string {
    return SWIFT_KEYWORDS.has(name) ? `${name}_` : name;
}

function pascal(segment: string): string {
    const cleaned = toParts(segment);
    return escapeIdentifier(cleaned.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(""));
}

function camel(segment: string): string {
    const cleaned = toParts(segment);
    const joined = cleaned
        .map((p, i) => (i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1)))
        .join("");
    return escapeIdentifier(joined);
}

function toParts(segment: string): string[] {
    return segment.split(/[-_.\s]+/).filter(Boolean).map((p) => p.toLowerCase());
}
```

Note: confirm `TokenPath` exposes `.segments` as `string[]` by reading `core/src/core/model/TokenPath.ts`. If the accessor is named differently (e.g. `.parts`), adapt `refToSwift`. Confirm `TokenReference.path` returns a `TokenPath` (it does per the model).

- [ ] **Step 5: Run test to verify it passes**

Run: `cd core && npx vitest run test/core/swiftui/DtcgTokenSwiftUiConverter.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add core/src/core/platforms/swiftui/TokenSwiftUiConverter.ts core/src/core/platforms/swiftui/DtcgTokenSwiftUiConverter.ts core/test/core/swiftui/DtcgTokenSwiftUiConverter.test.ts
git commit -m "feat: add SwiftUI converter with scalars and references"
```

---

### Task 4: Composite types (typography, shadow, border, gradient, strokeStyle, transition)

Add composite value handling to `renderScalar` plus one-time emission of the wrapper struct definitions used by those values. Struct names avoid shadowing native SwiftUI types: `TypographyToken`, `ShadowToken`, `BorderToken`, `StrokeStyleToken`, `TransitionToken`. Gradient uses the native `Gradient`.

Structs are emitted at the top of `DesignTokens` only when at least one token of the corresponding type is present.

**Files:**
- Modify: `core/src/core/platforms/swiftui/DtcgTokenSwiftUiConverter.ts`
- Test: `core/test/core/swiftui/DtcgTokenSwiftUiConverter.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `core/test/core/swiftui/DtcgTokenSwiftUiConverter.test.ts`:

```typescript
describe("DtcgTokenSwiftUiConverter composites", () => {
    it("emits a ShadowToken struct and value when a shadow token exists", () => {
        const out = convert({
            elevation: {
                low: {
                    $type: "shadow",
                    $value: {
                        color: { colorSpace: "srgb", components: [0, 0, 0], alpha: 0.2 },
                        offsetX: { value: 0, unit: "px" },
                        offsetY: { value: 2, unit: "px" },
                        blur: { value: 4, unit: "px" },
                        spread: { value: 0, unit: "px" },
                    },
                },
            },
        });
        expect(out).toContain("struct ShadowToken {");
        expect(out).toContain("static let low = ShadowToken(");
    });

    it("does not emit composite structs when no composite tokens exist", () => {
        const out = convert({
            spacing: { md: { $type: "dimension", $value: { value: 16, unit: "px" } } },
        });
        expect(out).not.toContain("struct ShadowToken");
        expect(out).not.toContain("struct TypographyToken");
    });

    it("emits a TypographyToken struct and value", () => {
        const out = convert({
            text: {
                body: {
                    $type: "typography",
                    $value: {
                        fontFamily: ["Inter"],
                        fontSize: { value: 16, unit: "px" },
                        fontWeight: 400,
                        letterSpacing: { value: 0, unit: "px" },
                        lineHeight: 1.5,
                    },
                },
            },
        });
        expect(out).toContain("struct TypographyToken {");
        expect(out).toContain("static let body = TypographyToken(");
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd core && npx vitest run test/core/swiftui/DtcgTokenSwiftUiConverter.test.ts`
Expected: FAIL - composite structs not emitted.

- [ ] **Step 3: Implement composite handling**

In `core/src/core/platforms/swiftui/DtcgTokenSwiftUiConverter.ts`:

Add imports at the top:

```typescript
import { BorderValue } from "#/core/model/values/BorderValue";
import { ShadowLayer } from "#/core/model/values/ShadowValue";
import { StrokeStyleObject } from "#/core/model/values/StrokeStyleValue";
import { TransitionValue } from "#/core/model/values/TransitionValue";
import { TypographyValue } from "#/core/model/values/TypographyValue";
import { GradientStop } from "#/core/model/values/GradientValue";
```

Add a struct-definitions catalog after the constants:

```typescript
type CompositeKind = "typography" | "shadow" | "border" | "strokeStyle" | "transition";

const STRUCT_DEFINITIONS: Record<CompositeKind, string> = {
    typography: [
        "struct TypographyToken {",
        `${INDENT}let font: Font`,
        `${INDENT}let tracking: CGFloat`,
        `${INDENT}let lineSpacing: CGFloat`,
        "}",
    ].join("\n"),
    shadow: [
        "struct ShadowToken {",
        `${INDENT}let color: Color`,
        `${INDENT}let radius: CGFloat`,
        `${INDENT}let x: CGFloat`,
        `${INDENT}let y: CGFloat`,
        "}",
    ].join("\n"),
    border: [
        "struct BorderToken {",
        `${INDENT}let color: Color`,
        `${INDENT}let width: CGFloat`,
        "}",
    ].join("\n"),
    strokeStyle: [
        "struct StrokeStyleToken {",
        `${INDENT}let dashed: Bool`,
        "}",
    ].join("\n"),
    transition: [
        "struct TransitionToken {",
        `${INDENT}let duration: TimeInterval`,
        "}",
    ].join("\n"),
};
```

Track used composite kinds. Change the class to collect them during rendering:

```typescript
export class DtcgTokenSwiftUiConverter implements TokenSwiftUiConverter {
    #used = new Set<CompositeKind>();

    convertDocument(doc: Dtcg): string {
        this.#used = new Set();
        const body = this.#renderGroupBody(doc, 1);
        const structs = [...this.#used]
            .map((kind) => indentBlock(STRUCT_DEFINITIONS[kind], 1))
            .join("\n\n");
        const lines = ["import SwiftUI", "", `enum ${ROOT} {`];
        if (structs) lines.push(structs, "");
        if (body) lines.push(body);
        lines.push("}", "");
        return lines.join("\n");
    }
    // ...#renderGroupBody unchanged...

    #renderToken(name: string, value: unknown): string | undefined {
        const rendered = this.#renderValue(value);
        if (!rendered) return undefined;
        return `static let ${name}${rendered.type ? `: ${rendered.type}` : ""} = ${rendered.expr}`;
    }

    #renderValue(value: unknown): Rendered | undefined {
        const scalar = renderScalar(value);
        if (scalar) return scalar;
        return this.#renderComposite(value);
    }

    #renderComposite(value: unknown): Rendered | undefined {
        if (value instanceof TypographyValue) {
            this.#used.add("typography");
            return { expr: typographyToSwift(value) };
        }
        if (value instanceof BorderValue) {
            this.#used.add("border");
            return { expr: borderToSwift(value) };
        }
        if (value instanceof TransitionValue) {
            this.#used.add("transition");
            return { expr: transitionToSwift(value) };
        }
        if (value instanceof StrokeStyleObject) {
            this.#used.add("strokeStyle");
            return { expr: "StrokeStyleToken(dashed: true)" };
        }
        if (value instanceof ShadowLayer) {
            this.#used.add("shadow");
            return { expr: shadowLayerToSwift(value) };
        }
        if (Array.isArray(value) && value.length > 0) {
            return this.#renderArray(value);
        }
        return undefined;
    }

    #renderArray(value: unknown[]): Rendered | undefined {
        if (value.every((item) => item instanceof GradientStop || item instanceof TokenReference)) {
            const hasGradient = value.some((item) => item instanceof GradientStop);
            if (hasGradient) return { expr: gradientToSwift(value as Array<GradientStop | TokenReference>) };
        }
        if (value[0] instanceof ShadowLayer) {
            this.#used.add("shadow");
            const first = value[0] as ShadowLayer;
            return { expr: shadowLayerToSwift(first) };
        }
        return undefined;
    }
}
```

Add the helper functions and `indentBlock` at module scope:

```typescript
function indentBlock(block: string, depth: number): string {
    const indent = INDENT.repeat(depth);
    return block.split("\n").map((line) => (line ? indent + line : line)).join("\n");
}

function dimToSwift(value: DimensionValue | TokenReference): string {
    if (value instanceof TokenReference) return refToSwift(value);
    return String(value.value);
}

function colorArgToSwift(value: ColorValue | TokenReference): string {
    return value instanceof TokenReference ? refToSwift(value) : colorSerializer.serialize(value);
}

function typographyToSwift(value: TypographyValue): string {
    const size = dimToSwift(value.fontSize instanceof TokenReference ? value.fontSize : value.fontSize);
    const tracking = dimToSwift(value.letterSpacing);
    const lineSpacing = value.lineHeight instanceof TokenReference ? refToSwift(value.lineHeight) : String(value.lineHeight);
    const weight = fontWeightToSwift(value.fontWeight);
    return `TypographyToken(font: Font.system(size: ${size}, weight: ${weight}), tracking: ${tracking}, lineSpacing: ${lineSpacing})`;
}

function fontWeightToSwift(weight: unknown): string {
    if (weight instanceof TokenReference) return refToSwift(weight);
    const map: Record<string, string> = {
        "100": ".ultraLight", "200": ".thin", "300": ".light", "400": ".regular",
        "500": ".medium", "600": ".semibold", "700": ".bold", "800": ".heavy", "900": ".black",
    };
    return map[String(weight)] ?? ".regular";
}

function shadowLayerToSwift(layer: ShadowLayer): string {
    const color = colorArgToSwift(layer.color);
    const radius = dimToSwift(layer.blur);
    const x = dimToSwift(layer.offsetX);
    const y = dimToSwift(layer.offsetY);
    return `ShadowToken(color: ${color}, radius: ${radius}, x: ${x}, y: ${y})`;
}

function borderToSwift(value: BorderValue): string {
    const color = colorArgToSwift(value.color);
    const width = dimToSwift(value.width);
    return `BorderToken(color: ${color}, width: ${width})`;
}

function transitionToSwift(value: TransitionValue): string {
    const duration = value.duration instanceof TokenReference
        ? refToSwift(value.duration)
        : String(durationSeconds(value.duration));
    return `TransitionToken(duration: ${duration})`;
}

function gradientToSwift(stops: Array<GradientStop | TokenReference>): string {
    const rendered = stops.map((stop) => {
        if (stop instanceof TokenReference) return `Gradient.Stop(color: ${refToSwift(stop)}, location: 0)`;
        const color = colorArgToSwift(stop.color);
        const location = stop.position instanceof TokenReference ? refToSwift(stop.position) : String(stop.position);
        return `Gradient.Stop(color: ${color}, location: ${location})`;
    });
    return `Gradient(stops: [${rendered.join(", ")}])`;
}
```

Note: read `core/src/core/model/values/TypographyValue.ts`, `ShadowValue.ts`, `BorderValue.ts`, `TransitionValue.ts`, `GradientValue.ts` to confirm property names (`fontSize`, `letterSpacing`, `lineHeight`, `fontWeight`, `blur`, `offsetX`, `offsetY`, `color`, `width`, `duration`, `position`). The SCSS converter (`DtcgTokenScssConverter.ts`) uses exactly these names - mirror them. Adjust only if a property name differs.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd core && npx vitest run test/core/swiftui/DtcgTokenSwiftUiConverter.test.ts`
Expected: PASS (all scalar + composite tests).

- [ ] **Step 5: Run the full core suite to catch regressions**

Run: `cd core && npx vitest run`
Expected: PASS (no regressions in existing tests).

- [ ] **Step 6: Commit**

```bash
git add core/src/core/platforms/swiftui/DtcgTokenSwiftUiConverter.ts core/test/core/swiftui/DtcgTokenSwiftUiConverter.test.ts
git commit -m "feat: add SwiftUI composite type structs"
```

---

### Task 5: Export from core barrel

**Files:**
- Modify: `core/src/index.ts`
- Test: `core/test/core/swiftui/DtcgTokenSwiftUiConverter.test.ts` (add a barrel import check)

- [ ] **Step 1: Write the failing test**

Create `core/test/core/swiftui/barrel.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { DtcgTokenSwiftUiConverter } from "#/index";

describe("core barrel", () => {
    it("exports DtcgTokenSwiftUiConverter", () => {
        expect(typeof DtcgTokenSwiftUiConverter).toBe("function");
    });
});
```

Note (verified): core tests import via the `#/` alias, NOT the package name `@design-token-kit/core` (that form is only used in CLI tests). Use `#/index` as shown above.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd core && npx vitest run test/core/swiftui/barrel.test.ts`
Expected: FAIL - export missing.

- [ ] **Step 3: Add the exports**

In `core/src/index.ts`, alongside the other platform exports:

```typescript
export type { TokenSwiftUiConverter } from "#/core/platforms/swiftui/TokenSwiftUiConverter";
export { DtcgTokenSwiftUiConverter } from "#/core/platforms/swiftui/DtcgTokenSwiftUiConverter";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd core && npx vitest run test/core/swiftui/barrel.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add core/src/index.ts core/test/core/swiftui/barrel.test.ts
git commit -m "feat: export SwiftUI converter from core barrel"
```

---

### Task 6: Register the writer in the CLI

`writers` in `cli/src/commands/formats.ts` is typed `satisfies Record<OutputFormat, DocumentWriter>`, so once `Format.SWIFT_UI` exists, the compiler will demand a `writers[Format.SWIFT_UI]` entry and a branch in `toOutputFormat`.

**Files:**
- Modify: `cli/src/commands/formats.ts`
- Test: `cli/test/commands/formats.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `cli/test/commands/formats.test.ts` (match existing test style; read the file first):

```typescript
import { describe, it, expect } from "vitest";
import { getWriter, Format } from "#/commands/formats";
import { DtcgJsonReader } from "@design-token-kit/core";

describe("swiftui writer", () => {
    it("writes SwiftUI output", () => {
        const doc = new DtcgJsonReader().parse(
            JSON.stringify({ spacing: { md: { $type: "dimension", $value: { value: 16, unit: "px" } } } }),
        );
        const out = getWriter(Format.SWIFT_UI).write(doc);
        expect(out).toContain("enum DesignTokens {");
        expect(out).toContain("static let md: CGFloat = 16");
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd cli && npx vitest run test/commands/formats.test.ts`
Expected: FAIL - `getWriter(Format.SWIFT_UI)` throws "Unknown format" or type error.

- [ ] **Step 3: Register the writer**

In `cli/src/commands/formats.ts`:

Add to the import from `@design-token-kit/core`:

```typescript
    DtcgTokenSwiftUiConverter,
```

Add to the `writers` object (before the closing `} satisfies`):

```typescript
    [Format.SWIFT_UI]: {
        write: (doc) => new DtcgTokenSwiftUiConverter().convertDocument(doc),
    },
```

Add `Format.SWIFT_UI` to the accepted list in `toOutputFormat`:

```typescript
        || resolved === Format.TAILWIND_V4
        || resolved === Format.SWIFT_UI
```

And append it to the error message's available list:

```typescript
    throw new Error(`Unknown format "${resolved}". Available: ${Format.DTCG}, ${Format.HRDT}, ${Format.DESIGN_MD}, ${Format.CSS}, ${Format.SCSS}, ${Format.TAILWIND_V4}, ${Format.SWIFT_UI}`);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd cli && npx vitest run test/commands/formats.test.ts`
Expected: PASS.

- [ ] **Step 5: Build both workspaces to confirm no type errors**

Run: `npm run build`
Expected: PASS (tsc --noEmit succeeds in core and cli).

- [ ] **Step 6: Commit**

```bash
git add cli/src/commands/formats.ts cli/test/commands/formats.test.ts
git commit -m "feat: register SwiftUI writer in CLI"
```

---

### Task 7: SwiftUIShim and Swift package fixture

A minimal Swift package with two library targets: `SwiftUIShim` (stub types) and `GeneratedTokens` (empty, filled by the verify script). `Package.swift` links `GeneratedTokens` against `SwiftUIShim` on non-Apple platforms and against real `SwiftUI` on Apple platforms.

**Files:**
- Create: `scripts/verify-swift/fixtures/swiftui-compile/Package.swift`
- Create: `scripts/verify-swift/fixtures/swiftui-compile/Sources/SwiftUIShim/SwiftUIShim.swift`
- Create: `scripts/verify-swift/fixtures/swiftui-compile/Sources/GeneratedTokens/.gitkeep`
- Modify: `.gitignore`

- [ ] **Step 1: Create the Package manifest**

Create `scripts/verify-swift/fixtures/swiftui-compile/Package.swift`:

```swift
// swift-tools-version:5.9
import PackageDescription

#if canImport(SwiftUI)
let tokenDependencies: [Target.Dependency] = []
#else
let tokenDependencies: [Target.Dependency] = ["SwiftUIShim"]
#endif

let package = Package(
    name: "SwiftUICompileCheck",
    targets: [
        .target(name: "SwiftUIShim"),
        .target(name: "GeneratedTokens", dependencies: tokenDependencies),
    ]
)
```

Note: `#if canImport(SwiftUI)` in Package.swift is evaluated on the host running SwiftPM. On Linux CI it is false (shim used); on macOS it is true (real SwiftUI). This is the OS switch; the verify script does not need to branch the manifest.

- [ ] **Step 2: Create the shim**

Create `scripts/verify-swift/fixtures/swiftui-compile/Sources/SwiftUIShim/SwiftUIShim.swift`:

```swift
// Minimal SwiftUI stand-ins so generated tokens type-check on non-Apple
// platforms. Signatures mirror the subset the generator emits.
import Foundation

public typealias CGFloat = Double

public enum RGBColorSpace {
    case sRGB
    case linearSRGB
    case displayP3
}

public struct Color {
    public init(_ space: RGBColorSpace = .sRGB, red: Double, green: Double, blue: Double, opacity: Double = 1) {}
}

public struct UnitPoint {
    public init(x: Double, y: Double) {}
}

public enum UnitCurve {
    public static func bezier(startControlPoint: UnitPoint, endControlPoint: UnitPoint) -> UnitCurve { .init() }
    init() {}
}

public struct Font {
    public enum Weight {
        case ultraLight, thin, light, regular, medium, semibold, bold, heavy, black
    }
    public static func system(size: CGFloat, weight: Weight = .regular) -> Font { Font() }
    public static func custom(_ name: String, size: CGFloat) -> Font { Font() }
    init() {}
}

public struct Gradient {
    public struct Stop {
        public init(color: Color, location: CGFloat) {}
    }
    public init(stops: [Stop]) {}
}
```

Note: the `.sRGB` / `.displayP3` / `.linearSRGB` cases must be accessible as `Color(.sRGB, ...)`. Since the generator emits `Color(.sRGB, red:...)`, the first unlabeled parameter is `RGBColorSpace` - this matches the shim initializer. On real macOS, SwiftUI's `Color.RGBColorSpace` has the same case names and the same `Color(_:red:green:blue:opacity:)` initializer, so generated code compiles unchanged.

- [ ] **Step 3: Create the generated-tokens placeholder**

Create `scripts/verify-swift/fixtures/swiftui-compile/Sources/GeneratedTokens/.gitkeep` (empty file).

- [ ] **Step 4: Ignore generated output**

Append to `.gitignore`:

```
scripts/verify-swift/fixtures/swiftui-compile/Sources/GeneratedTokens/Tokens.swift
```

- [ ] **Step 5: Commit**

```bash
git add scripts/verify-swift/fixtures/swiftui-compile .gitignore
git commit -m "test: add SwiftUI compile fixture and shim"
```

---

### Task 8: verify-swift.mjs script

Generates SwiftUI tokens from a sample DTCG file, writes them into the fixture, and runs `swift build`. Self-skips (exit 0) when `swift` is not on PATH.

**Files:**
- Create: `scripts/verify-swift/index.mjs`
- Create: `scripts/verify-swift/fixtures/sample-tokens.json`
- Modify: `package.json` (root)

- [ ] **Step 1: Create a representative sample token file**

Create `scripts/verify-swift/fixtures/sample-tokens.json`:

```json
{
    "color": {
        "base": { "red": { "$type": "color", "$value": { "colorSpace": "srgb", "components": [1, 0.2, 0.2] } } },
        "semantic": { "primary": { "$type": "color", "$value": "{color.base.red}" } }
    },
    "spacing": { "md": { "$type": "dimension", "$value": { "value": 16, "unit": "px" } } },
    "motion": { "fast": { "$type": "duration", "$value": { "value": 150, "unit": "ms" } } },
    "elevation": {
        "low": {
            "$type": "shadow",
            "$value": {
                "color": { "colorSpace": "srgb", "components": [0, 0, 0], "alpha": 0.2 },
                "offsetX": { "value": 0, "unit": "px" },
                "offsetY": { "value": 2, "unit": "px" },
                "blur": { "value": 4, "unit": "px" },
                "spread": { "value": 0, "unit": "px" }
            }
        }
    },
    "text": {
        "body": {
            "$type": "typography",
            "$value": {
                "fontFamily": ["Inter"],
                "fontSize": { "value": 16, "unit": "px" },
                "fontWeight": 400,
                "letterSpacing": { "value": 0, "unit": "px" },
                "lineHeight": 1.5
            }
        }
    }
}
```

- [ ] **Step 2: Create the verify script**

Create `scripts/verify-swift/index.mjs`:

```javascript
#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { DtcgJsonReader, DtcgTokenSwiftUiConverter } from "@design-token-kit/core";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const fixtureDir = resolve(root, "scripts/verify-swift/fixtures/swiftui-compile");
const samplePath = resolve(here, "fixtures/sample-tokens.json");
const outPath = resolve(fixtureDir, "Sources/GeneratedTokens/Tokens.swift");

function hasSwift() {
    const probe = spawnSync("swift", ["--version"], { stdio: "ignore" });
    return probe.status === 0;
}

if (!hasSwift()) {
    console.log("verify:swift skipped: swift toolchain not found");
    process.exit(0);
}

const doc = new DtcgJsonReader().parse(readFileSync(samplePath, "utf8"));
const swift = new DtcgTokenSwiftUiConverter().convertDocument(doc);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, swift, "utf8");
console.log(`Generated ${outPath}`);

execFileSync("swift", ["build", "--package-path", fixtureDir], { stdio: "inherit" });
console.log("verify:swift passed: generated SwiftUI code compiles");
```

Note: this script imports from `@design-token-kit/core`, so it must run after `npm run build`. If the package's built entry is not resolvable via the package name in a plain `node` run, change the import to a relative path into `core`'s build output (check `core/package.json` `main`/`exports`). The CI job (Task 9) runs `npm run build` first.

- [ ] **Step 3: Add the npm script**

In root `package.json`, add to `scripts`:

```json
        "verify:swift": "node scripts/verify-swift/index.mjs",
```

- [ ] **Step 4: Run locally to confirm the skip path**

Run: `npm run build && npm run verify:swift`
Expected (on a machine without Swift): prints `verify:swift skipped: swift toolchain not found` and exits 0.

- [ ] **Step 5: Commit**

```bash
git add scripts/verify-swift/index.mjs scripts/verify-swift/fixtures/sample-tokens.json package.json
git commit -m "feat: add verify:swift compile-check script"
```

---

### Task 9: CI job

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add the swift-compile job**

Append to `.github/workflows/ci.yml` under `jobs:` (sibling of `build`):

```yaml
  swift-compile:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - uses: swift-actions/setup-swift@v2

      - run: npm install

      - run: npm run build

      - run: npm run verify:swift
```

Note: verify the action reference `swift-actions/setup-swift@v2` is current before relying on it; if unavailable, substitute the maintained SwiftPM setup action or install swift.org toolchain manually. The job must run on `ubuntu-latest` so the shim path (not real SwiftUI) is exercised.

- [ ] **Step 2: Validate the workflow locally**

Run: `cat .github/workflows/ci.yml` and confirm both jobs (`build`, `swift-compile`) are present and YAML-valid (consistent indentation).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add swiftui compile-check job"
```

- [ ] **Step 4: Push and confirm CI green**

Run: `git push` (to the feature branch), then check the Actions run.
Expected: `build` matrix and `swift-compile` both pass; `swift-compile` actually runs `swift build` (not skipped) because CI has the toolchain.

---

## Self-Review Notes

- Spec coverage: Format enum (T1), color serializer with space fallback (T2), namespaced enum + scalars + reference preservation + keyword escaping (T3), composite structs with non-shadowing names (T4), barrel export (T5), CLI registration (T6), shim + fixture (T7), self-skipping verify script (T8), CI job on ubuntu exercising the shim path (T9). Local cross-platform build stays intact because contour B is a separate npm script outside `npm test`/`npm build`.
- Type consistency: `refToSwift`, `camel`, `pascal`, `colorSerializer`, `durationSeconds`, `dimToSwift`, `colorArgToSwift`, `Rendered`, `CompositeKind`, `STRUCT_DEFINITIONS`, struct names (`TypographyToken`/`ShadowToken`/`BorderToken`/`StrokeStyleToken`/`TransitionToken`) are used consistently across Tasks 3-4.
- Model-name verification is called out inline in Tasks 2-4 (read the value model files and mirror the SCSS converter's property names) because those are the only points where the plan depends on exact existing signatures.
