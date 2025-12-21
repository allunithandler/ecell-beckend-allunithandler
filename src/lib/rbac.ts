export type AppRole = "MENTOR" | "COMMITTEE" | "MEMBER";
export type Role = AppRole;

interface UserProfile {
  role: AppRole;
  id: string;
}

interface UserPosition {
  position_id: string;
  level: number;
  end_date: string | null;
}

// Position levels (authority hierarchy)
const POSITION_LEVELS = {
  PRESIDENT: 5,
  SECRETARY: 4,
  VICE_PRESIDENT: 3,
  DOMAIN_HEAD: 2,
  GENIE: 1,
  MEMBER: 0,
} as const;

// Get user's highest active position level (defensive)
export function getPositionLevel(positions: UserPosition[]): number {
  const activePositions = positions.filter(p => p.end_date === null);
  const levels = activePositions.map(p => p.level).filter(level => typeof level === 'number');
  return levels.length > 0 ? Math.max(...levels) : 0;
}

function roleRank(role: string | null | undefined): number {
  if (role === "MENTOR") return 5;
  if (role === "COMMITTEE") return 3;
  return 0;
}

export function hasRankAtLeast(role: string | null | undefined, minRank: number): boolean {
  return roleRank(role) >= minRank;
}

export function hasAtLeast(role: string | null | undefined, requiredRole: Role): boolean {
  return roleRank(role) >= roleRank(requiredRole);
}

export function isPresident(title: string | null | undefined): boolean {
  return (title ?? "").toLowerCase().includes("president");
}

// Check if user is committee (ONLY from role)
export function isCommittee(profile: UserProfile): boolean {
  return profile.role === "COMMITTEE" || profile.role === "MENTOR";
}

// Check if user has minimum position level
export function hasMinLevel(positions: UserPosition[], minLevel: number): boolean {
  return getPositionLevel(positions) >= minLevel;
}

// Permission functions
export const permissions = {
  // Committee and above can manage events
  manageEvents: (profile: UserProfile) => 
    profile.role === "MENTOR" || profile.role === "COMMITTEE",
  
  // Committee and above can create/assign tasks
  createTasks: (profile: UserProfile) => 
    isCommittee(profile),
  
  assignTasks: (profile: UserProfile) => 
    isCommittee(profile),
  
  // Committee and above can mark attendance
  markAttendance: (profile: UserProfile) => 
    isCommittee(profile),
  
  // Genie level and above can view organization
  viewOrganization: (profile: UserProfile, positions: UserPosition[]) => 
    hasMinLevel(positions, POSITION_LEVELS.GENIE) || isCommittee(profile),
  
  // President level can manage positions
  managePositions: (profile: UserProfile, positions: UserPosition[]) => 
    hasMinLevel(positions, POSITION_LEVELS.PRESIDENT),
};

// Check if user can assign tasks to another user
export function canAssignTo(assignerProfile: { role: string | null | undefined }, assigneeProfile: { role: string | null | undefined }): boolean {
  return roleRank(assignerProfile.role) > roleRank(assigneeProfile.role);
}
