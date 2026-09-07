import { prisma } from "../config/db";

/**
 * 1-to-1 candidate identity consistency.
 *
 * Name, email and company ID must agree with every record already on file:
 * a company ID belongs to exactly one name and one email, and vice versa.
 * Checked against both candidates and prior attempts so a submit made before
 * a candidate row existed still counts.
 *
 * Shared by registration and submit so the two can never disagree — the same
 * reason `services/cooldown.ts` exists.
 */

export type ConflictField = "companyId" | "name" | "email";

export interface IdentityCheckResult {
  conflict: boolean;
  /** Which entered field disagrees with the records. Safe to disclose. */
  field?: ConflictField;
  /** Names the other party's data. For admin callers and logs ONLY. */
  message?: string;
  /** Safe for an unauthenticated caller: says what to fix, names nobody. */
  publicMessage?: string;
}

/**
 * Registration and check-cooldown are unauthenticated, and their conflict
 * messages used to quote the matching record verbatim — guessing a company ID
 * returned the holder's real name and email. The detailed message is retained
 * for admin use; the public one names only the field the candidate entered.
 */
const PUBLIC_MESSAGE: Record<ConflictField, string> = {
  companyId:
    "This Company ID is already registered with different details. Check the ID you entered, or contact your supervisor.",
  name:
    "This name is already registered with different details. Check the details you entered, or contact your supervisor.",
  email:
    "This email address is already registered with different details. Check the address you entered, or contact your supervisor.",
};

function conflict(field: ConflictField, message: string): IdentityCheckResult {
  return { conflict: true, field, message, publicMessage: PUBLIC_MESSAGE[field] };
}

export async function validateCandidateIdentity(
  name: string,
  email: string,
  companyId: string
): Promise<IdentityCheckResult> {
  const normName = name.trim().toLowerCase();
  const normEmail = email.trim().toLowerCase();
  const normCompanyId = companyId.trim().toLowerCase();

  // Query all candidates to check for 1-to-1 uniqueness and cross-consistency
  const allCandidates = await prisma.candidate.findMany();

  for (const cand of allCandidates) {
    const cName = cand.name.trim().toLowerCase();
    const cEmail = cand.email.trim().toLowerCase();
    const cCompanyId = cand.companyId.trim().toLowerCase();

    // Check Company ID collisions
    if (cCompanyId === normCompanyId) {
      if (cName !== normName) {
        return conflict("companyId", `Company ID '${companyId.trim()}' is already registered to candidate '${cand.name}'. The entered name does not match.`);
      }
      if (cEmail !== normEmail) {
        return conflict("companyId", `Company ID '${companyId.trim()}' is already registered with email '${cand.email}'. The entered email does not match.`);
      }
    }

    // Check Name collisions
    if (cName === normName) {
      if (cCompanyId !== normCompanyId) {
        return conflict("name", `Candidate '${name.trim()}' is already registered under Company ID '${cand.companyId}'. Please use your registered Company ID.`);
      }
      if (cEmail !== normEmail) {
        return conflict("name", `Candidate '${name.trim()}' is already registered with email '${cand.email}'. Please use your registered email address.`);
      }
    }

    // Check Email collisions
    if (cEmail === normEmail) {
      if (cCompanyId !== normCompanyId) {
        return conflict("email", `Email '${email.trim()}' is already registered under Company ID '${cand.companyId}'. The entered Company ID does not match.`);
      }
      if (cName !== normName) {
        return conflict("email", `Email '${email.trim()}' is already registered to candidate '${cand.name}'. The entered name does not match.`);
      }
    }
  }

  // Also check prior exam attempts to catch any attempts submitted before
  const allAttempts = await prisma.examAttempt.findMany({
    select: { candidateName: true, candidateEmail: true, companyId: true },
  });

  for (const att of allAttempts) {
    const aName = att.candidateName.trim().toLowerCase();
    const aEmail = att.candidateEmail.trim().toLowerCase();
    const aCompanyId = att.companyId.trim().toLowerCase();

    if (aCompanyId === normCompanyId && aName !== normName) {
      return conflict("companyId", `Company ID '${companyId.trim()}' has a previous exam record under candidate '${att.candidateName}'.`);
    }
    if (aCompanyId === normCompanyId && aEmail !== normEmail) {
      return conflict("companyId", `Company ID '${companyId.trim()}' has a previous exam record with email '${att.candidateEmail}'.`);
    }
    if (aName === normName && aCompanyId !== normCompanyId) {
      return conflict("name", `Candidate '${name.trim()}' has a previous exam record under Company ID '${att.companyId}'.`);
    }
    if (aEmail === normEmail && aCompanyId !== normCompanyId) {
      return conflict("email", `Email '${email.trim()}' has a previous exam record under Company ID '${att.companyId}'.`);
    }
  }

  return { conflict: false };
}
