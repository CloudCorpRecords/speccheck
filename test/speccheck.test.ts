import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkSpecCoverage } from "../src/speccheck.js";

/**
 * All tests are pure local computation over inline
 * requirement and claim objects: no filesystem and no
 * network. Full coverage, the empty-claims case, claim
 * counting (zero counts, key order, duplicates), dangling
 * claims (echo order, counted nowhere), the duplicate
 * requirement id error, coverage rounding, every verdict
 * boundary, all three source kinds, and every validation
 * path are each pinned.
 */

const req = (id: string) => ({ id, text: `text for ${id}` });

const claim = (
  requirement_id: string,
  source_kind = "issue",
  source_ref = "issue #1",
) => ({ requirement_id, source_kind, source_ref });

/** n requirements R1..Rn, the first k of them claimed once each. */
function coverageOf(total: number, coveredCount: number) {
  const requirements = Array.from({ length: total }, (_, i) => req(`R${i + 1}`));
  const claims = Array.from({ length: coveredCount }, (_, i) =>
    claim(`R${i + 1}`),
  );
  return checkSpecCoverage({ requirements, claims });
}

function throwsWith(fn: () => unknown, message: string) {
  assert.throws(
    fn,
    (e: unknown) => e instanceof Error && e.message === message,
  );
}

describe("checkSpecCoverage — full coverage", () => {
  it("every requirement claimed gives fully_covered with the exact output shape", () => {
    const out = checkSpecCoverage({
      requirements: [req("REQ-1"), req("REQ-2")],
      claims: [claim("REQ-1", "pr", "PR #7"), claim("REQ-2", "code", "src/x.ts")],
    });
    assert.deepEqual(out, {
      covered: ["REQ-1", "REQ-2"],
      uncovered: [],
      dangling_claims: [],
      claim_counts: { "REQ-1": 1, "REQ-2": 1 },
      coverage_percent: 100,
      verdict: "fully_covered",
      requirement_count: 2,
      claim_count: 2,
    });
  });

  it("a single requirement claimed once is fully_covered at 100", () => {
    const out = checkSpecCoverage({
      requirements: [req("ONLY")],
      claims: [claim("ONLY")],
    });
    assert.equal(out.coverage_percent, 100);
    assert.equal(out.verdict, "fully_covered");
  });

  it("all three source_kind values are accepted and each counts", () => {
    const out = checkSpecCoverage({
      requirements: [req("REQ-1")],
      claims: [
        claim("REQ-1", "issue", "issue #1"),
        claim("REQ-1", "pr", "PR #2"),
        claim("REQ-1", "code", "src/a.ts"),
      ],
    });
    assert.equal(out.claim_counts["REQ-1"], 3);
    assert.equal(out.verdict, "fully_covered");
  });
});

describe("checkSpecCoverage — claim counts and ordering", () => {
  it("claim_counts includes 0-count requirements", () => {
    const out = checkSpecCoverage({
      requirements: [req("REQ-1"), req("REQ-2"), req("REQ-3")],
      claims: [claim("REQ-2")],
    });
    assert.deepEqual(out.claim_counts, { "REQ-1": 0, "REQ-2": 1, "REQ-3": 0 });
  });

  it("claim_counts keys preserve requirements input order, not claim or sorted order", () => {
    const out = checkSpecCoverage({
      requirements: [req("REQ-3"), req("REQ-1"), req("REQ-2")],
      claims: [claim("REQ-2"), claim("REQ-2")],
    });
    assert.deepEqual(Object.keys(out.claim_counts), ["REQ-3", "REQ-1", "REQ-2"]);
    assert.deepEqual(out.claim_counts, { "REQ-3": 0, "REQ-1": 0, "REQ-2": 2 });
  });

  it("covered and uncovered both preserve requirements input order", () => {
    const out = checkSpecCoverage({
      requirements: [req("REQ-3"), req("REQ-1"), req("REQ-2"), req("REQ-4")],
      claims: [claim("REQ-4"), claim("REQ-1")],
    });
    assert.deepEqual(out.covered, ["REQ-1", "REQ-4"]);
    assert.deepEqual(out.uncovered, ["REQ-3", "REQ-2"]);
  });

  it("duplicate claims are allowed and each one counts", () => {
    const dup = claim("REQ-1", "issue", "issue #9");
    const out = checkSpecCoverage({
      requirements: [req("REQ-1")],
      claims: [dup, dup, dup],
    });
    assert.equal(out.claim_counts["REQ-1"], 3);
    assert.equal(out.claim_count, 3);
  });

  it("distinct claims from different sources for one requirement all count", () => {
    const out = checkSpecCoverage({
      requirements: [req("REQ-1"), req("REQ-2")],
      claims: [
        claim("REQ-1", "issue", "issue #1"),
        claim("REQ-1", "issue", "issue #2"),
        claim("REQ-1", "pr", "PR #3"),
      ],
    });
    assert.equal(out.claim_counts["REQ-1"], 3);
    assert.equal(out.claim_counts["REQ-2"], 0);
  });
});

