import { TokenFormat } from "#/core/formats/TokenFormat";
import type { FormatDescriptor } from "#/core/formats/FormatDescriptor";
import { DesignMdReader } from "#/core/formats/design-md/DesignMdReader";
import { DesignMdWriter } from "#/core/formats/design-md/DesignMdWriter";
import { DtcgToDesignMdMapper } from "#/core/formats/design-md/DtcgToDesignMdMapper";
import { DtcgList } from "#/core/model/DtcgList";
import type { Dtcg } from "#/core/model/Dtcg";
import type { TokenWriter } from "#/core/formats/TokenWriter";

/**
 * DESIGN.md: markdown with the tokens in its YAML frontmatter.
 *
 * Detection looks for both frontmatter and prose headings, which distinguishes
 * it from a plain YAML document opening with {@code ---}.
 */
export const designMdFormat: FormatDescriptor = {
    format: TokenFormat.DESIGN_MD,
    suffixes: [".design.md", ".md"],
    detect: (content) => DesignMdReader.isDesignMd(content),
    createReader: () => DesignMdReader.create(),
    createWriter: () => new DesignMdDocumentWriter(),
};

/**
 * Writes a DTCG document as DESIGN.md.
 *
 * The DTCG tree (primitive/semantic/component) has to be flattened to the
 * DESIGN.md layout (colors/typography/rounded/spacing/components) first, which
 * is knowledge about this format and so belongs here rather than in the caller.
 */
class DesignMdDocumentWriter implements TokenWriter {
    write(doc: Dtcg): string {
        const mapped = new DtcgToDesignMdMapper().map(new DtcgList(doc));
        return new DesignMdWriter().write(mapped.base);
    }
}
