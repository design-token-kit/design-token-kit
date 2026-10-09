import { FormatRegistry } from "#/core/formats/FormatRegistry";
import { dtcgFormat } from "#/core/formats/dtcg/descriptor";
import { designMdFormat } from "#/core/formats/design-md/descriptor";
import { hrdtFormat } from "#/core/formats/hrdt/descriptor";

/**
 * The token formats that can be read, in detection order.
 *
 * DTCG is recognised structurally and DESIGN.md by its frontmatter with prose,
 * so both are tried before HRDT, which accepts whatever is left.
 *
 * Kept apart from {@link FormatRegistry}: importing this is importing every
 * format, and a caller that needs only one - the Figma plugin builds a
 * DTCG-only registry - must be able to reach the class without pulling in the
 * YAML and markdown readers it has no use for.
 */
export const tokenFormats = new FormatRegistry([
    dtcgFormat,
    designMdFormat,
    hrdtFormat,
]);
