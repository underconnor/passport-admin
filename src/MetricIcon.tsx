import type { MetricName } from "./statistics";

// Small, decorative line drawings for the eight gameplay metrics.
export function MetricIcon({ name }: { name: MetricName }) {
  const drawing = {
    time: <><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3 2" /></>,
    mining: <><path d="m5 19 9-9M8 5l11 11M6 7c4-4 9-3 12 0l-3 3" /></>,
    building: <><path d="m12 3 8 5v9l-8 4-8-4V8l8-5Z M4 8l8 5 8-5M12 13v8" /></>,
    damage: <><path d="M12 20 4.8 13C-1 7 7 1 12 7c5-6 13 0 7.2 6L12 20Z" /><path d="m7 12 3-3 3 6 3-3h3" /></>,
    deaths: <><path d="M8 19v2h8v-2l3-3v-6a7 7 0 0 0-14 0v6l3 3Z M10 19v2m4-2v2" /><circle cx="9" cy="11" r="1" /><circle cx="15" cy="11" r="1" /><path d="m11 16 1-2 1 2" /></>,
    mobs: <><path d="M5 7 3 3l6 3h6l6-3-2 4v11l-7 3-7-3V7Z M8 10v3m8-3v3M9 17h6" /></>,
    players: <><path d="m4 3 6 4 9 12m-2 2 4-4M3 4l4 6 12 9M20 3l-6 4-3 4m10-7-4 6-3 3M5 17l2 2m-4 2 6-6" /></>,
    distance: <><path d="m6 3 2 2-2 2M16 17l2 2-2 2M8 5h7a4 4 0 0 1 0 8H8a3 3 0 0 0 0 6h10" /></>,
  }[name];
  return <svg className="metric-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{drawing}</svg>;
}
