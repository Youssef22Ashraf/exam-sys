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

export interface IdentityCheckResult {
  conflict: boolean;
  message?: string;
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
        return {
          conflict: true,
          message: `Company ID '${companyId.trim()}' is already registered to candidate '${cand.name}'. The entered name does not match.`,
        };
      }
      if (cEmail !== normEmail) {
        return {
          conflict: true,
          message: `Company ID '${companyId.trim()}' is already registered with email '${cand.email}'. The entered email does not match.`,
        };
      }
    }

    // Check Name collisions
    if (cName === normName) {
      if (cCompanyId !== normCompanyId) {
        return {
          conflict: true,
          message: `Candidate '${name.trim()}' is already registered under Company ID '${cand.companyId}'. Please use your registered Company ID.`,
        };
      }
      if (cEmail !== normEmail) {
        return {
          conflict: true,
          message: `Candidate '${name.trim()}' is already registered with email '${cand.email}'. Please use your registered email address.`,
        };
      }
    }

    // Check Email collisions
    if (cEmail === normEmail) {
      if (cCompanyId !== normCompanyId) {
        return {
          conflict: true,
          message: `Email '${email.trim()}' is already registered under Company ID '${cand.companyId}'. The entered Company ID does not match.`,
        };
      }
      if (cName !== normName) {
        return {
          conflict: true,
          message: `Email '${email.trim()}' is already registered to candidate '${cand.name}'. The entered name does not match.`,
        };
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
      return {
        conflict: true,
        message: `Company ID '${companyId.trim()}' has a previous exam record under candidate '${att.candidateName}'.`,
      };
    }
    if (aCompanyId === normCompanyId && aEmail !== normEmail) {
      return {
        conflict: true,
        message: `Company ID '${companyId.trim()}' has a previous exam record with email '${att.candidateEmail}'.`,
      };
    }
    if (aName === normName && aCompanyId !== normCompanyId) {
      return {
        conflict: true,
        message: `Candidate '${name.trim()}' has a previous exam record under Company ID '${att.companyId}'.`,
      };
    }
    if (aEmail === normEmail && aCompanyId !== normCompanyId) {
      return {
        conflict: true,
        message: `Email '${email.trim()}' has a previous exam record under Company ID '${att.companyId}'.`,
      };
    }
  }

  return { conflict: false };
}
