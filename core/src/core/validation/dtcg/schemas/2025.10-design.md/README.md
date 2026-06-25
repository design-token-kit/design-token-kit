## 2025.10-design.md — DTCG 2025.10 schema adapted for DESIGN.md

Copy of DTCG 2025.10 schemas. Used exclusively for DESIGN.md → DTCG compatibility.

### format/values/dimension.json

Added `"em"` to allowed units: `["px", "em", "rem"]`.

Design.md spec (spec-config.yaml:28) allows `em` for dimension values.
Original DTCG schema only allows `px` and `rem`.
