import { useCallback, useEffect, useState } from "react";
import { api, ApiError, errorMessage } from "./api";
import type { AuthSession } from "./api";
import { AppShell } from "./ui";

type AccessState = "loading" | "locked" | "unavailable";

export function App() {
  const [state, setState] = useState<AccessState>("loading");
  const [session, setSession] = useState<AuthSession | null>(null);
  const [error, setError] = useState("");
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const check = useCallback(async (signal?: AbortSignal) => {
    setState("loading");
    setError("");
    try {
      const current = await api<AuthSession>("/auth/session", { signal });
      if (signal?.aborted) return;
      setSession(current);
      try {
        await api<unknown>("/admin/overview", { signal });
        // A future successful response needs a reviewed dashboard contract.
        // Until that exists, do not display fabricated member counts or controls.
        if (!signal?.aborted) {
          setState("locked");
          setError(
            "관리자 데이터 형식이 아직 연결되지 않았습니다. 운영 기능을 활성화할 수 없습니다.",
          );
        }
      } catch (failure) {
        if (signal?.aborted) return;
        if (
          failure instanceof ApiError &&
          (failure.status === 401 || failure.status === 403)
        )
          setState("locked");
        else throw failure;
      }
      setCheckedAt(new Date());
    } catch (failure) {
      if (!signal?.aborted) {
        setState("unavailable");
        setError(errorMessage(failure));
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void check(controller.signal);
    return () => controller.abort();
  }, [check]);

  return (
    <AppShell
      title="운영 현황"
      navItems={[{ id: "overview", label: "운영 현황", icon: "dashboard" }]}
      activeView="overview"
      onNavigate={() => {}}
      displayName="운영자"
      description="권한 확인 필요"
      development={session?.authMode === "development"}
    >
      <div className="page-head">
        <div>
          <h1>운영 현황</h1>
          <p>운영자 권한을 확인한 후 회원과 서버 정책을 관리합니다.</p>
        </div>
      </div>
      <div className="dashboard-grid admin-grid">
        <section
          className="panel access-panel"
          aria-labelledby="access-heading"
          aria-busy={state === "loading"}
        >
          <div className="panel-head">
            <h2 id="access-heading">운영자 접근 확인</h2>
            <span className="status-label">
              {state === "loading" ? "확인 중" : "접근 제한"}
            </span>
          </div>
          <div className="access-content">
            {state === "loading" ? <span className="spinner" /> : null}
            <h3>
              {state === "loading"
                ? "관리 권한을 확인하고 있어요"
                : state === "unavailable"
                  ? "인증 서버에 연결할 수 없어요"
                  : "운영자 인증이 필요합니다"}
            </h3>
            <p>
              {state === "loading"
                ? "세션과 운영자 권한을 확인하고 있습니다."
                : state === "unavailable"
                  ? "잠시 후 접근 상태를 다시 확인해 주세요."
                  : "운영자 권한과 추가 인증을 확인한 계정만 회원 정보와 서버 정책을 조회할 수 있습니다."}
            </p>
            {error ? (
              <p role="alert" className="error-text">
                {error}
              </p>
            ) : null}
            <button
              className="primary"
              disabled={state === "loading"}
              onClick={() => void check()}
            >
              {state === "loading" ? "확인 중…" : "접근 상태 다시 확인"}
            </button>
            <small className="last-checked" role="status">
              {checkedAt
                ? `마지막 확인 ${checkedAt.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`
                : "아직 확인된 운영 데이터가 없습니다."}
            </small>
          </div>
          <div className="card-footnote helper">
            운영자 등록과 MFA 연동을 준비하고 있습니다.
          </div>
        </section>
        <section className="panel">
          <div className="panel-head">
            <h2>운영 기능</h2>
            <small>준비 현황</small>
          </div>
          <ul className="operations-list">
            <li>
              <h3>회원과 계정</h3>
              <p>명부 일치 여부와 Minecraft 연결 상태</p>
              <small>권한 확인 후 제공 예정</small>
            </li>
            <li>
              <h3>서버 접근 정책</h3>
              <p>서버별 허용 범위와 권한 회수</p>
              <small>구현 예정</small>
            </li>
            <li>
              <h3>운영 기록</h3>
              <p>명부 동기화 결과와 관리자 변경 이력</p>
              <small>구현 예정</small>
            </li>
          </ul>
        </section>
      </div>
      <p className="page-footnote">
        현재는 접근 상태만 확인할 수 있습니다. 실제 회원 정보나 서버 권한을
        변경하는 기능은 아직 제공하지 않습니다.
      </p>
    </AppShell>
  );
}
