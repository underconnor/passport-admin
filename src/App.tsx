import { useCallback, useEffect, useState } from "react";
import { api, ApiError, callbackError, errorMessage } from "./api";
import type { AuthSession } from "./api";
import { AppShell } from "./ui";
import type { IconName } from "./ui";
import { AccessGate } from "./AccessGate";
import { MembersView } from "./MembersView";
import { RosterView } from "./RosterView";
import { ServersView } from "./ServersView";
import { AuditView } from "./AuditView";
import { dateTime } from "./types";
import type { AdminSession, Overview } from "./types";

type View = "overview" | "members" | "roster" | "servers" | "audit";
const navigation: { id: View; label: string; icon: IconName }[] = [
  { id: "overview", label: "운영 현황", icon: "dashboard" },
  { id: "members", label: "회원 관리", icon: "check" },
  { id: "servers", label: "서버 관리", icon: "book" },
  { id: "roster", label: "명부 동기화", icon: "book" },
  { id: "audit", label: "운영 기록", icon: "settings" },
];
const callbackParams = new URLSearchParams(window.location.search);
const callbackCode = callbackParams.get("auth_error");
if (callbackCode !== null) {
  callbackParams.delete("auth_error");
  const query = callbackParams.toString();
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${query ? `?${query}` : ""}`,
  );
}
const initialCallbackError = callbackCode ? callbackError(callbackCode) : "";

export function App() {
  const [view, setView] = useState<View>("overview");
  const [requiresSchoolLogin, setRequiresSchoolLogin] = useState(false);
  const [auth, setAuth] = useState<AuthSession | null>(null);
  const [admin, setAdmin] = useState<AdminSession | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(initialCallbackError);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  const refreshSession = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const session = await api<AuthSession>("/auth/session", { signal });
      if (signal?.aborted) return;
      setAuth(session);
      const access = await api<AdminSession>("/admin/session", { signal });
      if (signal?.aborted) return;
      setAdmin(access);
      setNow(Date.now());
      if (access.authorized) {
        const data = await api<Overview>("/admin/overview", { signal });
        if (!signal?.aborted) setOverview(data);
      } else {
        setOverview(null);
        setView("overview");
      }
    } catch (failure) {
      if (!signal?.aborted) {
        setOverview(null);
        setAdmin(null);
        setError(errorMessage(failure));
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refreshSession(controller.signal);
    return () => controller.abort();
  }, [refreshSession]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!admin?.mfaRequired || !admin.mfaVerified || !admin.mfaVerifiedUntil) return;
    const expiresAt = new Date(admin.mfaVerifiedUntil).getTime();
    const expire = () => {
      if (Date.now() < expiresAt) return;
      setAdmin((current) =>
        current ? { ...current, authorized: false, mfaVerified: false } : null,
      );
      setOverview(null);
      setView("overview");
      setError(
        "추가 인증이 만료되었습니다. 인증 앱 코드를 다시 입력해 주세요.",
      );
    };
    const timer = window.setTimeout(
      expire,
      Math.max(0, expiresAt - Date.now()) + 50,
    );
    window.addEventListener("focus", expire);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", expire);
    };
  }, [admin?.mfaRequired, admin?.mfaVerified, admin?.mfaVerifiedUntil]);

  const authorizationFailure = useCallback(
    (failure: unknown) => {
      if (!(failure instanceof ApiError)) return;
      if (failure.code === "university_login_required")
        setRequiresSchoolLogin(true);
      if (
        failure.status === 401 ||
        [
          "mfa_required",
          "admin_required",
          "university_login_required",
        ].includes(failure.code)
      ) {
        setOverview(null);
        setAdmin(null);
        setView("overview");
        setError(errorMessage(failure));
        void refreshSession();
      }
    },
    [refreshSession],
  );

  async function refreshOverview() {
    try {
      setOverview(await api<Overview>("/admin/overview"));
    } catch (failure) {
      authorizationFailure(failure);
      throw failure;
    }
  }
  async function logout() {
    if (!auth) return;
    setBusy(true);
    setError("");
    try {
      await api("/auth/logout", { method: "POST", csrfToken: auth.csrfToken });
      setAdmin(null);
      setOverview(null);
      setView("overview");
      await refreshSession();
    } catch (failure) {
      setError(errorMessage(failure));
      authorizationFailure(failure);
    } finally {
      setBusy(false);
    }
  }
  const verified = Boolean(
    !requiresSchoolLogin &&
    admin?.authorized &&
    (!admin.mfaRequired || (admin.mfaVerified && admin.mfaVerifiedUntil &&
      new Date(admin.mfaVerifiedUntil).getTime() > now)),
  );
  const activeNavigation = verified ? navigation : navigation.slice(0, 1);
  const selected = navigation.find((item) => item.id === view)!;
  return (
    <AppShell
      title={verified ? selected.label : "운영자 인증"}
      navItems={activeNavigation}
      activeView={view}
      onNavigate={(id) => {
        setView(id as View);
        setError("");
      }}
      displayName={admin?.displayName ?? "운영자"}
      description={verified ? "등록된 운영자" : "권한 확인 필요"}
      development={auth?.authMode === "development"}
      university={auth?.authMode === "university"}
      onLogout={admin?.authenticated ? () => void logout() : undefined}
      busy={busy || loading}
    >
      <div className="page-head">
        <div>
          <h1>{verified ? selected.label : "운영자 인증"}</h1>
          <p>
            {verified
              ? view === "overview"
                ? "회원과 서버 접근 정책의 현재 상태를 확인합니다."
                : view === "members"
                  ? "명부에서 허용된 범위 안에서 회원의 접근을 관리합니다."
                  : view === "servers"
                    ? "연결된 서버와 서버별 접속 대상을 관리합니다."
                  : view === "roster"
                    ? "새 명부를 확인한 뒤 회원 정책에 반영합니다."
                    : "관리 작업과 회원 정책 변경을 확인합니다."
              : "학교 계정으로 로그인해 등록된 운영자 권한을 확인합니다."}
          </p>
        </div>
        {!(verified && view === "servers") ? <button
          disabled={loading || busy}
          onClick={() => {
            setError("");
            void refreshSession();
          }}
        >
          상태 새로고침
        </button> : null}
      </div>
      {verified && admin?.mfaRequired ? (
        <div className="mfa-session-info">
          추가 인증 유효 시점: {dateTime(admin?.mfaVerifiedUntil ?? null)}
        </div>
      ) : null}
      {error ? (
        <div role="alert" className="notice notice-error">
          {error}
        </div>
      ) : null}
      {loading ? (
        <section className="panel loading-state" aria-busy="true">
          <span className="spinner" />
          <p>접근 상태를 확인하고 있습니다.</p>
        </section>
      ) : !auth || !admin ? (
        <section className="panel empty-state">
          <h2>인증 서버의 상태를 확인해 주세요</h2>
          <p>연결이 복구되면 상태 새로고침을 눌러 주세요.</p>
        </section>
      ) : !verified ? (
        <AccessGate
          key={admin.displayName ?? "guest"}
          auth={auth}
          admin={admin}
          refresh={async () => {
            setError("");
            await refreshSession();
          }}
          onError={authorizationFailure}
          requiresSchoolLogin={requiresSchoolLogin || (admin.authenticated && !admin.schoolVerified)}
        />
      ) : !overview ? (
        <section className="panel empty-state">
          <h2>운영 정보를 불러오지 못했습니다.</h2>
          <p>상태 새로고침으로 다시 시도해 주세요.</p>
        </section>
      ) : view === "members" ? (
        <MembersView
          csrfToken={auth.csrfToken}
          servers={overview.servers}
          onError={authorizationFailure}
        />
      ) : view === "servers" ? (
        <ServersView csrfToken={auth.csrfToken} onError={authorizationFailure} onChanged={refreshOverview} />
      ) : view === "roster" ? (
        <RosterView
          overview={overview}
          csrfToken={auth.csrfToken}
          now={now}
          refresh={refreshOverview}
          onError={authorizationFailure}
        />
      ) : view === "audit" ? (
        <AuditView onError={authorizationFailure} />
      ) : (
        <>
          <div className="overview-counts">
            <section className="panel metric-card">
              <span>학교 인증 회원</span>
              <strong>{overview.subjects}</strong>
              <small>등록된 학교 계정</small>
            </section>
            <section className="panel metric-card">
              <span>Minecraft 연결</span>
              <strong>{overview.linked}</strong>
              <small>회원에 연결된 게임 계정</small>
            </section>
            <section className="panel metric-card">
              <span>관리자 접근 정지</span>
              <strong>{overview.suspended}</strong>
              <small>명부 상태와 별도인 정지</small>
            </section>
          </div>
          <div className="dashboard-grid">
            <section className="panel">
              <div className="panel-head">
                <h2>회원 명부</h2>
                <button
                  className="text-button"
                  onClick={() => setView("roster")}
                >
                  동기화 관리
                </button>
              </div>
              <dl className="detail-list">
                <div>
                  <dt>명부 인원</dt>
                  <dd>
                    {overview.snapshot
                      ? `${overview.snapshot.entryCount}명`
                      : "반영된 명부 없음"}
                  </dd>
                </div>
                <div>
                  <dt>최근 명부 조회</dt>
                  <dd>{dateTime(overview.snapshot?.fetchedAt ?? null)}</dd>
                </div>
                <div>
                  <dt>명부 만료</dt>
                  <dd>{dateTime(overview.snapshot?.expiresAt ?? null)}</dd>
                </div>
                <div>
                  <dt>동기화</dt>
                  <dd>
                    {overview.sync.running
                      ? "진행 중"
                      : overview.sync.enabled
                        ? "자동 동기화 켜짐"
                        : "자동 동기화 꺼짐"}
                  </dd>
                </div>
              </dl>
              {overview.sync.lastError ? (
                <p className="error-text">
                  {errorMessage(new ApiError(503, overview.sync.lastError))}
                </p>
              ) : null}
            </section>
            <section className="panel">
              <div className="panel-head">
                <h2>등록된 서버</h2>
                <button className="text-button" onClick={() => setView("servers")}>서버 관리</button>
              </div>
              <ul className="server-list">
                {overview.servers.map((server) => (
                  <li key={server.id}>
                    <div>
                      <h3>{server.label}</h3>
                      <small>{server.id}</small>
                    </div>
                    <span className="status-label">
                      {server.enabled === false ? "접속 비활성" : server.sensitive
                        ? "접근 시 최신 정책 확인"
                        : "회원 정책 적용"}
                    </span>
                  </li>
                ))}
              </ul>
              {!overview.servers.length ? (
                <p className="helper">등록된 서버가 없습니다.</p>
              ) : null}
            </section>
          </div>
        </>
      )}
    </AppShell>
  );
}