describe("checkSpecCoverage — empty claims", () => {
  it("an empty claims array leaves everything uncovered at 0, sparse", () => {
    const out = checkSpecCoverage({
      requirements: [req("REQ-1"), req("REQ-2")],
      claims: [],
    });
    assert.deepEqual(out, {
      covered: [],
      uncovered: ["REQ-1", "REQ-2"],
      dangling_claims: [],
      claim_counts: { "REQ-1": 0, "REQ-2": 0 },
      coverage_percent: 0,
      verdict: "sparse",
      requirement_count: 2,
      claim_count: 0,
    });
  });

  it("a single requirement with no claims is 0 percent, sparse", () => {
    const out = checkSpecCoverage({ requirements: [req("REQ-1")], claims: [] });
    assert.equal(out.coverage_percent, 0);
    assert.equal(out.verdict, "sparse");
  });
});

describe("checkSpecCoverage — dangling claims", () => {
  it("dangling claims echo in claims input order with all three fields", () => {
    const out = checkSpecCoverage({
      requirements: [req("REQ-1")],
      claims: [
        claim("REQ-9", "issue", "issue #401"),
        claim("REQ-1", "pr", "PR #5"),
        claim("REQ-7", "code", "src/gone.ts"),
        claim("REQ-8", "pr", "PR #6"),
      ],
    });
    assert.deepEqual(out.dangling_claims, [
      { requirement_id: "REQ-9", source_kind: "issue", source_ref: "issue #401" },
      { requirement_id: "REQ-7", source_kind: "code", source_ref: "src/gone.ts" },
      { requirement_id: "REQ-8", source_kind: "pr", source_ref: "PR #6" },
    ]);
  });

  it("dangling claims are not counted in claim_counts or coverage", () => {
    const out = checkSpecCoverage({
      requirements: [req("REQ-1"), req("REQ-2")],
      claims: [claim("REQ-1"), claim("REQ-X"), claim("REQ-X")],
    });
    assert.deepEqual(out.claim_counts, { "REQ-1": 1, "REQ-2": 0 });
    assert.equal(out.coverage_percent, 50);
    assert.equal(out.dangling_claims.length, 2);
  });

  it("claim_count counts every supplied claim, dangling included", () => {
    const out = checkSpecCoverage({
      requirements: [req("REQ-1")],
      claims: [claim("REQ-1"), claim("REQ-Z"), claim("REQ-Y")],
    });
    assert.equal(out.claim_count, 3);
    assert.equal(out.requirement_count, 1);
  });

  it("when every claim dangles, coverage is 0 and all counts are 0", () => {
    const out = checkSpecCoverage({
      requirements: [req("REQ-1"), req("REQ-2")],
      claims: [claim("REQ-9"), claim("REQ-9")],
    });
    assert.deepEqual(out.claim_counts, { "REQ-1": 0, "REQ-2": 0 });
    assert.equal(out.coverage_percent, 0);
    assert.equal(out.verdict, "sparse");
    assert.equal(out.dangling_claims.length, 2);
  });

  it("duplicate dangling claims each echo separately", () => {
    const out = checkSpecCoverage({
      requirements: [req("REQ-1")],
      claims: [claim("REQ-9", "issue", "issue #1"), claim("REQ-9", "issue", "issue #1")],
    });
    assert.equal(out.dangling_claims.length, 2);
    assert.deepEqual(out.dangling_claims[0], out.dangling_claims[1]);
  });
});

