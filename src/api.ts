export interface AuthSession {
  authenticated: boolean;
  csrfToken: string;
  authMode: "development" | "university-disabled";
}
export interface Profile {
  id: string;
  displayName: string;
  identityProvider: "development";
  membership: {
    status: "active" | "inactive";
    roleLabel: string;
    verifiedUntil: string | null;
  };
  minecraft: { uuid: string; name: string } | null;
  discordReference: {
    id: string;
    verificationStatus: "self_reported";
    updatedAt: string;
  } | null;
  csrfToken: string;
}
export interface LinkSession {
  id: string;
  minecraftName: string;
  minecraftUuid: string;
  status: "pending" | "linked";
  expiresAt: string;
  webConfirmed: boolean;
  gameConfirmed: boolean;
}
export interface Server {
  id: string;
  label: string;
}

const messages: Record<string, string> = {
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
  ) {
    super(
      messages[code] ??
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
    throw new ApiError(response.status, code);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "요청을 처리하지 못했습니다.";
}

export function validDiscordId(value: string): boolean {
  return (
    /^[1-9][0-9]{0,19}$/.test(value) && BigInt(value) <= 18446744073709551615n
  );
}
