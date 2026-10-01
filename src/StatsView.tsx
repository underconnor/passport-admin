import { useEffect, useEffectEvent, useState } from "react";
import { api, errorMessage } from "./api";

export interface PlayCounters {
  playSeconds: number;
  blocksBroken: number;
  blocksPlaced: number;
  damageTakenMilli: number;
  deaths: number;
  mobKills: number;
}
export interface PlayerPresence { online: boolean; serverId: string | null; serverLabel: string | null; lastSeenAt: string | null; }
export interface PlayStatistics {
  available: boolean;
  totals: PlayCounters;
  servers: ({ serverId: string; label: string; onlinePlayerCount?: number } & PlayCounters)[];
  presence?: PlayerPresence;
  onlinePlayerCount?: number;
  playerCount?: number;
}
const number = (value: number) => new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 }).format(value);
function playTime(value: number) {
  const minutes = Math.floor(value / 60);
  return minutes >= 60 ? `${number(Math.floor(minutes / 60))}시간 ${minutes % 60}분` : `${number(minutes)}분`;
}
export function StatsView({ endpoint, title = "누적 플레이 기록", onError }: { endpoint: string; title?: string; onError?: (error: unknown) => void }) {
  const [data, setData] = useState<PlayStatistics | null>(null);
  const [serverId, setServerId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const failed = useEffectEvent((failure: unknown) => { setError(errorMessage(failure)); onError?.(failure); });
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setData(null); setError("");
    void api<PlayStatistics>(endpoint, { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) { setData(result); setServerId(current => result.servers.some(server => server.serverId === current) ? current : ""); }
    }).catch(failure => { if (!controller.signal.aborted) failed(failure); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [endpoint, refresh]);
  const counters = data && (serverId ? data.servers.find(server => server.serverId === serverId) ?? data.totals : data.totals);
  const metrics = counters ? [
    { label: "플레이 시간", value: playTime(counters.playSeconds), unit: "함께한 시간" },
    { label: "캔 블록", value: number(counters.blocksBroken), unit: "블록" },
    { label: "설치한 블록", value: number(counters.blocksPlaced), unit: "블록" },
    { label: "받은 피해", value: number(counters.damageTakenMilli / 1000), unit: "피해량" },
    { label: "죽은 횟수", value: number(counters.deaths), unit: "회" },
    { label: "처치한 몹", value: number(counters.mobKills), unit: "마리" },
  ] : [];
  return <section className="stats-view" aria-label={title} aria-busy={loading}>
    <div className="stats-toolbar"><div><h2>{title}</h2>{data?.available && data.playerCount !== undefined ? <p>플레이어 {number(data.playerCount)}명이 함께 만든 기록</p> : <p>서버가 마지막으로 전송한 누적 기록입니다.</p>}</div><button onClick={() => setRefresh(current => current + 1)} disabled={loading}>기록 새로고침</button></div>
    {error ? <div className="notice notice-error" role="alert">{error}</div>
      : loading ? <div className="panel empty-state" role="status"><h3>플레이 기록을 불러오고 있어요</h3></div>
      : !data?.available ? <div className="panel empty-state"><h3>플레이 기록 집계를 준비하고 있어요</h3><p>서버의 통계 연결이 완료되면 여기에 표시됩니다.</p></div>
      : <><div className="stats-scope"><label htmlFor={`stats-server-${endpoint.replace(/[^a-z0-9]/g, "-")}`}>서버 선택</label><select id={`stats-server-${endpoint.replace(/[^a-z0-9]/g, "-")}`} value={serverId} onChange={event => setServerId(event.target.value)}><option value="">전체 서버</option>{data.servers.map(server => <option key={server.serverId} value={server.serverId}>{server.label}</option>)}</select></div>
        {data.presence ? <div className={`stats-presence ${data.presence.online ? "is-online" : ""}`} role="status"><span className="presence-dot" /><strong>{data.presence.online ? "접속 중" : "오프라인"}</strong>{data.presence.online && data.presence.serverLabel ? <span>{data.presence.serverLabel}</span> : data.presence.lastSeenAt ? <span>마지막 확인 {new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short" }).format(new Date(data.presence.lastSeenAt))}</span> : <span>아직 확인된 접속 기록이 없습니다.</span>}</div> : null}
        {data.onlinePlayerCount !== undefined ? <div className="stats-presence is-online" role="status"><span className="presence-dot" /><strong>현재 접속 {number(serverId ? data.servers.find(server => server.serverId === serverId)?.onlinePlayerCount ?? 0 : data.onlinePlayerCount)}명</strong><span>{serverId ? data.servers.find(server => server.serverId === serverId)?.label : "전체 서버"}</span></div> : null}
        <div className="stats-grid">{metrics.map(metric => <article className="panel stats-metric" key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.unit}</small></article>)}</div>
        {!data.servers.length ? <p className="helper stats-empty">아직 집계된 서버 기록이 없습니다. 연결한 계정으로 플레이하면 기록이 쌓입니다.</p> : null}
      </>}
  </section>;
}
