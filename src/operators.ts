import type { AdminRole } from "./types";
export interface Operator {
  subjectId: string;
  displayName: string;
  studentId: string | null;
  role: AdminRole;
  enabled: boolean;
  createdAt: string;
}
export interface OperatorInvitation {
  id: string;
  subjectId: string;
  displayName: string;
  role: AdminRole;
  expiresAt: string;
  createdAt: string;
  status: "pending" | "expired" | "accepted" | "revoked";
}
export interface OperatorsPage { operators: Operator[]; invitations: OperatorInvitation[] }
export const roleLabel = (role: AdminRole) => ({ owner: "총괄 운영자", operator: "운영자", viewer: "조회 전용" })[role];
export const roleDescription = (role: AdminRole) => ({ owner: "모든 운영 기능과 운영자 초대·권한 변경·회수", operator: "회원·서버·명부·Discord 관리와 통계 조회", viewer: "회원·서버·통계·운영 기록 조회" })[role];
export const invitationStatus = (invitation: OperatorInvitation, now: number) => invitation.status === "pending" && new Date(invitation.expiresAt).getTime() <= now ? "expired" : invitation.status;
export const invitationLabel = (status: OperatorInvitation["status"]) => ({ pending: "수락 대기", expired: "만료", accepted: "수락 완료", revoked: "취소됨" })[status];