describe("checkSpecCoverage — duplicate requirement ids", () => {
  it("a duplicate requirement id is an error naming the id", () => {
    throwsWith(
      () =>
        checkSpecCoverage({
          requirements: [req("REQ-1"), req("REQ-2"), req("REQ-2")],
          claims: [],
        }),
      "duplicate requirement id: REQ-2",
    );
  });

  it("a duplicate of the first id later in the list errors too", () => {
    throwsWith(
      () =>
        checkSpecCoverage({
          requirements: [req("REQ-1"), req("REQ-2"), req("REQ-3"), req("REQ-1")],
          claims: [claim("REQ-1")],
        }),
      "duplicate requirement id: REQ-1",
    );
  });

  it("adjacent duplicates error with no partial result", () => {
    throwsWith(
      () =>
        checkSpecCoverage({
          requirements: [req("REQ-5"), req("REQ-5")],
          claims: [claim("REQ-5")],
        }),
      "duplicate requirement id: REQ-5",
    );
  });
});

describe("checkSpecCoverage — coverage rounding and verdict bands", () => {
  it("2 of 3 rounds to 67 and is partial", () => {
    const out = coverageOf(3, 2);
    assert.equal(out.coverage_percent, 67);
    assert.equal(out.verdict, "partial");
  });

  it("1 of 3 rounds to 33 and is sparse", () => {
    const out = coverageOf(3, 1);
    assert.equal(out.coverage_percent, 33);
    assert.equal(out.verdict, "sparse");
  });

  it("5 of 6 rounds to 83 and is mostly_covered", () => {
    const out = coverageOf(6, 5);
    assert.equal(out.coverage_percent, 83);
    assert.equal(out.verdict, "mostly_covered");
  });

  it("1 of 6 rounds to 17 and is sparse", () => {
    const out = coverageOf(6, 1);
    assert.equal(out.coverage_percent, 17);
    assert.equal(out.verdict, "sparse");
  });

  it("exactly 80 is mostly_covered", () => {
    const out = coverageOf(5, 4);
    assert.equal(out.coverage_percent, 80);
    assert.equal(out.verdict, "mostly_covered");
  });

  it("79 is partial, just below the mostly_covered band", () => {
    const out = coverageOf(19, 15);
    assert.equal(out.coverage_percent, 79);
    assert.equal(out.verdict, "partial");
  });

  it("exactly 50 is partial", () => {
    const out = coverageOf(2, 1);
    assert.equal(out.coverage_percent, 50);
    assert.equal(out.verdict, "partial");
  });

  it("49 is sparse, just below the partial band", () => {
    const out = coverageOf(35, 17);
    assert.equal(out.coverage_percent, 49);
    assert.equal(out.verdict, "sparse");
  });

  it("99 of 100 is mostly_covered, not fully_covered", () => {
    const out = coverageOf(100, 99);
    assert.equal(out.coverage_percent, 99);
    assert.equal(out.verdict, "mostly_covered");
    assert.equal(out.uncovered.length, 1);
  });

  it("the verdict uses the rounded percentage at the band edge", () => {
    // 159/200 = 79.5 rounds to 80, which lands in mostly_covered.
    const out = coverageOf(200, 159);
    assert.equal(out.coverage_percent, 80);
    assert.equal(out.verdict, "mostly_covered");
  });
});

