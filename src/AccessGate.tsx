import { useState } from "react";
import type { FormEvent } from "react";
import { api, errorMessage } from "./api";
import type { AuthSession } from "./api";
import type { AdminSession } from "./types";
import { Icon } from "./ui";

export function AccessGate({
  auth,
  admin,
  refresh,
  onError,
  requiresSchoolLogin = false,
}: {
  auth: AuthSession;
  admin: AdminSession;
  refresh: () => Promise<void>;
  onError: (error: unknown) => void;
  requiresSchoolLogin?: boolean;
}) {
  const [bootstrapToken, setBootstrapToken] = useState("");
  const [enrollment, setEnrollment] = useState<{
    secret: string;
  } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [reEnroll, setReEnroll] = useState(false);
  async function run(name: string, action: () => Promise<void>) {
    setBusy(name);
    setError("");
    try {
      await action();
    } catch (failure) {
      setError(errorMessage(failure));
      onError(failure);
    } finally {
      setBusy("");
    }
  }
  function enroll(event: FormEvent) {
    event.preventDefault();
    void run("enrollment", async () => {
      const result = await api<{ mfaRequired: boolean; secret?: string; otpauthUrl?: string }>(
        "/admin/enrollment",
        { method: "POST", body: { bootstrapToken }, csrfToken: auth.csrfToken },
      );
      if (result.mfaRequired) {
        if (!result.secret) throw new Error("인증 앱 등록 정보를 확인하지 못했습니다.");
        setEnrollment({ secret: result.secret });
      } else {
        setEnrollment(null);
        await refresh();
      }
      setBootstrapToken("");
      setReEnroll(false);
    });
  }
  function verify(event: FormEvent) {
    event.preventDefault();
    void run("mfa", async () => {
      try {
        await api("/admin/mfa", {
          method: "POST",
          body: { code },
          csrfToken: auth.csrfToken,
        });
      } finally {
        setCode("");
      }
      setEnrollment(null);
      setBootstrapToken("");
      await refresh();
    });
  }
  const pending = admin.enrollmentPending || enrollment !== null;
  const showEnrollmentForm =
    admin.authenticated &&
    (!admin.enrolled || admin.enrollmentPending) &&
    (!pending || reEnroll || !admin.mfaRequired || (admin.enrolled && admin.enrollmentPending)) &&
    (admin.bootstrapAvailable || admin.enrollmentPending);
  return (
    <section className="panel gate-panel">
      <div className="panel-head">
        <h2>운영자 인증</h2>
        <span className="status-label">
          {!admin.authenticated || requiresSchoolLogin
            ? "학교 로그인 필요"
            : admin.enrolled
              ? admin.mfaRequired ? "추가 인증 필요" : "권한 확인 중"
              : "등록 확인"}
        </span>
      </div>
      {!admin.authenticated || requiresSchoolLogin ? (
        <div className="access-content">
          <h3>학교 계정으로 로그인해 주세요</h3>
          <p>학교 로그인 후 등록된 운영자 권한을 확인합니다.</p>
          <button
            className="primary"
            disabled={Boolean(busy) || auth.authMode !== "university"}
            onClick={() =>
              void run("login", async () => {
                const result = await api<{ url: string }>(
                  "/auth/university/start",
                  { method: "POST", body: {}, csrfToken: auth.csrfToken },
                );
                const target = new URL(result.url);
                if (
                  target.origin !== "https://smartid.ssu.ac.kr" ||
                  target.pathname !== "/Symtra_sso/smln.asp" ||
                  target.username ||
                  target.password ||
                  target.hash
                )
                  throw new Error("학교 로그인 주소를 확인하지 못했습니다.");
                window.location.assign(target.href);
              })
            }
          >
            {busy === "login" ? "로그인 연결 중…" : "숭실대학교 통합로그인"}
            <Icon name="arrow" />
          </button>
          {auth.authMode !== "university" ? (
            <small>이 환경에서는 학교 로그인을 아직 사용할 수 없습니다.</small>
          ) : null}
        </div>
      ) : (
        <>
          <p className="helper gate-intro">
            {admin.displayName}님,{" "}
            {admin.enrolled && admin.mfaRequired && !admin.enrollmentPending
              ? "인증 앱의 6자리 코드를 입력해 주세요. 확인 후 15분 동안 관리 기능을 사용할 수 있습니다."
              : "최초 운영자 등록에는 서버 운영자가 전달한 등록 코드가 필요합니다."}
          </p>
          {showEnrollmentForm ? (
            <form onSubmit={enroll}>
              <label htmlFor="bootstrap-token">최초 운영자 등록 코드</label>
              <input
                id="bootstrap-token"
                type="password"
                autoComplete="off"
                value={bootstrapToken}
                onChange={(event) => setBootstrapToken(event.target.value)}
                required
                minLength={43}
                disabled={Boolean(busy)}
              />
              <p className="helper field-help">
                등록 코드는 이 요청에만 사용합니다.{" "}
                {reEnroll
                  ? "새 키를 발급하면 이전에 등록 중이던 인증 앱 키는 사용할 수 없습니다."
                  : "학교 비밀번호를 입력하지 마세요."}
              </p>
              <div className="form-actions">
                <button
                  className="primary"
                  disabled={Boolean(busy) || !bootstrapToken}
                >
                  {busy === "enrollment"
                    ? "등록 준비 중…"
                    : reEnroll
                      ? "새 등록 키 발급"
                      : admin.mfaRequired ? "인증 앱 등록 시작" : "운영자로 등록"}
                </button>
                {reEnroll ? (
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => setReEnroll(false)}
                  >
                    취소
                  </button>
                ) : null}
              </div>
            </form>
          ) : null}
          {admin.mfaRequired && enrollment ? (
            <div className="enrollment-key">
              <h3>인증 앱에 수동으로 등록해 주세요</h3>
              <p className="helper">
                계정 이름은 Passport, 유형은 시간 기반(TOTP)입니다. 이 키가
                노출되면 다른 사람이 인증 코드를 만들 수 있습니다.
              </p>
              <label htmlFor="totp-secret">인증 앱 등록 키</label>
              <input
                id="totp-secret"
                className="secret-field"
                value={enrollment.secret}
                readOnly
                autoComplete="off"
                spellCheck={false}
              />
              <p className="helper field-help">
                키는 현재 화면의 메모리에만 표시됩니다. 등록 후 아래에서 코드를
                확인해 주세요.
              </p>
            </div>
          ) : null}
          {admin.mfaRequired && (enrollment || (admin.enrolled && !admin.enrollmentPending) || (pending && !admin.enrolled)) && !reEnroll ? (
            <form onSubmit={verify}>
              <label htmlFor="totp-code">인증 앱 코드</label>
              <input
                id="totp-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, ""))
                }
                placeholder="6자리 숫자"
                required
                disabled={Boolean(busy)}
              />
              <div className="form-actions">
                <button
                  className="primary"
                  disabled={Boolean(busy) || code.length !== 6}
                >
                  {busy === "mfa" ? "확인 중…" : "인증 코드 확인"}
                </button>
                {!admin.enrolled && !enrollment ? (
                  <button
                    className="text-button"
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => setReEnroll(true)}
                  >
                    등록 키 다시 발급
                  </button>
                ) : null}
              </div>
            </form>
          ) : null}
          {!admin.enrolled && !pending && !admin.bootstrapAvailable ? (
            <div className="empty-state gate-empty">
              <h3>이 계정에는 운영자 권한이 없습니다.</h3>
              <p>
                기존 운영자에게 계정 권한을 확인해 주세요. 일반 회원
                로그인만으로 관리 권한이 부여되지 않습니다.
              </p>
            </div>
          ) : null}
        </>
      )}
      {error ? (
        <div role="alert" className="notice notice-error gate-error">
          {error}
        </div>
      ) : null}
    </section>
  );
}
