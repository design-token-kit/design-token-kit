import { expect } from "vitest";
import { DtcgReader } from "#/core/formats/dtcg/DtcgReader";
import { DtcgList } from "#/core/model/DtcgList";
import type { Dtcg } from "#/core/model/Dtcg";

/**
 * Reads a DTCG literal into a document, failing the test when it cannot be
 * read.
 *
 * Converter tests use token documents as fixtures, and a fixture that fails to
 * read is a broken test rather than a case under test - so the diagnostics go
 * into the assertion message instead of a returned result.
 */
export async function readDtcg(json: object): Promise<Dtcg> {
    const result = await DtcgReader.noSchema().read(JSON.stringify(json));
    if (!result.ok) {
        expect.fail(`fixture could not be read:\n${result.issues.map((issue) => issue.message).join("\n")}`);
    }
    return result.documents[0];
}

/**
 * Reads a base literal and its theme literals into a {@link DtcgList}.
 */
export async function readDtcgList(base: object, themes: Record<string, object> = {}): Promise<DtcgList> {
    const baseDoc = await readDtcg(base);
    const themeMap = new Map<string, Dtcg>();

    for (const [name, doc] of Object.entries(themes)) {
        themeMap.set(name, await readDtcg(doc));
    }

    return new DtcgList(baseDoc, themeMap);
}
