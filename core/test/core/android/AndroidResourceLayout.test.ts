import { describe, it, expect } from "vitest";
import type { AndroidResource } from "#/core/platforms/android/AndroidResource";
import {
    AndroidLayerLayout,
    AndroidTypeLayout,
    createResourceLayout,
} from "#/core/platforms/android/AndroidResourceLayout";
import { AndroidResourceType } from "#/core/platforms/android/AndroidResourceType";

function resource(
    type: AndroidResourceType,
    group: string,
    name: string,
): AndroidResource {
    return { type, group, name, section: group, value: "x" };
}

const RESOURCES: AndroidResource[] = [
    resource(AndroidResourceType.COLOR, "primitive", "primitive_color_red"),
    resource(AndroidResourceType.DIMEN, "primitive", "primitive_space_md"),
    resource(AndroidResourceType.COLOR, "semantic", "semantic_color_primary"),
];

describe("AndroidLayerLayout", () => {
    const layout = new AndroidLayerLayout();

    it("creates one file per root token group", () => {
        expect(layout.split(RESOURCES).map((file) => file.fileName))
            .toEqual(["primitive.xml", "semantic.xml"]);
    });

    it("keeps resources of different types in the same group file", () => {
        const primitive = layout.split(RESOURCES)[0];
        expect(primitive.resources.map((entry) => entry.name))
            .toEqual(["primitive_color_red", "primitive_space_md"]);
    });

    it("returns no files for no resources", () => {
        expect(layout.split([])).toEqual([]);
    });
});

describe("AndroidTypeLayout", () => {
    const layout = new AndroidTypeLayout();

    it("creates one file per resource type", () => {
        expect(layout.split(RESOURCES).map((file) => file.fileName))
            .toEqual(["colors.xml", "dimens.xml"]);
    });

    it("keeps resources of different groups in the same type file", () => {
        const colors = layout.split(RESOURCES)[0];
        expect(colors.resources.map((entry) => entry.name))
            .toEqual(["primitive_color_red", "semantic_color_primary"]);
    });
});

describe("createResourceLayout", () => {
    it("creates the layer layout by name", () => {
        expect(createResourceLayout("layer")).toBeInstanceOf(AndroidLayerLayout);
    });

    it("creates the type layout by name", () => {
        expect(createResourceLayout("type")).toBeInstanceOf(AndroidTypeLayout);
    });
});
