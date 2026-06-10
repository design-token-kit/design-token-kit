import { Source } from "#/core/Source";
import { DtcgJsonReader } from "#/core/io/DtcgJsonReader";
import { DtcgList } from "#/core/model/DtcgList";
import { HrdtTokenReader } from "#/core/io/HrdtTokenReader";
import { DtcgSchemaValidator } from "#/core/validation/dtcg/DtcgSchemaValidator";
import { HrdtTokenValidator } from "#/core/validation/hrdt/HrdtTokenValidator";
import type { Dtcg } from "#/core/model/Dtcg";
import type { TokenValidator, ValidationIssue } from "#/core/validation/TokenValidator";

function extractThemeName(source: string): string {
    const fileName = source.split("/").at(-1)?.split("\\").at(-1) ?? source;
    const withoutExt = fileName.replace(/\.(json|ya?ml)$/i, "");
    const dotIndex = withoutExt.lastIndexOf(".");
    return dotIndex > 0 ? withoutExt.slice(dotIndex + 1) : withoutExt;
}

async function readDoc(source: string): Promise<Dtcg> {
    const content = await new Source(source).getContent();
    return /\.(ya?ml)$/i.test(source)
    ? new HrdtTokenReader().parse(content)
        : new DtcgJsonReader().parse(content);
}

/**
 * Validates DTCG JSON or HRDT token files using the internal model.
 *
 * Accepts one base file plus optional theme files. Validates references,
 * cycles, type mismatches, and deprecated token usage.
 */
export class DtcgTokenValidator implements TokenValidator {
    readonly #name = "internal";

    async validate(sources: string[]): Promise<ValidationIssue[]> {
        const hrdtSources = sources.filter((s) => /\.(ya?ml)$/i.test(s));
        const hrdtIssues = hrdtSources.length > 0
            ? await new HrdtTokenValidator().validate(hrdtSources)
            : [];
        if (hrdtIssues.some((i) => i.severity === "error")) return hrdtIssues;

        const jsonSources = sources.filter((s) => !/\.(ya?ml)$/i.test(s));
        const schemaIssues = jsonSources.length > 0
            ? await new DtcgSchemaValidator().validate(jsonSources)
            : [];
        if (schemaIssues.some((i) => i.severity === "error")) return schemaIssues;

        const docs = await Promise.all(sources.map(readDoc));
        const [base, ...rest] = docs as [Dtcg, ...Dtcg[]];
        const themes = new Map(rest.map((doc, i) => [extractThemeName(sources[i + 1]), doc]));
        const list = new DtcgList(base, themes);

        return list.validate().map((issue) => ({
            name: this.#name,
            sourcePath: sources.join(", "),
            message: `${issue.tokenPath}: ${issue.message}`,
            severity: issue.severity,
        }));
    }
}
