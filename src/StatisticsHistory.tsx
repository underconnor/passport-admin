import { useId, useState } from "react";
import type { PlayCounters, PlayStatistics } from "./statistics";
import { number, playTime, travelDistance } from "./statistics";

export interface StatisticsPeriod { from: string; to: string }
export function PeriodFilter({ value, disabled, onChange }: { value: StatisticsPeriod | null; disabled: boolean; onChange: (value: StatisticsPeriod | null) => void }) {
  const id = useId();
  const [from, setFrom] = useState(value?.from ?? "");
  const [to, setTo] = useState(value?.to ?? "");
  const [error, setError] = useState("");
  return <form className="stats-period" onSubmit={event => { event.preventDefault(); const days = (Date.parse(to) - Date.parse(from)) / 86400000 + 1; if (!from || !to || !Number.isFinite(days) || days < 1 || days > 366) { setError("시작일부터 종료일까지 366일 이내로 선택해 주세요."); return; } setError(""); onChange({ from, to }); }}>
    <div><label htmlFor={`${id}-from`}>시작일</label><input id={`${id}-from`} type="date" value={from} max={to || undefined} onChange={event => setFrom(event.target.value)} /></div>
    <div><label htmlFor={`${id}-to`}>종료일</label><input id={`${id}-to`} type="date" value={to} min={from || undefined} onChange={event => setTo(event.target.value)} /></div>
    <button disabled={disabled || !from || !to} type="submit">기간 조회</button><button disabled={disabled || !value} type="button" onClick={() => { setFrom(""); setTo(""); setError(""); onChange(null); }}>전체 기간</button>
    {error ? <p className="error-text" role="alert">{error}</p> : null}
  </form>;
}
const dateTime = (value: string | null | undefined) => value ? new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" }).format(new Date(value)) : "기록 없음";
export function StatisticsHistory({ data, serverId }: { data: PlayStatistics; serverId: string }) {
  const target = serverId ? data.servers.find(server => server.serverId === serverId) : data;
  const days = new Map<string, PlayCounters>();
  const allowed = new Set(data.servers.filter(server => server.collectionEnabled !== false).map(server => server.serverId));
  for (const row of data.daily ?? []) {
    if (!allowed.has(row.serverId) || (serverId && row.serverId !== serverId)) continue;
    const current = days.get(row.date) ?? { playSeconds: 0, blocksBroken: 0, blocksPlaced: 0, damageTakenMilli: 0, deaths: 0, mobKills: 0, playerKills: 0, distanceCm: 0 };
    for (const key of Object.keys(current) as (keyof PlayCounters)[]) current[key] = (current[key] ?? 0) + (row[key] ?? 0);
    days.set(row.date, current);
  }
  const rows = [...days].sort(([a], [b]) => a.localeCompare(b));
  const chartRows = rows.slice(-31);
  const max = Math.max(1, ...chartRows.map(([, row]) => row.playSeconds));
  const points = chartRows.map(([, row], index) => `${20 + index * 660 / Math.max(1, chartRows.length - 1)},${130 - row.playSeconds / max * 110}`).join(" ");
  return <>
    {data.firstCollectedAt !== undefined || target?.firstCollectedAt !== undefined ? <dl className="stats-collected"><div><dt>최초 수집</dt><dd>{dateTime(target?.firstCollectedAt)}</dd></div><div><dt>최근 수집</dt><dd>{dateTime(target?.lastCollectedAt)}</dd></div></dl> : null}
    {data.period ? <p className="stats-history-note">{data.period.from ? `${data.period.from} ~ ${data.period.to} · ` : ""}일별 기록은 {data.period.availableFrom ? new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeZone: "Asia/Seoul" }).format(new Date(data.period.availableFrom)) : "기능 적용일"}부터 서버가 전송한 날짜를 기준으로 표시합니다. 이전 기록은 전체 기간 합계에서 확인할 수 있습니다.</p> : null}
    {rows.length ? <section className="panel stats-history" aria-label="일별 플레이 기록"><div className="panel-head"><h3>일별 플레이 시간</h3><small>{chartRows.length > 1 ? `최근 ${chartRows.length}개 수집일` : chartRows[0][0]}</small></div><svg className="stats-chart" viewBox="0 0 700 150" role="img" aria-label="일별 플레이 시간 추이. 아래 일별 기록에서 정확한 수치를 확인할 수 있습니다."><path className="chart-baseline" d="M20 130H680" /><polyline points={points} className="chart-line" />{chartRows.map(([date, row], index) => <circle key={date} cx={20 + index * 660 / Math.max(1, chartRows.length - 1)} cy={130 - row.playSeconds / max * 110} r="4" className="chart-point"><title>{date}: {playTime(row.playSeconds)}</title></circle>)}</svg><div className="chart-labels"><span>{chartRows[0][0]}</span><span>{chartRows.at(-1)?.[0]}</span></div><details><summary>일별 기록 보기</summary><div className="stats-daily-table"><table><thead><tr><th scope="col">수집일</th><th scope="col">플레이 시간</th><th scope="col">캔 블록</th><th scope="col">설치한 블록</th><th scope="col">받은 피해 (HP)</th><th scope="col">죽음</th><th scope="col">몹 처치</th><th scope="col">플레이어 처치</th><th scope="col">이동 거리</th></tr></thead><tbody>{rows.map(([date, row]) => <tr key={date}><th scope="row">{date}</th><td>{playTime(row.playSeconds)}</td><td>{number(row.blocksBroken)}</td><td>{number(row.blocksPlaced)}</td><td>{number(row.damageTakenMilli / 1000)}</td><td>{number(row.deaths)}</td><td>{number(row.mobKills)}</td><td>{number(row.playerKills ?? 0)}</td><td>{travelDistance(row.distanceCm)}</td></tr>)}</tbody></table></div></details></section> : data.period?.from ? <p className="stats-history-note">선택한 기간에 수집된 기록이 없습니다.</p> : null}
  </>;
}
