// 衛星画像の配信元。環境変数 NEXT_PUBLIC_SATELLITE_PROVIDER で切り替える（キー不要の配信元のみ同梱）。
// 比較と選定理由は docs/MAP_PROVIDERS.md。商用利用時は各提供元の最新の規約を必ず確認すること。

export interface ImageryProvider {
  id: string;
  /** 設定画面・出典一覧での表示名 */
  label: string;
  tiles: string;
  maxzoom: number;
  tileSize: 256 | 512;
  /** 地図上の帰属表示（HTML） */
  attribution: string;
  /** 出典一覧の文言 */
  credit: string;
  href: string;
  license: string;
}

/** 地球全体を見る低ズーム用。NASA Blue Marble Next Generation（GIBS, パブリックドメイン, z0–8） */
export const BLUE_MARBLE: ImageryProvider = {
  id: "nasa-blue-marble",
  label: "NASA Blue Marble",
  tiles:
    process.env.NEXT_PUBLIC_GLOBE_TILES ??
    "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg",
  maxzoom: 8,
  tileSize: 256,
  attribution: 'Imagery: <a href="https://earthdata.nasa.gov/gibs" target="_blank" rel="noopener">NASA GIBS</a> Blue Marble Next Generation',
  credit: "NASA Blue Marble Next Generation — NASA EOSDIS GIBS（パブリックドメイン）",
  href: "https://www.earthdata.nasa.gov/gibs",
  license: "NASA imagery (public domain, acknowledgement requested)",
};

const PROVIDERS: Record<string, ImageryProvider> = {
  // Sentinel-2 cloudless 2016（CC BY 4.0）。古い合成で日本付近は雲の残りが目立つ。商用公開時の候補
  "eox-s2cloudless-2016": {
    id: "eox-s2cloudless-2016",
    label: "Sentinel-2 cloudless 2016",
    tiles: "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg",
    maxzoom: 14,
    tileSize: 256,
    attribution:
      '<a href="https://s2maps.eu" target="_blank" rel="noopener">Sentinel-2 cloudless - https://s2maps.eu</a> by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2016 &amp; 2017)',
    credit: "Sentinel-2 cloudless - https://s2maps.eu by EOX IT Services GmbH（Contains modified Copernicus Sentinel data 2016 & 2017）",
    href: "https://s2maps.eu",
    license: "CC BY 4.0",
  },
  // 既定: 雲の残りが少なく画質が良い。CC BY-NC-SA 4.0（非商用のみ）。商用には EOX の有償ライセンスか 2016 版への切替が必要
  "eox-s2cloudless-2024": {
    id: "eox-s2cloudless-2024",
    label: "Sentinel-2 cloudless 2024",
    tiles: "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg",
    maxzoom: 14,
    tileSize: 256,
    attribution:
      '<a href="https://s2maps.eu" target="_blank" rel="noopener">Sentinel-2 cloudless</a> by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2024)',
    credit: "Sentinel-2 cloudless by EOX IT Services GmbH（Contains modified Copernicus Sentinel data 2024）",
    href: "https://s2maps.eu",
    license: "CC BY-NC-SA 4.0（非商用のみ）",
  },
};

export const DEFAULT_PROVIDER_ID = "eox-s2cloudless-2024";

/** 現在の衛星画像の配信元。NEXT_PUBLIC_SATELLITE_TILES を指定した場合は独自の配信元として扱う。 */
export function satelliteProvider(env: Record<string, string | undefined> = readEnv()): ImageryProvider {
  const base = PROVIDERS[env.NEXT_PUBLIC_SATELLITE_PROVIDER ?? DEFAULT_PROVIDER_ID] ?? PROVIDERS[DEFAULT_PROVIDER_ID];
  if (!env.NEXT_PUBLIC_SATELLITE_TILES) return base;
  return {
    id: "custom",
    label: env.NEXT_PUBLIC_SATELLITE_LABEL ?? "衛星画像",
    tiles: env.NEXT_PUBLIC_SATELLITE_TILES,
    maxzoom: Number(env.NEXT_PUBLIC_SATELLITE_MAXZOOM ?? 14),
    tileSize: env.NEXT_PUBLIC_SATELLITE_TILESIZE === "512" ? 512 : 256,
    attribution: env.NEXT_PUBLIC_SATELLITE_ATTRIBUTION ?? "",
    credit: env.NEXT_PUBLIC_SATELLITE_CREDIT ?? env.NEXT_PUBLIC_SATELLITE_ATTRIBUTION ?? "衛星画像",
    href: env.NEXT_PUBLIC_SATELLITE_HREF ?? "",
    license: env.NEXT_PUBLIC_SATELLITE_LICENSE ?? "提供元の規約による",
  };
}

// Next.js は process.env.NEXT_PUBLIC_* をビルド時に文字列へ置き換えるため、個別に参照する
function readEnv(): Record<string, string | undefined> {
  return {
    NEXT_PUBLIC_SATELLITE_PROVIDER: process.env.NEXT_PUBLIC_SATELLITE_PROVIDER,
    NEXT_PUBLIC_SATELLITE_TILES: process.env.NEXT_PUBLIC_SATELLITE_TILES,
    NEXT_PUBLIC_SATELLITE_LABEL: process.env.NEXT_PUBLIC_SATELLITE_LABEL,
    NEXT_PUBLIC_SATELLITE_MAXZOOM: process.env.NEXT_PUBLIC_SATELLITE_MAXZOOM,
    NEXT_PUBLIC_SATELLITE_TILESIZE: process.env.NEXT_PUBLIC_SATELLITE_TILESIZE,
    NEXT_PUBLIC_SATELLITE_ATTRIBUTION: process.env.NEXT_PUBLIC_SATELLITE_ATTRIBUTION,
    NEXT_PUBLIC_SATELLITE_CREDIT: process.env.NEXT_PUBLIC_SATELLITE_CREDIT,
    NEXT_PUBLIC_SATELLITE_HREF: process.env.NEXT_PUBLIC_SATELLITE_HREF,
    NEXT_PUBLIC_SATELLITE_LICENSE: process.env.NEXT_PUBLIC_SATELLITE_LICENSE,
  };
}