describe("checkSpecCoverage — validation: requirements", () => {
  it("missing requirements errors", () => {
    throwsWith(() => checkSpecCoverage({ claims: [] }), "requirements is required");
  });

  it("non-array requirements errors (string)", () => {
    throwsWith(
      () => checkSpecCoverage({ requirements: "REQ-1", claims: [] }),
      "requirements must be an array",
    );
  });

  it("non-array requirements errors (object)", () => {
    throwsWith(
      () => checkSpecCoverage({ requirements: { id: "REQ-1" }, claims: [] }),
      "requirements must be an array",
    );
  });

  it("an empty requirements array errors", () => {
    throwsWith(
      () => checkSpecCoverage({ requirements: [], claims: [] }),
      "requirements must contain at least 1 item",
    );
  });

  it("a non-object requirement item errors naming its index", () => {
    throwsWith(
      () => checkSpecCoverage({ requirements: ["REQ-1"], claims: [] }),
      "requirements[0] must be an object",
    );
  });

  it("a null requirement item errors", () => {
    throwsWith(
      () => checkSpecCoverage({ requirements: [null], claims: [] }),
      "requirements[0] must be an object",
    );
  });

  it("an array requirement item errors", () => {
    throwsWith(
      () => checkSpecCoverage({ requirements: [["REQ-1", "text"]], claims: [] }),
      "requirements[0] must be an object",
    );
  });

  it("a missing id errors naming the path", () => {
    throwsWith(
      () => checkSpecCoverage({ requirements: [{ text: "t" }], claims: [] }),
      "requirements[0].id is required",
    );
  });

  it("an empty id errors", () => {
    throwsWith(
      () => checkSpecCoverage({ requirements: [{ id: "", text: "t" }], claims: [] }),
      "requirements[0].id must be a non-empty string",
    );
  });

  it("a non-string id errors", () => {
    throwsWith(
      () => checkSpecCoverage({ requirements: [{ id: 7, text: "t" }], claims: [] }),
      "requirements[0].id must be a non-empty string",
    );
  });

  it("a missing text errors naming the path", () => {
    throwsWith(
      () => checkSpecCoverage({ requirements: [{ id: "REQ-1" }], claims: [] }),
      "requirements[0].text is required",
    );
  });

  it("an empty text errors", () => {
    throwsWith(
      () =>
        checkSpecCoverage({ requirements: [{ id: "REQ-1", text: "" }], claims: [] }),
      "requirements[0].text must be a non-empty string",
    );
  });

  it("a non-string text errors", () => {
    throwsWith(
      () =>
        checkSpecCoverage({ requirements: [{ id: "REQ-1", text: 42 }], claims: [] }),
      "requirements[0].text must be a non-empty string",
    );
  });

  it("the error path names the failing item's index", () => {
    throwsWith(
      () =>
        checkSpecCoverage({
          requirements: [req("REQ-1"), req("REQ-2"), { id: "", text: "t" }],
          claims: [],
        }),
      "requirements[2].id must be a non-empty string",
    );
  });
});

