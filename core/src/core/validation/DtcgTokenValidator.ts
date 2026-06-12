import { DtcgList } from "#/core/model/DtcgList";
import { DtcgListLoader, TokenSyntaxError } from "#/core/io/DtcgListLoader";
import type { TokenValidator, ValidationIssue } from "#/core/validation/TokenValidator";

/**
 * Validates DTCG JSON or HRDT token files using the internal model.
 *
 * Accepts one base file plus optional theme files. Validates references,
 * cycles, type mismatches, and deprecated token usage.
 *
 * Format is detected from content, not from file extension.
 * HRDT sources may contain multiple YAML documents separated by {@code ---}.
 * The first document is the base, subsequent documents are themes.
 */
export class DtcgTokenValidator implements TokenValidator {
    readonly #loader = new DtcgListLoader();

    async validate(sources: string[]): Promise<ValidationIssue[]> {
        try {
            const list: DtcgList = await this.#loader.load(sources);
            return list.validate();
        } catch (error) {
            if (error instanceof TokenSyntaxError) {
                return error.issues;
            }
            throw error;
        }

    }
}
