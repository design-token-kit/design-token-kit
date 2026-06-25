## 2025.10-ext -- DTCG 2025.10 schema extended for DESIGN.md

Full copy of DTCG 2025.10 schemas with the following modifications:

### format/values/dimension.json

- Added `"em"` to allowed units: `["px", "em", "rem"]`
- Reason: DESIGN.md spec allows `em` for dimension values (spec-config.yaml:28).
  Original DTCG schema only allows `px` and `rem`.
  This extension is needed for DESIGN.md → DTCG conversion to pass schema validation.
