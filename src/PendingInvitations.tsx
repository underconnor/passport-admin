import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "./api";
import { dateTime } from "./types";
import type { ReportError } from "./types";
import { invitationLabel, invitationStatus, roleDescription, roleLabel } from "./operators";
import type { OperatorInvitation } from "./operators";

export function PendingInvitations({ csrfToken, refresh, onError }: { csrfToken: string; refresh: () => Promise<void>; onError: ReportError }) {
  const [invitations, setInvitations] = useState<OperatorInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try { const result = await api<{ invitations: OperatorInvitation[] }>("/admin/operator-invitations/pending", { signal }); if (!signal?.aborted) { setInvitations(result.invitations); setNow(Date.now()); } }
    catch (failure) { if (!signal?.aborted) { setError(errorMessage(failure)); onError(failure); } }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [onError]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => { controller.abort(); window.clearInterval(timer); }; }, [load]);
  async function accept(invitation: OperatorInvitation) {
    if (busy || invitationStatus(invitation, Date.now()) !== "pending") { setNow(Date.now()); return; }
    setBusy(invitation.id); setError("");
    try { await api(`/admin/operator-invitations/${encodeURIComponent(invitation.id)}/accept`, { method: "POST", body: {}, csrfToken }); await refresh(); }
    catch (failure) { setError(errorMessage(failure)); onError(failure); await load(); }
    finally { setBusy(null); }
  }
  return <div className="pending-invitations">
    <div className="panel-head"><h3>받은 운영자 초대</h3><button disabled={loading || Boolean(busy)} onClick={() => { setError(""); void load(); }}>초대 새로고침</button></div>
    {error ? <p className="notice notice-error" role="alert">{error}</p> : null}
    {loading ? <p className="helper" role="status">이 계정에 발급된 초대를 확인하고 있습니다.</p> : !invitations.length ? <div className="empty-state gate-empty"><h3>수락할 초대가 없습니다.</h3><p>총괄 운영자에게 이 학교 계정으로 초대를 요청해 주세요.</p></div> : invitations.map(invitation => {
      const status = invitationStatus(invitation, now);
      return <div className="pending-invitation" key={invitation.id}><h3>{roleLabel(invitation.role)} 초대</h3><p>{roleDescription(invitation.role)}</p><p className="helper">{invitation.displayName} · 만료 {dateTime(invitation.expiresAt)}</p><button className="primary" disabled={loading || Boolean(busy) || status !== "pending"} onClick={() => void accept(invitation)}>{busy === invitation.id ? "수락 중…" : status === "pending" ? "초대 수락하고 시작하기" : invitationLabel(status)}</button></div>;
    })}
  </div>;
}
