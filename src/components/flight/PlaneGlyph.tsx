/** 地図上の機影（真上視点の抽象形、北向き基準）。 */
export const PLANE_PATH =
  "M12 2.2c.95 0 1.5 1 1.5 2.4v4.6l7.3 4.3v2.1l-7.3-2.2v4l2.2 1.7v1.6L12 19.6l-3.7 1.1v-1.6l2.2-1.7v-4l-7.3 2.2v-2.1l7.3-4.3V4.6c0-1.4.55-2.4 1.5-2.4Z";

export function planeSvgMarkup(size = 34): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" style="filter: drop-shadow(0 0 6px rgba(235,199,123,.75))"><path d="${PLANE_PATH}" fill="#F6F8FF" stroke="#07101F" stroke-width=".6"/></svg>`;
}
