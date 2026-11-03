# speccheck — Build Report

MCP Rebuild 1000, Batch 18. Original program build from the
packages-100 plan (cluster G #85), built from the spec in
`~/workspace/mcp-rebuild-100/specs-batch18/speccheck.md`
(read first). There is no external original; the tool surface
is the program's defined spec. Local build only — nothing
pushed or published.

Identity: repo `speccheck`, npm `@reneturcios/speccheck`,
MCP name `io.github.CloudCorpRecords/speccheck`, version
`0.1.0`, bin `speccheck` → `dist/cli.js`.

## Files created (19/19 per TEMPLATE.md checklist)

- `package.json`, `server.json` (description "Verify every
  spec requirement is claimed by an issue, PR, or code
  reference; list gaps." — 87 chars, verified by count; npm
  entry carries `version: 0.1.0`; OCI entry
  `ghcr.io/cloudcorprecords/speccheck:0.1.0` carries **no**
  `version` field), `Dockerfile` (node:20-alpine two-stage,
  label
  `io.modelcontextprotocol.server.name="io.github.CloudCorpRecords/speccheck"`),
  `tsconfig.json`, `.gitignore`, `LICENSE` (MIT, Copyright
  (c) 2026 Rene Turcios), `README.md` (fresh text),
  `CHANGELOG.md` (single 0.1.0 entry, 2026-10-27),
  `package-lock.json` (Route 3, see below)
- `src/index.ts`, `src/cli.ts` (`check --input <args.json>`
  where the file holds the full arguments object, `mcp`,
  `--version`; exit 2 usage / 1 runtime error, argument
  validation before any file read), `src/mcp.ts`,
  `src/types.ts`, `src/speccheck.ts` (core,
  `VERSION = "0.1.0"`, `formatPayload`)
- `test/speccheck.test.ts`
- `.github/workflows/{ci,publish,publish-container,registry-publish}.yml`
  (publish-container `IMAGE = ghcr.io/cloudcorprecords/speccheck`,
  smoke-test server-name assertion `speccheck`)

Plus the parity fixture at
`harness/fixtures/speccheck-tools-original.json`, labelled
as a program spec from the packages-100 plan cluster G #85.

## Tools implemented (1)

- `check_spec_coverage` — arguments: `requirements`
  (array, required, at least 1 item; each item an object
  with `id` and `text`, both required non-empty strings)
  and `claims` (array, required, may be empty; each item
  an object with `requirement_id` and `source_ref`, both
  required non-empty strings, and `source_kind`, required,
  one of "issue", "pr", "code" — carried as an `enum` in
  both the fixture and the `src/mcp.ts` literal).
  Required is exactly `["requirements", "claims"]`.

  Accounting is pinned: `claim_counts` maps every
  requirement id to the number of claims naming it (0 when
  unclaimed), with keys inserted in requirements input
  order; `covered` lists ids with claim count >= 1 and
  `uncovered` ids with claim count 0, both in requirements
  input order; `dangling_claims` echoes every claim whose
  `requirement_id` matches no requirement id, as
  `{requirement_id, source_kind, source_ref}`, in claims
  input order, and dangling claims count nowhere.
  Duplicate claims are allowed and each one counts;
  duplicate requirement ids are an error naming the id
  (`duplicate requirement id: REQ-2`) with no partial
  results. `coverage_percent` is
  `Math.round(100 * coveredCount / requirementCount)`.

  Verdict is pinned: `uncovered` empty → "fully_covered";
  otherwise `coverage_percent >= 80` → "mostly_covered";
  `>= 50` → "partial"; otherwise → "sparse".

  Returns `{covered, uncovered, dangling_claims,
  claim_counts, coverage_percent, verdict,
  requirement_count, claim_count}`, where `claim_count`
  counts every supplied claim, dangling ones included.

  The fixture literal
  (`harness/fixtures/speccheck-tools-original.json`) and
  the `src/mcp.ts` literal are identical, with no `$schema`
  and no `additionalProperties` — confirmed by the parity
  run below.

## Implementation notes

- `src/mcp.ts` uses the SDK's low-level `Server` with an
  explicit inputSchema literal exactly matching the
  fixture, per the standing fleet rule (no McpServer/zod
  schema conversion). Every `tools/call` is validated by
  the core itself, so the MCP and CLI paths share one
  validation implementation; the core takes the full
  arguments object.
- Validation is path-naming and total: a missing,
  non-array, or empty `requirements`; a missing or
  non-array `claims`; a non-object item; a missing, empty,
  or non-string `id`, `text`, `requirement_id`, or
  `source_ref`; a missing or out-of-enum `source_kind`
  (exact message `claims[0].source_kind must be one of:
  issue, pr, code`); or a duplicate requirement id throws
  an Error naming the offending path and produces no
  partial result (MCP: `isError`; CLI: exit 1). Unknown
  extra fields are ignored, including inside items; a
  non-object top-level argument is treated as {}.
- Counts are accumulated in a `Map` seeded in requirements
  input order and materialised with `Object.fromEntries`,
  so `claim_counts` key order is exactly the requirements
  input order and an id like `__proto__` cannot corrupt
  the counts object.

## Verification (foreground, this session)

- `npm test` (`tsx --test test/*.test.ts`): **65 tests,
  65 pass, 0 fail** — full coverage with the exact output
  shape; all three `source_kind` values accepted; empty
  claims array (all uncovered, coverage 0, verdict
  "sparse"); `claim_counts` including 0-count requirements
  and preserving requirements input order in its keys;
  covered/uncovered in input order; duplicate claims
  counted twice (and three times); dangling claims echoed
  in claims input order with exactly the three pinned
  fields, never counted in `claim_counts` or coverage,
  while `claim_count` still counts them; duplicate
  requirement id errors naming the id (trailing, leading,
  and adjacent duplicates); coverage rounding (2/3 → 67,
  1/3 → 33, 5/6 → 83, 1/6 → 17) and every verdict boundary
  (exactly 80 → "mostly_covered", 79 → "partial", exactly
  50 → "partial", 49 → "sparse", 99/100 →
  "mostly_covered", plus the rounded-edge case 159/200 =
  79.5 → 80 → "mostly_covered"); and every validation path
  (requirements missing / non-array / empty, item
  non-object / null / array, `id` and `text` missing /
  empty / non-string with the failing index named, claims
  missing / non-array but empty valid, claim item
  non-object / null, `requirement_id` and `source_ref`
  missing / empty / non-string, `source_kind` missing /
  unknown / wrongly cased / non-string with the exact
  pinned enum message, non-object top-level treated as {},
  unknown extras ignored at every level, dangling echo
  carrying no extra fields).
- `npx tsc --noEmit` → exit 0; `npm run build` produced
  `dist/` with all 15 outputs.
- `dist/cli.js --version` → `0.1.0`; unknown command exits
  2 with usage; `check` with no `--input` exits 2;
  `check --input <missing file>` exits 1 naming the file;
  `check --input <valid file>` exits 0 and prints the
  hand-checked result for the README example input
  (covered ["REQ-1", "REQ-2"], uncovered ["REQ-3"], one
  dangling claim for REQ-9, claim_counts {REQ-1: 2,
  REQ-2: 1, REQ-3: 0}, coverage_percent 67, verdict
  "partial", requirement_count 3, claim_count 4);
  `check --input <invalid file>` (`source_kind: "ticket"`)
  exits 1 with `claims[0].source_kind must be one of:
  issue, pr, code`.
- Parity: `harness/parity.py` vs
  `harness/fixtures/speccheck-tools-original.json` →
  **PASS, parity 100.0, identical_tools 1/1** (run with
  the rebuild path as an absolute path; the harness does
  not expand a `~` inside the quoted stdio command
  string). Report saved under `parity-out/`.

## Lockfile status

`package-lock.json` generated clean via Route 3 (in the
build directory with no `node_modules` present, offline
`npm install --package-lock-only --ignore-scripts
--offline`), verified: parses, name
`@reneturcios/speccheck`, **128 package entries**.
Resolved versions match the sibling reference tree
(`@modelcontextprotocol/sdk` 1.32.2, `zod` 3.25.76,
`tsx` 4.23.15, `typescript` 5.9.3, `@types/node`
20.19.43). The subsequent offline
`npm install --ignore-scripts --offline`, build, tests,
and parity all ran against this lockfile's tree.

## Gaps / honest notes

- **Pinned judgement calls** (each with a dedicated test
  where applicable): (1) the verdict band is applied to
  the *rounded* `coverage_percent`, per the spec's
  wording ("coverage_percent >= 80" where
  coverage_percent is itself defined as the rounded
  value) — pinned by the 159/200 → 80 → "mostly_covered"
  test; (2) `claim_count` counts every supplied claim
  including dangling ones, since the spec defines it as
  part of the output without scoping it to matched claims
  and `requirement_count` symmetrically counts every
  supplied requirement; (3) for a missing field the error
  reads `<path> is required` and for a present-but-invalid
  field `<path> must be a non-empty string`, following the
  fleet's path-naming pattern; the one message the spec
  pins verbatim, the `source_kind` enum message, is used
  exactly; (4) the duplicate-id check fires while the
  requirements are parsed in input order, so the first
  repeated id is the one named; (5) the empty-requirements
  message is `requirements must contain at least 1 item`,
  the spec pinning the condition (at least 1 item) but not
  the wording. No other spec ambiguity was found in the
  core behaviour.
- Adjacency: linkedcheck (Batch 17) verifies one PR
  against the issue it claims to close; speccheck is a
  separate artifact over whole-spec coverage, per the
  spec's adjacency note. No code was shared.
- Container build not exercised locally; the
  publish-container workflow smoke-tests the image at
  publish time.
- Nothing pushed or published; this is a local build only.
