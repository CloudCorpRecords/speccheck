/**
 * speccheck core: verify a spec's requirements are claimed
 * by issues, pull requests, or code, from caller-supplied
 * requirement and claim facts only.
 *
 *   checkSpecCoverage(args) -> { covered, uncovered,
 *     dangling_claims, claim_counts, coverage_percent,
 *     verdict, requirement_count, claim_count }
 *
 * Accounting (pinned):
 *   - claim_counts maps EVERY requirement id to the number
 *     of claims naming it (0 when unclaimed); keys are
 *     inserted in requirements input order.
 *   - covered lists the ids with claim count >= 1 and
 *     uncovered the ids with claim count 0, both in
 *     requirements input order.
 *   - dangling_claims echoes every claim whose
 *     requirement_id matches no requirement id, as
 *     { requirement_id, source_kind, source_ref }, in
 *     claims input order. Dangling claims count nowhere.
 *   - Duplicate claims are allowed and each one counts.
 *   - coverage_percent = Math.round(100 * coveredCount /
 *     requirementCount), an integer.
 *
 * Verdict (pinned): uncovered is empty -> "fully_covered";
 * otherwise coverage_percent >= 80 -> "mostly_covered";
 * >= 50 -> "partial"; otherwise -> "sparse".
 *
 * Validation is strict and path-naming: a missing,
 * non-array, or empty `requirements`; a missing or
 * non-array `claims`; a non-object item; a missing, empty,
 * or non-string `id`, `text`, `requirement_id`, or
 * `source_ref`; a `source_kind` that is missing or not
 * one of "issue", "pr", "code"; or a duplicate requirement
 * id (an error naming the id) throws an Error naming the
 * offending path and produces no partial result. Unknown
 * extra fields are ignored, including inside items; a
 * non-object top-level argument is treated as {}.
 */
import type {
  ClaimInput,
  DanglingClaim,
  RequirementInput,
  SourceKind,
  SpecCoverageResult,
  SpecVerdict,
} from "./types.js";

export const VERSION = "0.1.0";

const SOURCE_KINDS: readonly SourceKind[] = ["issue", "pr", "code"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(
  raw: Record<string, unknown>,
  path: string,
  key: string,
): string {
  const value = raw[key];
  if (value === undefined) throw new Error(`${path} is required`);
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${path} must be a non-empty string`);
  }
  return value;
}

function parseRequirements(raw: Record<string, unknown>): RequirementInput[] {
  if (raw.requirements === undefined) {
    throw new Error("requirements is required");
  }
  if (!Array.isArray(raw.requirements)) {
    throw new Error("requirements must be an array");
  }
  if (raw.requirements.length === 0) {
    throw new Error("requirements must contain at least 1 item");
  }
  const requirements: RequirementInput[] = [];
  const seen = new Set<string>();
  raw.requirements.forEach((item: unknown, i: number) => {
    if (!isRecord(item)) {
      throw new Error(`requirements[${i}] must be an object`);
    }
    const id = requiredString(item, `requirements[${i}].id`, "id");
    const text = requiredString(item, `requirements[${i}].text`, "text");
    if (seen.has(id)) {
      throw new Error(`duplicate requirement id: ${id}`);
    }
    seen.add(id);
    requirements.push({ id, text });
  });
  return requirements;
}

function parseClaims(raw: Record<string, unknown>): ClaimInput[] {
  if (raw.claims === undefined) {
    throw new Error("claims is required");
  }
  if (!Array.isArray(raw.claims)) {
    throw new Error("claims must be an array");
  }
  const claims: ClaimInput[] = [];
  raw.claims.forEach((item: unknown, i: number) => {
    if (!isRecord(item)) {
      throw new Error(`claims[${i}] must be an object`);
    }
    const requirementId = requiredString(
      item,
      `claims[${i}].requirement_id`,
      "requirement_id",
    );
    if (item.source_kind === undefined) {
      throw new Error(`claims[${i}].source_kind is required`);
    }
    if (
      typeof item.source_kind !== "string" ||
      !(SOURCE_KINDS as readonly string[]).includes(item.source_kind)
    ) {
      throw new Error(
        `claims[${i}].source_kind must be one of: issue, pr, code`,
      );
    }
    const sourceKind = item.source_kind as SourceKind;
    const sourceRef = requiredString(item, `claims[${i}].source_ref`, "source_ref");
    claims.push({
      requirement_id: requirementId,
      source_kind: sourceKind,
      source_ref: sourceRef,
    });
  });
  return claims;
}

/** Verify a spec's requirements are claimed by issues, PRs, or code. */
export function checkSpecCoverage(args: unknown): SpecCoverageResult {
  const raw: Record<string, unknown> = isRecord(args) ? args : {};

  const requirements = parseRequirements(raw);
  const claims = parseClaims(raw);

  // Seed the counts in requirements input order so every
  // requirement appears, claimed or not, and the keys keep
  // that order.
  const counts = new Map<string, number>();
  for (const req of requirements) counts.set(req.id, 0);

  const danglingClaims: DanglingClaim[] = [];
  for (const claim of claims) {
    const current = counts.get(claim.requirement_id);
    if (current === undefined) {
      danglingClaims.push({
        requirement_id: claim.requirement_id,
        source_kind: claim.source_kind,
        source_ref: claim.source_ref,
      });
    } else {
      counts.set(claim.requirement_id, current + 1);
    }
  }

  const covered: string[] = [];
  const uncovered: string[] = [];
  for (const req of requirements) {
    if ((counts.get(req.id) ?? 0) >= 1) covered.push(req.id);
    else uncovered.push(req.id);
  }

  const coveragePercent = Math.round(
    (100 * covered.length) / requirements.length,
  );

  let verdict: SpecVerdict;
  if (uncovered.length === 0) verdict = "fully_covered";
  else if (coveragePercent >= 80) verdict = "mostly_covered";
  else if (coveragePercent >= 50) verdict = "partial";
  else verdict = "sparse";

  return {
    covered,
    uncovered,
    dangling_claims: danglingClaims,
    claim_counts: Object.fromEntries(counts),
    coverage_percent: coveragePercent,
    verdict,
    requirement_count: requirements.length,
    claim_count: claims.length,
  };
}

/** Render a payload as the JSON text block MCP clients show. */
export function formatPayload(payload: unknown): string {
  return typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
}
