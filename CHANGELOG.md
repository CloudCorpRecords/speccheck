# Changelog

## 0.1.0 (2026-10-27)

- Initial release: `check_spec_coverage` MCP tool and
  `check` CLI command verifying that a spec's requirements
  are claimed by issues, pull requests, or code references,
  from caller-supplied requirement and claim facts only.
- Pinned coverage accounting: `claim_counts` maps every
  requirement id to its claim count (0 when unclaimed) with
  keys in requirements input order; `covered` and
  `uncovered` list ids in requirements input order;
  `dangling_claims` echoes claims naming no requirement, in
  claims input order, and they count nowhere.
- Pinned coverage and verdicts: `coverage_percent` is
  `Math.round(100 * covered / requirements)`; the verdict
  is `fully_covered` when nothing is uncovered,
  `mostly_covered` at 80 or above, `partial` at 50 or
  above, and `sparse` below that.
- Duplicate requirement ids are an error naming the id;
  duplicate claims are allowed and each one counts.
- Path-naming validation errors for malformed input,
  including the `source_kind` enum (`issue`, `pr`, `code`),
  a required non-empty `requirements` array, and a
  required (possibly empty) `claims` array.
