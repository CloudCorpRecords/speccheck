/**
 * speccheck types.
 *
 * speccheck verifies that a spec's requirements are
 * claimed by issues, pull requests, or code, from
 * caller-supplied facts only. The caller supplies the
 * spec's requirements (each with an id and its text) and
 * the claims (each naming a requirement id, the kind of
 * the claiming source, and a reference to that source).
 * From that data alone, as pure local computation,
 * speccheck reports:
 *
 *   - the covered requirement ids (claimed at least once)
 *   - the uncovered requirement ids (never claimed)
 *   - the dangling claims (naming no real requirement)
 *   - a claim count for every requirement
 *   - the coverage percentage and a verdict
 *
 * The verdict is pinned: "fully_covered" when nothing is
 * uncovered, otherwise "mostly_covered" at 80 percent or
 * above, "partial" at 50 or above, and "sparse" below
 * that. A claim's source kind is pinned to "issue", "pr",
 * or "code".
 */

/** Kind of the source that claims a requirement. */
export type SourceKind = "issue" | "pr" | "code";

/** Coverage verdict. */
export type SpecVerdict = "fully_covered" | "mostly_covered" | "partial" | "sparse";

/** One requirement from the spec, as supplied by the caller. */
export interface RequirementInput {
  /** Requirement identifier. */
  id: string;
  /** Requirement text. */
  text: string;
}

/** One claim that a source addresses a requirement. */
export interface ClaimInput {
  /** Id of the requirement being claimed. */
  requirement_id: string;
  /** Kind of the claiming source. */
  source_kind: SourceKind;
  /** Reference to the claiming source. */
  source_ref: string;
}

/** A claim whose requirement id matches no requirement. */
export interface DanglingClaim {
  /** Id the claim named, echoed from the claim. */
  requirement_id: string;
  /** Kind of the claiming source, echoed from the claim. */
  source_kind: SourceKind;
  /** Reference to the claiming source, echoed from the claim. */
  source_ref: string;
}

/** The requirement-to-claim coverage report for one spec. */
export interface SpecCoverageResult {
  /** Ids with at least one claim, in requirements input order. */
  covered: string[];
  /** Ids with no claims, in requirements input order. */
  uncovered: string[];
  /** Claims naming no requirement, in claims input order. */
  dangling_claims: DanglingClaim[];
  /** Claim count for every requirement id, keys in requirements input order. */
  claim_counts: Record<string, number>;
  /** Math.round(100 * covered count / requirement count). */
  coverage_percent: number;
  /** Coverage verdict. */
  verdict: SpecVerdict;
  /** Number of requirements supplied. */
  requirement_count: number;
  /** Number of claims supplied. */
  claim_count: number;
}
