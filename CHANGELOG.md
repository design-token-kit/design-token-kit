# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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
