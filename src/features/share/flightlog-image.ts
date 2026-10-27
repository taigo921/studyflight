// FlightLog の共有画像。端末内の Canvas で描き、PNG にする（外部に送信しない）。
// 図柄はすべてコードで描くオリジナル。地図画像は使わない（タイルの再配布にあたるため）。
import type { LngLat } from "@/domain/geo";
import type { Messages } from "@/i18n/ja";

export type ShareFormat = "story" | "feed" | "wide";

export const SHARE_SIZES: Record<ShareFormat, { w: number; h: number }> = {
  story: { w: 1080, h: 1920 },
  feed: { w: 1080, h: 1350 },
  wide: { w: 1200, h: 675 },
};

export interface SharePrivacy {
  route: boolean;
  subject: boolean;
  date: boolean;
  name: boolean;
}

export const DEFAULT_PRIVACY: SharePrivacy = { route: true, subject: true, date: true, name: false };

export interface FlightLogData {
  originCode: string;
  destinationCode: string;
  originName?: string;
  destinationName?: string;
  origin: LngLat | null;
  destination: LngLat | null;
  focusSeconds: number;
  distanceKm: number;
  points: number;
  subjectName: string;
  subjectColor: string;
  dateLabel: string;
  displayName?: string;
  /** 区間の途中で止まった回 */
  midAir: boolean;
  /** 区間全体の進捗（0..1） */
  legProgress: number;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 各サイズの配置。航路の絵（art）と文字の領域（text）。 */
export function shareLayout(format: ShareFormat): { w: number; h: number; pad: number; art: Box; text: Box; scale: number } {
  const { w, h } = SHARE_SIZES[format];
  if (format === "wide") {
    const pad = 56;
    return { w, h, pad, scale: 0.8, art: { x: pad, y: pad + 40, w: w * 0.5 - pad, h: h - pad * 2 - 80 }, text: { x: w * 0.55, y: pad, w: w * 0.45 - pad, h: h - pad * 2 } };
  }
  const pad = 80;
  const artH = format === "story" ? h * 0.4 : h * 0.34;
  const top = format === "story" ? 330 : 170;
  return { w, h, pad, scale: 1, art: { x: pad, y: top, w: w - pad * 2, h: artH }, text: { x: pad, y: top + artH + 40, w: w - pad * 2, h: h - (top + artH + 40) - pad } };
}

/** 2点を枠に収める（経度差の小さい方向で回り込みを扱う）。 */
export function projectRoute(o: LngLat, d: LngLat, box: Box): { a: [number, number]; b: [number, number] } {
  let dl = d[0] - o[0];
  if (dl > 180) dl -= 360;
  if (dl < -180) dl += 360;
  const pts: LngLat[] = [o, [o[0] + dl, d[1]]];
  const lngs = pts.map((p) => p[0]);
  const lats = pts.map((p) => p[1]);
  const spanX = Math.max(1e-6, Math.max(...lngs) - Math.min(...lngs));
  const spanY = Math.max(1e-6, Math.max(...lats) - Math.min(...lats));
  // 縦横比を保って、枠の 70% に収める
  const k = Math.min((box.w * 0.7) / spanX, (box.h * 0.5) / spanY);
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h * 0.62;
  const mx = (Math.max(...lngs) + Math.min(...lngs)) / 2;
  const my = (Math.max(...lats) + Math.min(...lats)) / 2;
  const to = (p: LngLat): [number, number] => [cx + (p[0] - mx) * k, cy - (p[1] - my) * k];
  let a = to(pts[0]);
  let b = to(pts[1]);
  // 横の間隔が狭い（南北の路線・同じ地点付近）場合は、上下の位置を保ったまま横に広げる
  if (Math.abs(b[0] - a[0]) < box.w * 0.3) {
    const dir = b[0] >= a[0] ? 1 : -1;
    a = [cx - dir * box.w * 0.3, Math.min(Math.max(a[1], box.y + box.h * 0.3), box.y + box.h * 0.9)];
    b = [cx + dir * box.w * 0.3, Math.min(Math.max(b[1], box.y + box.h * 0.3), box.y + box.h * 0.9)];
  }
  return { a, b };
}

export function formatFocus(seconds: number, lang: "ja" | "en"): string {
  const m = Math.max(0, Math.round(seconds / 60));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (lang === "ja") return h ? `${h}時間${r ? `${r}分` : ""}` : `${r}分`;
  return h ? `${h}h ${r}m` : `${r}m`;
}

function rand(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

const FONT = "'Hiragino Sans', 'Noto Sans JP', 'Helvetica Neue', Arial, sans-serif";
const MONO = "'SF Mono', 'Menlo', 'Roboto Mono', monospace";

function quadPoint(a: [number, number], c: [number, number], b: [number, number], t: number): [number, number] {
  const u = 1 - t;
  return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
}

/** Canvas に描画する（テストしやすいよう、生成と描画を分けている）。 */
export function drawFlightLog(ctx: CanvasRenderingContext2D, data: FlightLogData, format: ShareFormat, privacy: SharePrivacy, m: Messages, lang: "ja" | "en"): void {
  const L = shareLayout(format);
  const { w, h, pad, art, text, scale } = L;
  const s = (n: number) => n * scale;

  // 背景
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#0b1a33");
  bg.addColorStop(0.6, "#07101F");
  bg.addColorStop(1, "#04080f");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  const r = rand(data.originCode.charCodeAt(0) * 131 + data.destinationCode.charCodeAt(0) * 7 + Math.round(data.focusSeconds));
  for (let i = 0; i < 140; i++) {
    ctx.globalAlpha = 0.25 + r() * 0.6;
    ctx.fillStyle = "#F6F8FF";
    ctx.beginPath();
    ctx.arc(r() * w, r() * h * 0.75, r() * 2.2 + 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // 地球の縁
  const ey = format === "story" ? h * 1.72 : h * 1.55;
  const earth = ctx.createRadialGradient(w / 2, ey, h * 0.2, w / 2, ey, h * 0.95);
  earth.addColorStop(0, "#1d4a8a");
  earth.addColorStop(0.9, "#0f2547");
  earth.addColorStop(1, "rgba(102,179,255,0)");
  ctx.fillStyle = earth;
  ctx.beginPath();
  ctx.arc(w / 2, ey, h * 0.95, 0, Math.PI * 2);
  ctx.fill();

  // ブランド
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#EBC77B";
  ctx.font = `700 ${s(34)}px ${FONT}`;
  ctx.textAlign = "left";
  ctx.fillText("StudyFlight", pad, format === "wide" ? pad + s(20) : pad + 40);
  ctx.fillStyle = "rgba(246,248,255,0.6)";
  ctx.font = `500 ${s(26)}px ${FONT}`;
  ctx.textAlign = "right";
  const meta = [privacy.date ? data.dateLabel : "", privacy.name && data.displayName ? data.displayName : ""].filter(Boolean).join(" · ");
  if (meta) ctx.fillText(meta, w - pad, format === "wide" ? pad + s(20) : pad + 40);

  // 航路
  const { a, b } = data.origin && data.destination && privacy.route ? projectRoute(data.origin, data.destination, art) : projectRoute([0, 0], [10, 0], art);
  const lift = Math.max(art.h * 0.35, Math.abs(b[0] - a[0]) * 0.28);
  const c: [number, number] = [(a[0] + b[0]) / 2, Math.min(a[1], b[1]) - lift];
  ctx.lineCap = "round";
  ctx.setLineDash([s(14), s(14)]);
  ctx.strokeStyle = "rgba(102,179,255,0.55)";
  ctx.lineWidth = s(5);
  ctx.beginPath();
  ctx.moveTo(...a);
  ctx.quadraticCurveTo(c[0], c[1], b[0], b[1]);
  ctx.stroke();
  ctx.setLineDash([]);
  const progress = Math.max(0, Math.min(1, data.legProgress));
  ctx.strokeStyle = "#EBC77B";
  ctx.lineWidth = s(7);
  ctx.beginPath();
  ctx.moveTo(...a);
  for (let i = 1; i <= 48; i++) ctx.lineTo(...quadPoint(a, c, b, (progress * i) / 48));
  ctx.stroke();
  for (const [p, fill] of [
    [a, "#EBC77B"],
    [b, data.midAir ? "rgba(246,248,255,0.5)" : "#F6F8FF"],
  ] as const) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(p[0], p[1], s(12), 0, Math.PI * 2);
    ctx.fill();
  }
  // 機体
  const pp = quadPoint(a, c, b, progress);
  const ahead = quadPoint(a, c, b, Math.min(1, progress + 0.01));
  const back = quadPoint(a, c, b, Math.max(0, progress - 0.01));
  const ang = Math.atan2(ahead[1] - back[1], ahead[0] - back[0]);
  ctx.save();
  ctx.translate(pp[0], pp[1]);
  ctx.rotate(ang);
  ctx.fillStyle = "#F6F8FF";
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = s(12);
  const u = s(26);
  ctx.beginPath();
  ctx.moveTo(u * 1.2, 0);
  ctx.lineTo(-u * 0.2, -u * 0.18);
  ctx.lineTo(-u * 0.5, -u * 1.0);
  ctx.lineTo(-u * 0.75, -u * 1.0);
  ctx.lineTo(-u * 0.55, -u * 0.18);
  ctx.lineTo(-u * 1.0, -u * 0.15);
  ctx.lineTo(-u * 1.2, -u * 0.5);
  ctx.lineTo(-u * 1.35, -u * 0.5);
  ctx.lineTo(-u * 1.25, 0);
  ctx.lineTo(-u * 1.35, u * 0.5);
  ctx.lineTo(-u * 1.2, u * 0.5);
  ctx.lineTo(-u * 1.0, u * 0.15);
  ctx.lineTo(-u * 0.55, u * 0.18);
  ctx.lineTo(-u * 0.75, u * 1.0);
  ctx.lineTo(-u * 0.5, u * 1.0);
  ctx.lineTo(-u * 0.2, u * 0.18);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // 空港コード
  ctx.fillStyle = "#F6F8FF";
  ctx.textAlign = "center";
  const labels: [[number, number], string, string | undefined][] = [
    [a, data.originCode, data.originName],
    [b, data.destinationCode, data.destinationName],
  ];
  for (const [p, code, name] of labels) {
    const x = Math.min(Math.max(p[0], pad + s(90)), w - pad - s(90));
    ctx.fillStyle = "#F6F8FF";
    ctx.font = `800 ${s(64)}px ${MONO}`;
    ctx.fillText(privacy.route ? code : "•••", x, p[1] + s(86));
    ctx.font = `500 ${s(24)}px ${FONT}`;
    ctx.fillStyle = "rgba(246,248,255,0.65)";
    const sub = privacy.route ? name : m.card.hidden;
    if (sub) ctx.fillText(truncate(ctx, sub, art.w * 0.45), x, p[1] + s(126));
  }

  // 文字の領域
  ctx.textAlign = "left";
  let y = text.y + (format === "wide" ? s(110) : format === "story" ? 130 : 80);
  ctx.fillStyle = data.midAir ? "#EBC77B" : "#4ADE80";
  ctx.font = `700 ${s(28)}px ${FONT}`;
  ctx.fillText(data.midAir ? `${m.card.holding} · ${Math.round(progress * 100)}%` : m.card.arrived, text.x, y);
  y += s(40);
  ctx.fillStyle = "rgba(246,248,255,0.65)";
  ctx.font = `500 ${s(30)}px ${FONT}`;
  ctx.fillText(m.card.focus, text.x, y + s(30));
  y += s(30);
  ctx.fillStyle = "#F6F8FF";
  ctx.font = `800 ${s(format === "story" ? 150 : 128)}px ${FONT}`;
  y += s(format === "story" ? 150 : 128);
  ctx.fillText(formatFocus(data.focusSeconds, lang), text.x, y);
  y += s(70);
  ctx.font = `600 ${s(34)}px ${FONT}`;
  ctx.fillStyle = "rgba(246,248,255,0.85)";
  const km = Math.round(data.distanceKm).toLocaleString(lang === "ja" ? "ja-JP" : "en-US");
  ctx.fillText(`${m.card.distance} ${km} km   ·   ${m.card.points} +${data.points} SP`, text.x, y);
  if (privacy.subject && data.subjectName) {
    y += s(80);
    ctx.font = `700 ${s(34)}px ${FONT}`;
    const label = truncate(ctx, data.subjectName, text.w - s(80));
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    roundRect(ctx, text.x, y - s(46), tw + s(76), s(64), s(32));
    ctx.fill();
    ctx.fillStyle = data.subjectColor;
    ctx.beginPath();
    ctx.arc(text.x + s(30), y - s(14), s(10), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#F6F8FF";
    ctx.fillText(label, text.x + s(52), y);
  }

  // フッター
  ctx.textAlign = format === "wide" ? "left" : "center";
  ctx.fillStyle = "rgba(246,248,255,0.55)";
  ctx.font = `500 ${s(26)}px ${FONT}`;
  ctx.fillText(m.card.tagline, format === "wide" ? text.x : w / 2, h - pad + s(10));
}

function truncate(ctx: CanvasRenderingContext2D, s: string, max: number): string {
  if (ctx.measureText(s).width <= max) return s;
  let t = s;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function renderFlightLog(data: FlightLogData, format: ShareFormat, privacy: SharePrivacy, m: Messages, lang: "ja" | "en"): Promise<Blob> {
  const { w, h } = SHARE_SIZES[format];
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  try {
    await document.fonts?.ready;
  } catch {
    /* noop */
  }
  drawFlightLog(ctx, data, format, privacy, m, lang);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png"));
}
