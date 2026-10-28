// フライト中の機体（真上から見た旅客機、北向き基準）。すべてコードで描いたオリジナル。
// 地図の面に沿って置き（pitchAlignment: map）、高度に応じて地面の影を離して立体感を出す。

const SILHOUETTE =
  // 胴体
  "M50 4C53 4 54.6 9.5 54.6 17V77C54.6 85.5 52.6 92.5 50 96.5 47.4 92.5 45.4 85.5 45.4 77V17C45.4 9.5 47 4 50 4Z" +
  // 主翼
  "M54 36.5 93.5 57 95 60.5 89 61.2 54 53Z M46 36.5 6.5 57 5 60.5 11 61.2 46 53Z" +
  // 水平尾翼
  "M53.6 81.5 71.5 90.6 72.3 93.6 53.6 89.5Z M46.4 81.5 28.5 90.6 27.7 93.6 46.4 89.5Z";

function planeSvg(reducedMotion: boolean): string {
  const strobe = reducedMotion
    ? ""
    : '<animate attributeName="opacity" values="0;0;1;0;0;1;0" keyTimes="0;0.7;0.73;0.78;0.84;0.87;1" dur="1.6s" repeatCount="indefinite"/>';
  const beacon = reducedMotion ? "" : '<animate attributeName="opacity" values="0.15;1;0.15" dur="1.1s" repeatCount="indefinite"/>';
  return `<svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
  <defs>
    <linearGradient id="sfp-body" x1="0" x2="1">
      <stop offset="0" stop-color="#9aa6b6"/><stop offset=".35" stop-color="#eef2f7"/><stop offset=".55" stop-color="#ffffff"/><stop offset="1" stop-color="#a9b4c3"/>
    </linearGradient>
    <linearGradient id="sfp-wing-r" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#e9edf3"/><stop offset="1" stop-color="#b5bfcc"/>
    </linearGradient>
    <linearGradient id="sfp-wing-l" x1="1" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e9edf3"/><stop offset="1" stop-color="#aab4c2"/>
    </linearGradient>
    <linearGradient id="sfp-engine" x1="0" x2="1">
      <stop offset="0" stop-color="#6f7a89"/><stop offset=".5" stop-color="#c7cfda"/><stop offset="1" stop-color="#6f7a89"/>
    </linearGradient>
  </defs>
  <!-- 主翼（後縁のフラップの線つき） -->
  <path d="M54 36.5 93.5 57 95 60.5 89 61.2 54 53Z" fill="url(#sfp-wing-r)" stroke="#7d8898" stroke-width=".35"/>
  <path d="M46 36.5 6.5 57 5 60.5 11 61.2 46 53Z" fill="url(#sfp-wing-l)" stroke="#7d8898" stroke-width=".35"/>
  <path d="M56 51.8 86 59.2M44 51.8 14 59.2" stroke="#8c97a6" stroke-width=".45" fill="none"/>
  <path d="M93.5 57 95.6 55.2 96.4 56 95 60.5M6.5 57 4.4 55.2 3.6 56 5 60.5" fill="#d9dee6" stroke="#7d8898" stroke-width=".3"/>
  <!-- エンジン -->
  <rect x="63.6" y="36" width="6.4" height="14.5" rx="3" fill="url(#sfp-engine)" stroke="#55606e" stroke-width=".35"/>
  <rect x="30" y="36" width="6.4" height="14.5" rx="3" fill="url(#sfp-engine)" stroke="#55606e" stroke-width=".35"/>
  <ellipse cx="66.8" cy="36.9" rx="2.5" ry="1.1" fill="#2a313b"/>
  <ellipse cx="33.2" cy="36.9" rx="2.5" ry="1.1" fill="#2a313b"/>
  <!-- 水平尾翼 -->
  <path d="M53.6 81.5 71.5 90.6 72.3 93.6 53.6 89.5Z" fill="url(#sfp-wing-r)" stroke="#7d8898" stroke-width=".3"/>
  <path d="M46.4 81.5 28.5 90.6 27.7 93.6 46.4 89.5Z" fill="url(#sfp-wing-l)" stroke="#7d8898" stroke-width=".3"/>
  <!-- 胴体 -->
  <path d="M50 4C53 4 54.6 9.5 54.6 17V77C54.6 85.5 52.6 92.5 50 96.5 47.4 92.5 45.4 85.5 45.4 77V17C45.4 9.5 47 4 50 4Z" fill="url(#sfp-body)" stroke="#7d8898" stroke-width=".35"/>
  <!-- 背のライン（ブランドの金）と垂直尾翼 -->
  <path d="M50 20V74" stroke="#EBC77B" stroke-width=".9" stroke-linecap="round" opacity=".75"/>
  <path d="M49.1 78.5h1.8l.4 17.2c-.9.9-1.7.9-2.6 0Z" fill="#c3ccd8" stroke="#7d8898" stroke-width=".3"/>
  <!-- 操縦席の窓 -->
  <path d="M47.2 10.6Q50 8.4 52.8 10.6L52.3 12.4Q50 11.1 47.7 12.4Z" fill="#1d2633"/>
  <!-- 航法灯（左翼端 赤・右翼端 緑・尾 白）と衝突防止灯 -->
  <circle cx="5.3" cy="58.8" r="1.3" fill="#ff4d4d"/><circle cx="94.7" cy="58.8" r="1.3" fill="#3dff7a"/>
  <circle cx="5.3" cy="58.8" r="3.2" fill="#ff4d4d" opacity=".25"/><circle cx="94.7" cy="58.8" r="3.2" fill="#3dff7a" opacity=".25"/>
  <g fill="#ffffff">
    <circle cx="5.6" cy="60.6" r="2.4">${strobe}</circle>
    <circle cx="94.4" cy="60.6" r="2.4">${strobe}</circle>
    <circle cx="50" cy="96.2" r="1.6">${strobe}</circle>
  </g>
  <circle cx="50" cy="45" r="1.2" fill="#ff3b3b">${beacon}</circle>
</svg>`;
}

