export interface ServerDefinition {
  id: string;
  label: string;
  commandName: string;
  sensitive?: boolean;
  enabled?: boolean;
}
export interface ManagedServer extends ServerDefinition {
  statisticsEnabled?: boolean;
  enabled: boolean;
  accessMode: "members" | "staff" | "selected" | "university";
  discordRequirement: "any" | "linked" | "unlinked";
  allowedSubjectIds: string[];
  paperSeenAt: string | null;
  proxySeenAt: string | null;
  online: boolean;
  proxyAvailable: boolean;
  createdAt: string;
  updatedAt: string;
}
export type AdminRole = "owner" | "operator" | "viewer";
export interface AdminSession {
  subjectId: string | null;
  role: AdminRole | null;
  permissions: { read: boolean; write: boolean; manageOperators: boolean };
  authenticated: boolean;
  schoolVerified: boolean;
  displayName: string | null;
  enrolled: boolean;
  enrollmentPending: boolean;
  bootstrapAvailable: boolean;
  mfaRequired: boolean;
  authorized: boolean;
  mfaVerified: boolean;
  mfaVerifiedUntil: string | null;
}
export interface Overview {
  subjects: number;
  linked: number;
  suspended: number;
  snapshot: { entryCount: number; fetchedAt: string; expiresAt: string } | null;
  sync: {
    enabled: boolean;
    running: boolean;
    lastSuccessAt: string | null;
    lastError: string | null;
  };
  servers: ServerDefinition[];
}
export interface Member {
  identityProvider?: string;
  developmentAccount?: { enabled: boolean; discordLinked: boolean } | null;
  id: string;
  revision: string;
  createdAt: string;
  administrator: boolean;
  admissionYear: string | null;
  studentId?: string | null;
  presence: { online: boolean; serverId: string | null; serverLabel: string | null; lastSeenAt: string | null };
  displayName: string;
  department: string | null;
  membershipStatus: string;
  roleLabel: string;
  verifiedUntil: string;
  universityVerifiedUntil: string | null;
  allowedServerIds: string[];
  eligibleServerIds: string[];
  accessSuspended: boolean;
  scopeRestricted: boolean;
  scopeLimit: string[];
  discordId: string | null;
  discordConnection: {
    discordId: string;
    username: string;
    displayName: string;
    linkedAt: string;
    roleStatus: "pending" | "granted" | "revoked" | "failed";
    roleUpdatedAt: string | null;
  } | null;
  minecraft: { uuid: string; name: string } | null;
}
export interface MembersPage {
  members: Member[];
  total: number;
  nextCursor: string | null;
}
export interface AccessInput {
  suspended: boolean;
  restricted: boolean;
  serverIds: string[];
}
export interface AuditEvent {
  id: string;
  action: string;
  subjectId: string | null;
  actorSubjectId: string | null;
  objectId: string | null;
  details: unknown;
  createdAt: string;
}
export interface RosterPreview {
  digest: string;
  total: number;
  active: number;
  previousTotal: number;
  risks: string[];
  fetchedAt: string;
  expiresAt: string;
  databaseChanged: boolean;
}
export interface SyncResult extends RosterPreview {
  updatedSubjects: number;
  changedPolicies: number;
}
export type ReportError = (error: unknown) => void;
export const dateTime = (value: string | null) => {
  if (!value) return "기록 없음";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "확인할 수 없음"
    : new Intl.DateTimeFormat("ko-KR", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
};
export const membershipLabel = (status: string) =>
  ({ active: "소모임 회원", inactive: "비회원", suspended: "명부 정지" })[status] ??
  "확인 필요";
export const riskLabel = (risk: string) =>
  ({
    empty_roster: "새 명부가 비어 있습니다.",
    mass_revocation: "많은 회원의 권한이 회수될 수 있습니다.",
    source_changed: "명부의 원본 또는 조회 범위가 변경되었습니다.",
  })[risk] ?? "추가 확인이 필요한 변경입니다.";
