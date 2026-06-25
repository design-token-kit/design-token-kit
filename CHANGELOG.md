# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

<<<<<<< HEAD
### Added

- New `check --schema <path>` option to select the DTCG JSON Schema.
  Accepts a directory path or a built-in resource name. Built-in schemas:
  - `2025.10` (default) — original DTCG 2025.10, units `px` and `rem`
  - `2025.10-design.md` — adds `em` unit for DESIGN.md compatibility
=======
## [1.1.1] - 2026-06-24

### Changed

- Updated the HTML showcase layout for font and semantic token sections:
  font previews now use three-column grids and taller preview blocks for better
  readability.
>>>>>>> 2b59ec391291443628a0fac012d8f270e10d63b9

### Fixed

- Fixed CSS color serialization for native color spaces such as `hsl`, `hwb`,
  `lab`, `lch`, `oklab`, and `oklch`; the converter now emits native CSS
  functions instead of invalid `color(...)` output.

### Internal

- Added coverage scripts and Istanbul coverage configuration for CLI and core
  packages.
- Moved reusable example token files from `core/tokens` to top-level
  `examples`.
- Decoupled CLI and core tests from shared token fixtures by adding smaller
  focused fixtures and in-process command test helpers.

## [1.1.0] - 2026-06-22

### Added

- Add Design System Metrics #3 New `stats` command for token statistics from 
DTCG JSON and HRDT YAML sources.
  - Text report to stdout.
  - HTML report with `--out`.
  - Browser open support with `--open` when used together with `--out`.

### Fixed

- `showcase --open` now requires `--out`.
- `convert` now validates token model correctness before conversion and fails on
  model-invalid sources instead of producing output.

## [1.0.0] - 2026-06-22

### Added

- Lint: enforce token architecture conventions. Current checks:
  - `layer-reference`: a token may only reference the adjacent lower layer
    (e.g. `component` -> `semantic`, `semantic` -> `primitive`).
  - `raw-value-usage`: only the lowest layer (e.g. `primitive`) may hold raw
    values. Higher layers must reference instead.

  Usage: `dtokens check --scope lint`.

- New `check` command unifying validation and linting. `--scope` selects what to
  check: `schema`, `validate` (default), or `lint`.

### Deprecated

- The `validate` command is deprecated. Use `check` (or `check --scope validate`).

## [0.3.3] - 2026-06-17

### Changed

- #29 Updated showcase font cards: adjusted preview block sizing, font sorting,
  and semantic text wrapping for better readability.
- Added README links to the HRDT YAML article in the root, CLI, and core docs.

### Fixed

- #30 Fixed CSS generation for composite `typography` and `gradient` tokens so
  semantic aliases reference generated CSS variables instead of missing ones.

## [0.3.2] - 2026-06-16

### Changed

- Updated package README files for `@design-token-kit/core` and
  `@design-token-kit/cli`.

## [0.3.1] - 2026-06-13

### Fixed

- Fixed `showcase` input handling for stdin and Windows file paths.

## [0.3.0] - 2026-06-12

### Added

- Stdin support: all commands accept `-` to read from stdin, or read piped
  input when no file arguments are given.
- Multi-document YAML support: HRDT sources may contain multiple YAML documents
  separated by `---`. The first is the base, subsequent are themes.
- Exit codes shown in `--help` output for all commands.


## [0.2.1] - 2026-06-11

### Added

- Feature list and updated README.

## [0.2.0] - 2026-06-10

- Initial public release with `validate`, `convert`, and `showcase` commands.
