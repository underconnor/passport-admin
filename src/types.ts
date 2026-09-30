export interface ServerDefinition {
  id: string;
  label: string;
  sensitive?: boolean;
}
export interface AdminSession {
  authenticated: boolean;
  displayName: string | null;
  enrolled: boolean;
  enrollmentPending: boolean;
  bootstrapAvailable: boolean;
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
  id: string;
  displayName: string;
  department: string | null;
  membershipStatus: string;
  roleLabel: string;
  verifiedUntil: string;
  universityVerifiedUntil: string | null;
  allowedServerIds: string[];
  accessSuspended: boolean;
  scopeRestricted: boolean;
  scopeLimit: string[];
  discordId: string | null;
  minecraft: { uuid: string; name: string } | null;
}
export interface MembersPage {
  members: Member[];
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
  ({ active: "활성", inactive: "비활성", suspended: "명부 정지" })[status] ??
  "확인 필요";
export const riskLabel = (risk: string) =>
  ({
    empty_roster: "새 명부가 비어 있습니다.",
    mass_revocation: "많은 회원의 권한이 회수될 수 있습니다.",
    source_changed: "명부의 원본 또는 조회 범위가 변경되었습니다.",
  })[risk] ?? "추가 확인이 필요한 변경입니다.";
