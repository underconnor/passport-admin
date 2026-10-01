export interface AuthSession {
  authenticated: boolean;
  csrfToken: string;
  authMode: "development" | "university-disabled" | "university";
}
const messages: Record<string, string> = {
  statistics_settings_changed: "다른 곳에서 수집 설정이 변경되었습니다. 최신 설정을 확인한 뒤 다시 시도해 주세요.",
  statistics_reset_changed: "초기화 대상의 연결 또는 기록 상태가 변경되었습니다. 영향을 다시 확인해 주세요.",
  statistics_reset_too_large: "초기화 범위가 너무 큽니다. 서버나 회원을 선택해 범위를 좁혀 주세요.",
  target_university_login_required: "대상자의 학교 인증이 만료되었습니다. 먼저 학교 재인증을 요청해 주세요.",
  operator_already_enrolled: "이미 등록된 운영자입니다. 운영자 목록을 확인해 주세요.",
  invitation_pending: "이 계정에 수락 대기 중인 초대가 있습니다. 초대 내역을 확인해 주세요.",
  operator_not_found: "운영자를 찾지 못했습니다. 목록을 새로고침해 주세요.",
  mfa_enrollment_unavailable: "현재 환경에서는 초대 수락을 사용할 수 없습니다. 서버 운영자에게 문의해 주세요.",
  admin_write_required: "조회 전용 권한입니다. 변경 권한이 있는 운영자에게 요청해 주세요.",
  owner_required: "총괄 운영자만 사용할 수 있는 기능입니다.",
  self_admin_change_forbidden: "본인의 운영자 권한은 변경하거나 회수할 수 없습니다. 다른 총괄 운영자에게 요청해 주세요.",
  last_owner: "마지막 총괄 운영자의 권한은 회수할 수 없습니다. 먼저 다른 총괄 운영자를 등록해 주세요.",
  invitation_unavailable: "이미 처리되었거나 사용할 수 없는 초대입니다. 최신 목록을 확인해 주세요.",
  invitation_not_found: "이 계정에 해당하는 초대를 찾을 수 없습니다.",
  invitation_expired: "초대가 만료되었습니다. 총괄 운영자에게 새 초대를 요청해 주세요.",
  administrator_exists: "이미 등록된 운영자입니다. 운영자 목록을 확인해 주세요.",
  invalid_admin_role: "운영자 역할을 확인해 주세요.",
  subject_changed: "다른 곳에서 회원 정보가 변경되었습니다. 창을 닫고 목록을 새로고침한 뒤 다시 확인해 주세요.",
  cannot_delete_self: "현재 로그인한 관리자 계정은 삭제할 수 없습니다. 다른 관리자에게 요청해 주세요.",
  last_administrator: "마지막 관리자 계정은 삭제할 수 없습니다. 먼저 다른 관리자를 등록해 주세요.",
  confirmation_mismatch: "삭제 대상의 이름을 정확히 입력해 주세요.",
  discord_config_mismatch: "운영 환경과 저장된 학교 인증 역할이 다릅니다. 서버 설정을 확인해 주세요.",
  discord_role_conflict: "이전에 다른 용도로 사용한 역할입니다. 새 역할 ID를 사용해 주세요.",
  discord_role_limit: "관리한 역할 수가 한도에 도달했습니다. 운영 담당자에게 확인해 주세요.",
  discord_settings_changed: "다른 운영자가 봇 설정을 변경했습니다. 최신 설정을 확인한 뒤 다시 저장해 주세요.",
  discord_settings_invalid: "역할 ID, 중복 역할과 현재 학기에 해당하는 학기 역할을 확인해 주세요.",
  invalid_discord_settings: "역할 ID와 학기 설정을 확인해 주세요.",
  discord_not_configured: "운영 환경의 Discord 봇 설정이 필요합니다.",
  invalid_discord_role: "사용할 수 없는 Discord 역할입니다. 역할 ID와 중복 설정을 확인해 주세요.",
  server_changed: "다른 곳에서 서버 설정이 변경되었습니다. 창을 닫고 상태를 새로고침한 뒤 다시 수정해 주세요.",
  server_not_found: "서버를 찾지 못했습니다. 목록을 다시 확인해 주세요.",
  invalid_selected_subjects: "선택한 회원을 확인해 주세요.",
  invalid_subject_scope: "선택한 회원을 확인해 주세요.",
  registry_full: "등록 가능한 서버 수를 초과했습니다.",
  mfa_not_enrolled: "인증 앱 등록이 필요합니다. 등록 코드로 설정을 시작해 주세요.",
  university_provider_not_configured:
    "이 환경은 학교 로그인이 아직 연결되지 않았습니다.",
  university_login_required:
    "관리 기능을 사용하려면 학교 계정으로 다시 로그인해 주세요.",
  university_state_invalid:
    "학교 로그인 요청을 확인하지 못했습니다. 다시 시작해 주세요.",
  university_request_expired:
    "학교 로그인 요청이 만료되었습니다. 다시 시작해 주세요.",
  university_request_consumed:
    "이미 사용한 로그인 요청입니다. 다시 시작해 주세요.",
  university_token_consumed:
    "이미 사용한 인증 응답입니다. 학교 로그인을 다시 진행해 주세요.",
  university_verification_failed:
    "학교 인증을 확인하지 못했습니다. 다시 로그인해 주세요.",
  admin_host_required: "관리자 전용 주소에서 접속해 주세요.",
  admin_required: "이 계정에는 운영자 권한이 없습니다.",
  mfa_required:
    "추가 인증이 만료되었습니다. 인증 앱의 코드를 다시 입력해 주세요.",
  mfa_invalid:
    "인증 코드가 올바르지 않거나 이미 사용되었습니다. 새 코드를 입력해 주세요.",
  mfa_locked:
    "인증 실패가 반복되어 15분 동안 잠겼습니다. 이후 다시 시도해 주세요.",
  bootstrap_invalid: "최초 운영자 등록 코드가 올바르지 않습니다.",
  admin_enrollment_closed:
    "최초 운영자 등록이 종료되었습니다. 계정 권한을 확인해 주세요.",
  invalid_server_scope:
    "사용할 수 없는 서버 범위입니다. 목록을 새로고침해 주세요.",
  subject_not_found: "회원을 찾을 수 없습니다. 목록을 새로고침해 주세요.",
  minecraft_not_linked: "이미 Minecraft 연결이 해제된 회원입니다.",
  discord_not_linked: "이미 Discord 연결이 해제된 회원입니다. 목록을 새로고침해 주세요.",
  approval_required:
    "명부 변경에 확인이 필요합니다. 미리보기를 확인한 뒤 승인해 주세요.",
  approval_mismatch:
    "미리보기 이후 명부가 변경되었습니다. 새 미리보기를 확인해 주세요.",
  sync_busy: "다른 동기화가 진행 중입니다. 잠시 후 다시 확인해 주세요.",
  configuration_error:
    "명부 조회 설정이 준비되지 않았습니다. 서버 설정을 확인해 주세요.",
  read_failed: "회원 명부를 읽지 못했습니다. 기존 명부는 유지됩니다.",
  invalid_snapshot: "명부 형식이 올바르지 않아 반영하지 않았습니다.",
  stale_snapshot:
    "명부 확인 결과가 만료되었습니다. 다시 미리보기를 진행해 주세요.",
  outdated_snapshot:
    "더 새로운 명부가 이미 반영되었습니다. 다시 확인해 주세요.",
  apply_failed: "명부를 반영하지 못했습니다. 동기화 상태를 확인해 주세요.",
  session_required: "로그인이 만료되었습니다. 다시 로그인해 주세요.",
  link_consumed:
    "이미 사용되거나 취소된 링크입니다. 게임에서 새 링크를 받아 주세요.",
  subject_already_linked:
    "이 회원 계정에는 다른 Minecraft 계정이 연결되어 있습니다.",
  confirming_session_expired:
    "연결 확인 세션이 만료되었습니다. 로그인하고 새 링크를 받아 주세요.",
  web_confirmation_consumed:
    "이미 웹 확인을 완료했습니다. 연결 상태를 새로고침해 주세요.",
  development_fixtures_missing:
    "개발용 회원 데이터가 준비되지 않았습니다. 운영자에게 알려 주세요.",
  temporarily_unavailable:
    "인증 서버가 일시적으로 응답하지 않습니다. 잠시 후 다시 시도해 주세요.",
  rate_limited: "요청이 많습니다. 잠시 후 다시 시도해 주세요.",

  unauthorized: "로그인이 만료되었습니다. 다시 로그인해 주세요.",
  invalid_csrf: "세션이 변경되었습니다. 페이지를 새로 열어 다시 시도해 주세요.",
  csrf_invalid: "세션이 변경되었습니다. 페이지를 새로 열어 다시 시도해 주세요.",
  link_expired: "연결 링크가 만료되었습니다. 게임에서 새 링크를 받아 주세요.",
  link_not_found:
    "연결 요청을 찾을 수 없습니다. 게임에서 새 링크를 받아 주세요.",
  invalid_token:
    "유효하지 않은 연결 링크입니다. 게임에서 새 링크를 받아 주세요.",
  membership_required:
    "현재 활성 회원으로 확인되지 않아 계정을 연결할 수 없습니다.",
  minecraft_already_linked:
    "이미 연결된 Minecraft 계정입니다. 운영자에게 문의해 주세요.",
  development_auth_disabled:
    "이 환경에서는 개발용 로그인을 사용할 수 없습니다.",
  invalid_discord_id: "올바른 숫자 Discord 사용자 ID를 입력해 주세요.",
  too_many_requests: "요청이 많습니다. 잠시 후 다시 시도해 주세요.",
};

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public details: unknown = null,
  ) {
    super(
      (Object.hasOwn(messages, code) ? messages[code] : undefined) ??
        (status === 401
          ? "먼저 로그인해 주세요."
          : status === 403
            ? "이 작업을 수행할 권한이 없습니다."
            : status === 429
              ? "요청이 많습니다. 잠시 후 다시 시도해 주세요."
              : "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요."),
    );
  }
}

export async function api<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    csrfToken?: string;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  const headers = new Headers({ Accept: "application/json" });
  if (options.body !== undefined)
    headers.set("Content-Type", "application/json");
  if (options.csrfToken) headers.set("X-CSRF-Token", options.csrfToken);
  let response: Response;
  try {
    response = await fetch(`/v1${path}`, {
      method: options.method ?? "GET",
      headers,
      credentials: "same-origin",
      cache: "no-store",
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(15_000)])
        : AbortSignal.timeout(15_000),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw error;
    throw new Error(
      "인증 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
  }
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const code =
      payload && typeof payload === "object" && "code" in payload
        ? String(payload.code)
        : "request_failed";
    throw new ApiError(response.status, code, payload);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "요청을 처리하지 못했습니다.";
}

export function callbackError(code: string): string {
  return (Object.hasOwn(messages, code) ? messages[code] : undefined) ?? "학교 로그인에 실패했습니다. 다시 시도해 주세요.";
}