describe("checkSpecCoverage — validation: claims", () => {
  const reqs = [req("REQ-1")];

  it("missing claims errors", () => {
    throwsWith(
      () => checkSpecCoverage({ requirements: reqs }),
      "claims is required",
    );
  });

  it("non-array claims errors", () => {
    throwsWith(
      () => checkSpecCoverage({ requirements: reqs, claims: "issue #1" }),
      "claims must be an array",
    );
  });

  it("an empty claims array is valid", () => {
    const out = checkSpecCoverage({ requirements: reqs, claims: [] });
    assert.equal(out.claim_count, 0);
  });

  it("a non-object claim item errors naming its index", () => {
    throwsWith(
      () => checkSpecCoverage({ requirements: reqs, claims: ["REQ-1"] }),
      "claims[0] must be an object",
    );
  });

  it("a null claim item errors", () => {
    throwsWith(
      () => checkSpecCoverage({ requirements: reqs, claims: [null] }),
      "claims[0] must be an object",
    );
  });

  it("a missing requirement_id errors naming the path", () => {
    throwsWith(
      () =>
        checkSpecCoverage({
          requirements: reqs,
          claims: [{ source_kind: "issue", source_ref: "issue #1" }],
        }),
      "claims[0].requirement_id is required",
    );
  });

  it("an empty requirement_id errors", () => {
    throwsWith(
      () => checkSpecCoverage({ requirements: reqs, claims: [claim("")] }),
      "claims[0].requirement_id must be a non-empty string",
    );
  });

  it("a non-string requirement_id errors", () => {
    throwsWith(
      () =>
        checkSpecCoverage({
          requirements: reqs,
          claims: [{ requirement_id: 3, source_kind: "issue", source_ref: "x" }],
        }),
      "claims[0].requirement_id must be a non-empty string",
    );
  });

  it("a missing source_kind errors naming the path", () => {
    throwsWith(
      () =>
        checkSpecCoverage({
          requirements: reqs,
          claims: [{ requirement_id: "REQ-1", source_ref: "issue #1" }],
        }),
      "claims[0].source_kind is required",
    );
  });

  it("an unknown source_kind errors with the pinned enum message", () => {
    throwsWith(
      () =>
        checkSpecCoverage({
          requirements: reqs,
          claims: [claim("REQ-1", "ticket", "ticket #1")],
        }),
      "claims[0].source_kind must be one of: issue, pr, code",
    );
  });

  it("a wrongly-cased source_kind errors", () => {
    throwsWith(
      () =>
        checkSpecCoverage({
          requirements: reqs,
          claims: [claim("REQ-1", "Issue", "issue #1")],
        }),
      "claims[0].source_kind must be one of: issue, pr, code",
    );
  });

  it("a non-string source_kind errors with the enum message", () => {
    throwsWith(
      () =>
        checkSpecCoverage({
          requirements: reqs,
          claims: [{ requirement_id: "REQ-1", source_kind: 1, source_ref: "x" }],
        }),
      "claims[0].source_kind must be one of: issue, pr, code",
    );
  });

  it("a missing source_ref errors naming the path", () => {
    throwsWith(
      () =>
        checkSpecCoverage({
          requirements: reqs,
          claims: [{ requirement_id: "REQ-1", source_kind: "pr" }],
        }),
      "claims[0].source_ref is required",
    );
  });

  it("an empty source_ref errors", () => {
    throwsWith(
      () =>
        checkSpecCoverage({
          requirements: reqs,
          claims: [claim("REQ-1", "pr", "")],
        }),
      "claims[0].source_ref must be a non-empty string",
    );
  });

  it("a non-string source_ref errors", () => {
    throwsWith(
      () =>
        checkSpecCoverage({
          requirements: reqs,
          claims: [{ requirement_id: "REQ-1", source_kind: "pr", source_ref: 12 }],
        }),
      "claims[0].source_ref must be a non-empty string",
    );
  });

  it("the error path names the failing claim's index", () => {
    throwsWith(
      () =>
        checkSpecCoverage({
          requirements: reqs,
          claims: [claim("REQ-1"), claim("REQ-1", "wiki", "page 3")],
        }),
      "claims[1].source_kind must be one of: issue, pr, code",
    );
  });
});

describe("checkSpecCoverage — top-level shape and extra fields", () => {
  it("a null top-level argument is treated as {} and fails on requirements", () => {
    throwsWith(() => checkSpecCoverage(null), "requirements is required");
  });

  it("an array top-level argument is treated as {}", () => {
    throwsWith(() => checkSpecCoverage([1, 2]), "requirements is required");
  });

  it("a string top-level argument is treated as {}", () => {
    throwsWith(() => checkSpecCoverage("nope"), "requirements is required");
  });

  it("an undefined top-level argument is treated as {}", () => {
    throwsWith(() => checkSpecCoverage(undefined), "requirements is required");
  });

  it("unknown extra top-level fields are ignored", () => {
    const out = checkSpecCoverage({
      requirements: [req("REQ-1")],
      claims: [claim("REQ-1")],
      spec_name: "auth spec",
      version: 3,
    });
    assert.equal(out.verdict, "fully_covered");
  });

  it("unknown extra fields inside items are ignored", () => {
    const out = checkSpecCoverage({
      requirements: [{ id: "REQ-1", text: "t", priority: "high" }],
      claims: [
        {
          requirement_id: "REQ-1",
          source_kind: "issue",
          source_ref: "issue #1",
          author: "someone",
        },
      ],
    });
    assert.deepEqual(out.claim_counts, { "REQ-1": 1 });
    assert.deepEqual(out.dangling_claims, []);
  });

  it("extra fields on a dangling claim do not leak into the echo", () => {
    const out = checkSpecCoverage({
      requirements: [req("REQ-1")],
      claims: [
        {
          requirement_id: "REQ-9",
          source_kind: "pr",
          source_ref: "PR #3",
          extra: true,
        },
      ],
    });
    assert.deepEqual(out.dangling_claims, [
      { requirement_id: "REQ-9", source_kind: "pr", source_ref: "PR #3" },
    ]);
  });
});