export interface PlaneMarker {
  element: HTMLElement;
  /**
   * 毎フレーム呼ぶ。altitude: 0（地上）〜1（巡航）、bearing: 機首方位（度）。
   * 影は太陽が北西にある想定で、地図上で南東に落ちる（機体の向きに関係なく同じ方角）。
   */
  update(altitude: number, bearing: number): void;
  setSize(px: number): void;
}

export function createPlaneMarker(reducedMotion: boolean, size = 66): PlaneMarker {
  const el = document.createElement("div");
  el.setAttribute("aria-hidden", "true");
  el.style.cssText = `position:relative;width:${size}px;height:${size}px;pointer-events:none`;
  const shadow = document.createElement("div");
  shadow.style.cssText = "position:absolute;inset:0;will-change:transform,filter,opacity";
  shadow.innerHTML = `<svg viewBox="0 0 100 100" width="100%" height="100%"><path d="${SILHOUETTE}" fill="#000"/></svg>`;
  const body = document.createElement("div");
  body.style.cssText = "position:absolute;inset:0;filter:drop-shadow(0 0 1.5px rgba(0,0,0,.35))";
  body.innerHTML = planeSvg(reducedMotion);
  el.append(shadow, body);

  let current = size;
  let last = "";
  return {
    element: el,
    setSize(px) {
      current = px;
      el.style.width = `${px}px`;
      el.style.height = `${px}px`;
    },
    update(altitude, bearing) {
      const a = Math.max(0, Math.min(1, altitude));
      // 地図上で南東（135°）に落ちる影を、機体の座標系（機首が上）に回して置く
      const dist = (0.08 + a * 0.5) * current;
      const rad = ((135 - bearing) * Math.PI) / 180;
      const dx = Math.sin(rad) * dist;
      const dy = -Math.cos(rad) * dist;
      const scale = 1 - a * 0.12;
      const blur = 0.6 + a * 3.2;
      const opacity = 0.5 - a * 0.22;
      const key = `${dx.toFixed(1)}|${dy.toFixed(1)}|${scale.toFixed(3)}|${blur.toFixed(1)}`;
      if (key === last) return;
      last = key;
      shadow.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
      shadow.style.filter = `blur(${blur}px)`;
      shadow.style.opacity = String(opacity);
    },
  };
}
