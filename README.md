# speccheck

A spec is only as good as the work that actually answers
it. Requirements get written, issues get filed, pull
requests get merged, code lands — and somewhere in that
pile the mapping between "what the spec asked for" and
"what claims to have done it" quietly rots. speccheck
audits that mapping. You supply the spec's requirements
and the claims made against them, and it reports which
requirements are covered, which are not, which claims
point at requirements that do not exist, and how many
claims each requirement collected.

Nothing is fetched. A requirement counts as covered the
moment at least one claim names its id; the claiming
source can be an issue, a pull request, or a code
reference, and duplicate claims each count — three issues
claiming the same requirement is a fact worth seeing in
the count, not noise to deduplicate. A claim naming an id
that no requirement has is dangling: it is echoed back in
full, in the order the claims arrived, and it counts
nowhere — not toward coverage, not toward any
requirement's total. It usually means a renamed
requirement or a typo, and either way it is the spec
owner's problem to see, not the tool's to guess at.

The verdict compresses the report into one word. If
every requirement is claimed, the spec is
`fully_covered`. Otherwise the coverage percentage —
covered over total, rounded to the nearest integer —
decides: 80 or above is `mostly_covered`, 50 or above is
`partial`, and anything lower is `sparse`. The counts
always travel with the verdict, so the word never has to
be taken on faith.

Malformed input is a validation error naming the
offending path, with no partial result: `requirements`
must be a non-empty array of objects each carrying a
non-empty `id` and `text`, requirement ids must be
unique (a duplicate is an error naming the id), and
`claims` must be an array — possibly empty — of objects
each carrying a non-empty `requirement_id` and
`source_ref` plus a `source_kind` of `issue`, `pr`, or
`code`. Unknown extra fields are ignored. The computation
is pure and local: no network, no configuration, and no
repository is read or touched.

## CLI

```bash
npx @reneturcios/speccheck check --input args.json
npx @reneturcios/speccheck --version
```

`args.json` contains the full arguments object:

```json
{
  "requirements": [
    { "id": "REQ-1", "text": "Users can sign in with a passkey" },
    { "id": "REQ-2", "text": "Sessions expire after 24 hours" },
    { "id": "REQ-3", "text": "Admins can revoke any session" }
  ],
  "claims": [
    { "requirement_id": "REQ-1", "source_kind": "pr", "source_ref": "PR #412" },
    { "requirement_id": "REQ-1", "source_kind": "issue", "source_ref": "issue #388" },
    { "requirement_id": "REQ-2", "source_kind": "code", "source_ref": "src/session.ts" },
    { "requirement_id": "REQ-9", "source_kind": "issue", "source_ref": "issue #401" }
  ]
}
```

The result is printed as JSON:

```json
{
  "covered": ["REQ-1", "REQ-2"],
  "uncovered": ["REQ-3"],
  "dangling_claims": [
    { "requirement_id": "REQ-9", "source_kind": "issue", "source_ref": "issue #401" }
  ],
  "claim_counts": { "REQ-1": 2, "REQ-2": 1, "REQ-3": 0 },
  "coverage_percent": 67,
  "verdict": "partial",
  "requirement_count": 3,
  "claim_count": 4
}
```

`claim_counts` carries an entry for every requirement,
including zeros, with keys in the order the requirements
were supplied. Exit codes: `0` on success, `1` on a
runtime error (including an unreadable or invalid input
file, or invalid input), `2` on a usage error.

## MCP server

```bash
npx -y @reneturcios/speccheck mcp
```

MCP client config:

```json
{
  "mcpServers": {
    "speccheck": {
      "command": "npx",
      "args": ["-y", "@reneturcios/speccheck", "mcp"]
    }
  }
}
```

### Tools

- `check_spec_coverage` — Verify a spec's requirements
  are claimed by issues, pull requests, or code, from
  caller-supplied requirement and claim facts.
  - `requirements` (array, required, at least 1 item) —
    the spec's requirements; each item is an object with
    a non-empty `id` and `text`, and ids must be unique
  - `claims` (array, required, may be empty) — claims
    that an issue, pull request, or code reference
    addresses a requirement; each item is an object with
    a non-empty `requirement_id`, a `source_kind` of
    `issue`, `pr`, or `code`, and a non-empty `source_ref`

  Returns `{covered, uncovered, dangling_claims,
  claim_counts, coverage_percent, verdict,
  requirement_count, claim_count}`.

## Docker

```bash
docker run -i ghcr.io/cloudcorprecords/speccheck
docker run --rm -v "$PWD:/w" ghcr.io/cloudcorprecords/speccheck check --input /w/args.json
```

## Development

```bash
npm install
npm run build   # tsc -> dist/
npm test        # tsx --test test/*.test.ts (pure local, no network)
npm run dev     # run the CLI from source
```

## License

MIT — Copyright (c) 2026 Rene Turcios
