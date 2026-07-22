type TestColorVariable = {
    id: string;
    name: string;
    description: string;
    hiddenFromPublishing: boolean;
    remote: boolean;
    variableCollectionId: string;
    key: string;
    resolvedType: "COLOR";
    valuesByMode: Record<string, RGBA | VariableAlias>;
    scopes: VariableScope[];
    codeSyntax: Partial<Record<CodeSyntaxPlatform, string>>;
};

type TestStringVariable = {
    id: string;
    name: string;
    description: string;
    hiddenFromPublishing: boolean;
    remote: boolean;
    variableCollectionId: string;
    key: string;
    resolvedType: "STRING";
    valuesByMode: Record<string, string>;
    scopes: VariableScope[];
    codeSyntax: Partial<Record<CodeSyntaxPlatform, string>>;
};

type TestColorToken = {
    $type: "color";
    $description?: string;
    $extensions?: {
        "com.figma": {
            hiddenFromPublishing: boolean;
            remote: boolean;
            variableId: string;
            variableCollectionId: string;
            key: string;
            scopes: VariableScope[];
            codeSyntax: Partial<Record<CodeSyntaxPlatform, string>>;
        };
    };
    $value:
        | {
            colorSpace: "srgb";
            components: [number, number, number];
            alpha: number;
            hex?: string;
        }
        | string;
};

type TestVariableMetadata = {
    description?: string;
    hiddenFromPublishing?: boolean;
    remote?: boolean;
    variableCollectionId?: string;
    key?: string;
    scopes?: VariableScope[];
    codeSyntax?: Partial<Record<CodeSyntaxPlatform, string>>;
};

export function createColorVariable(
    id: string,
    name: string,
    valuesByMode: Record<string, RGBA | VariableAlias>,
    metadata: TestVariableMetadata = {},
): TestColorVariable {
    return {
        id,
        name,
        description: metadata.description ?? "",
        hiddenFromPublishing: metadata.hiddenFromPublishing ?? false,
        remote: metadata.remote ?? false,
        variableCollectionId: metadata.variableCollectionId ?? "collection",
        key: metadata.key ?? `${id}-key`,
        resolvedType: "COLOR",
        valuesByMode,
        scopes: metadata.scopes ?? [],
        codeSyntax: metadata.codeSyntax ?? {},
    };
}

export function createStringVariable(
    id: string,
    name: string,
    valuesByMode: Record<string, string>,
    metadata: TestVariableMetadata = {},
): TestStringVariable {
    return {
        id,
        name,
        description: metadata.description ?? "",
        hiddenFromPublishing: metadata.hiddenFromPublishing ?? false,
        remote: metadata.remote ?? false,
        variableCollectionId: metadata.variableCollectionId ?? "collection",
        key: metadata.key ?? `${id}-key`,
        resolvedType: "STRING",
        valuesByMode,
        scopes: metadata.scopes ?? [],
        codeSyntax: metadata.codeSyntax ?? {},
    };
}

export function createAlias(id: string): VariableAlias {
    return {
        type: "VARIABLE_ALIAS",
        id,
    };
}

export function rgba(r: number, g: number, b: number, a: number = 1): RGBA {
    return { r, g, b, a };
}

export function createColorToken(
    color: RGBA,
    metadata: TestVariableMetadata & { variableId?: string } = {},
): TestColorToken {
    const token: TestColorToken = {
        $type: "color",
        $value: {
            colorSpace: "srgb",
            components: [color.r, color.g, color.b],
            alpha: color.a,
        },
    };

    token.$value.hex = rgbaToHex(color);

    if ((metadata.description ?? "").trim() !== "") {
        token.$description = metadata.description;
    }

    if (shouldIncludeFigmaExtension(metadata)) {
        token.$extensions = {
            "com.figma": {
                hiddenFromPublishing: metadata.hiddenFromPublishing ?? false,
                remote: metadata.remote ?? false,
                variableId: metadata.variableId ?? "variable",
                variableCollectionId: metadata.variableCollectionId ?? "collection",
                key: metadata.key ?? "variable-key",
                scopes: metadata.scopes ?? [],
                codeSyntax: metadata.codeSyntax ?? {},
            },
        };
    }

    return token;
}

export function createReferenceToken(
    value: string,
    metadata: TestVariableMetadata & { variableId?: string } = {},
): TestColorToken {
    const token: TestColorToken = {
        $type: "color",
        $value: value,
    };

    if ((metadata.description ?? "").trim() !== "") {
        token.$description = metadata.description;
    }

    if (shouldIncludeFigmaExtension(metadata)) {
        token.$extensions = {
            "com.figma": {
                hiddenFromPublishing: metadata.hiddenFromPublishing ?? false,
                remote: metadata.remote ?? false,
                variableId: metadata.variableId ?? "variable",
                variableCollectionId: metadata.variableCollectionId ?? "collection",
                key: metadata.key ?? "variable-key",
                scopes: metadata.scopes ?? [],
                codeSyntax: metadata.codeSyntax ?? {},
            },
        };
    }

    return token;
}

function shouldIncludeFigmaExtension(metadata: TestVariableMetadata): boolean {
    return (metadata.hiddenFromPublishing ?? false)
        || (metadata.remote ?? false)
        || (metadata.scopes?.length ?? 0) > 0
        || Object.keys(metadata.codeSyntax ?? {}).length > 0;
}

function rgbaToHex(color: RGBA): string {
    return `#${rgbaChannelToHex(color.r)}${rgbaChannelToHex(color.g)}${rgbaChannelToHex(color.b)}`;
}

function rgbaChannelToHex(channel: number): string {
    const value: number = Math.round(clamp01(channel) * 255);
    return value.toString(16).padStart(2, "0");
}

function clamp01(value: number): number {
    return Math.min(1, Math.max(0, value));
}
