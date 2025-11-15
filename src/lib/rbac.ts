export type Role = "MENTOR" | "DEPT_HEAD" | "COMMITTEE" | "MEMBER";

const roleRank: Record<Role, number> = {
  MENTOR: 3,
  DEPT_HEAD: 2,
  COMMITTEE: 1,
  MEMBER: 0,
};

export function hasAtLeast(userRole?: string | null, required?: Role): boolean {
  if (!userRole || !required) return false;
  const role = userRole as Role;
  return (roleRank[role] ?? 0) >= roleRank[required];
}

type SimpleProfile = { role?: string | null; title?: string | null; department?: string | null };
const normalize = (s?: string | null) => (s || "").toLowerCase();

export function isPresident(title?: string | null): boolean {
  const t = normalize(title);
  return t.includes("president") && !t.includes("vice");
}

export function isVicePresident(title?: string | null): boolean {
  return normalize(title).includes("vice president");
}

export function isSecretary(title?: string | null): boolean {
  const t = normalize(title);
  return t.includes("secretary") && !t.includes("joint");
}

export function isJointSecretary(title?: string | null): boolean {
  return normalize(title).includes("joint secretary");
}

export function isDeptHead(title?: string | null): boolean {
  const t = normalize(title);
  return t.includes("head") || t.includes("lead");
}

export function sameDepartment(a?: SimpleProfile, b?: SimpleProfile): boolean {
  const ad = normalize(a?.department);
  const bd = normalize(b?.department);
  return !!ad && !!bd && ad === bd;
}

export function canAssignTo(assigner: SimpleProfile, assignee: SimpleProfile): boolean {
  if (hasAtLeast(assigner.role, "MENTOR")) return true;
  if (isPresident(assigner.title)) return true;
  if (hasAtLeast(assigner.role, "COMMITTEE")) return sameDepartment(assigner, assignee);
  return false;
}

export const permissions = {
  manageEvents: (role?: string | null) => hasAtLeast(role, "MENTOR"),
  createTasks: (role?: string | null) => hasAtLeast(role, "COMMITTEE"),
  assignTasks: (role?: string | null) => hasAtLeast(role, "COMMITTEE"),
  markAttendance: (role?: string | null) => hasAtLeast(role, "COMMITTEE"),
};