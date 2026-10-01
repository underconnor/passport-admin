export interface DiscordSettings {
  guildId: string;
  verificationRoleId: string;
  memberRoleId: string | null;
  currentSemester: string | null;
  semesterRoles: { semester: string; roleId: string }[];
  nicknameEnabled: boolean;
  revision: string;
}
export interface DiscordOverview {
  configured: boolean;
  settings: DiscordSettings | null;
  status: { linked: number; roles: { pending: number; failed: number }; nicknames: { pending: number; failed: number } };
}
export type DiscordDraft = Pick<DiscordSettings, "memberRoleId" | "currentSemester" | "semesterRoles" | "nicknameEnabled">;
export const settingsDraft = (settings: DiscordSettings): DiscordDraft => ({ memberRoleId: settings.memberRoleId, currentSemester: settings.currentSemester, semesterRoles: settings.semesterRoles.map(row => ({ ...row })), nicknameEnabled: settings.nicknameEnabled });
export function validateDiscordDraft(draft: DiscordDraft, fixed: Pick<DiscordSettings, "guildId" | "verificationRoleId">): string {
  const snowflake = (value: string) => /^[1-9]\d{16,19}$/.test(value) && BigInt(value) <= 18446744073709551615n;
  if (draft.memberRoleId && !snowflake(draft.memberRoleId)) return "현재 회원 역할 ID를 올바른 숫자로 입력해 주세요.";
  if (draft.currentSemester && !/^\d{2}-[12]$/.test(draft.currentSemester)) return "현재 학기는 26-2처럼 입력해 주세요.";
  if (draft.semesterRoles.length > 40) return "학기 역할은 최대 40개까지 설정할 수 있습니다.";
  const terms = new Set<string>(); const roles = new Set([fixed.guildId, fixed.verificationRoleId]);
  if (draft.memberRoleId) {
    if (roles.has(draft.memberRoleId)) return "학교 인증 역할·현재 회원 역할·학기 역할은 서로 다른 역할이어야 합니다. @everyone 역할은 사용할 수 없습니다.";
    roles.add(draft.memberRoleId);
  }
  for (const row of draft.semesterRoles) {
    if (!/^\d{2}-[12]$/.test(row.semester) || !snowflake(row.roleId)) return "학기와 역할 ID를 모두 올바르게 입력해 주세요.";
    if (terms.has(row.semester)) return "같은 학기를 두 번 설정할 수 없습니다.";
    if (roles.has(row.roleId)) return "역할 ID가 중복되었거나 @everyone 역할입니다. 서로 다른 역할을 선택해 주세요.";
    terms.add(row.semester); roles.add(row.roleId);
  }
  if (draft.currentSemester && !terms.has(draft.currentSemester)) return "현재 학기에 해당하는 학기 역할을 추가해 주세요.";
  return "";
}
