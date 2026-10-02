export interface PlayCounters {
  playSeconds: number;
  blocksBroken: number;
  blocksPlaced: number;
  damageTakenMilli: number;
  deaths: number;
  mobKills: number;
  playerKills?: number;
  distanceCm?: number;
}
export interface PlayerPresence { online: boolean; serverId: string | null; serverLabel: string | null; lastSeenAt: string | null }
export interface PlayStatistics {
  available: boolean;
  totals: PlayCounters;
  firstCollectedAt?: string | null;
  lastCollectedAt?: string | null;
  period?: { from: string | null; to: string | null; availableFrom: string | null; timezone: "Asia/Seoul"; basis: "receivedAt" };
  daily?: (PlayCounters & { date: string; serverId: string })[];
  servers: ({ firstCollectedAt?: string | null; lastCollectedAt?: string | null; serverId: string; label: string; onlinePlayerCount?: number; collectionEnabled?: boolean } & PlayCounters)[];
  presence?: PlayerPresence;
  onlinePlayerCount?: number;
  playerCount?: number;
  collection?: { enabled: boolean | null; effective?: boolean | null; consentGranted: boolean | null; excludedServerIds: string[]; historyRetained: true };
}
export type MetricName = "time" | "mining" | "building" | "damage" | "deaths" | "mobs" | "players" | "distance";
export const number = (value: number) => new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 }).format(value);
export function playTime(value: number) {
  if (value > 0 && value < 60) return `${Math.floor(value)}초`;
  const minutes = Math.floor(value / 60);
  return minutes >= 60 ? `${number(Math.floor(minutes / 60))}시간 ${minutes % 60}분` : `${number(minutes)}분`;
}
export function travelDistance(centimeters = 0) {
  const meters = centimeters / 100;
  return meters >= 1000 ? `${number(meters / 1000)} km` : `${number(Math.floor(meters))} m`;
}
export function statisticsMetrics(counters: PlayCounters): { icon: MetricName; label: string; value: string; unit: string }[] {
  return [
    { icon: "time", label: "플레이 시간", value: playTime(counters.playSeconds), unit: "누적 시간" },
    { icon: "mining", label: "캔 블록", value: number(counters.blocksBroken), unit: "블록" },
    { icon: "building", label: "설치한 블록", value: number(counters.blocksPlaced), unit: "블록" },
    { icon: "damage", label: "받은 피해", value: number(counters.damageTakenMilli / 1000), unit: "HP · 하트 1개 = 2 HP" },
    { icon: "deaths", label: "죽은 횟수", value: number(counters.deaths), unit: "회" },
    { icon: "mobs", label: "처치한 몹", value: number(counters.mobKills), unit: "마리" },
    { icon: "players", label: "플레이어 처치", value: number(counters.playerKills ?? 0), unit: "회" },
    { icon: "distance", label: "이동 거리", value: travelDistance(counters.distanceCm), unit: "대략적인 누적 거리" },
  ];
}
