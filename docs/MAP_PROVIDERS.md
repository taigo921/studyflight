# 地図・衛星画像の配信元（比較と選定）

最終確認: 2026-10-28。規約・料金は変わるため、**商用化・有料化の前に必ず各提供元の最新の規約を確認**すること。ここに書いた内容は法的助言ではない。

## 現在の構成（APIキー不要）

| 用途 | 配信元 | ライセンス / 条件 | 帰属表示 |
|---|---|---|---|
| 地球全体（ズーム 0〜約5） | NASA Blue Marble Next Generation（GIBS WMTS, EPSG:3857, z0–8） | NASA の画像（米国政府著作物）。GIBS は利用時の謝辞を求めている | 「ⓘ 出典」に表示 |
| 衛星写真（ズーム 3.5 以上でクロスフェード） | Sentinel-2 cloudless **2016**（EOX） | CC BY 4.0（EOX の s2maps.eu の記載） | `Sentinel-2 cloudless - https://s2maps.eu by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2016 & 2017)` |
| 3D 地形 | Terrain Tiles（Mapzen / AWS Open Data, terrarium） | 各データソースの帰属が必要 | 「ⓘ 出典」に表示 |
| 地名ラベル・標準/ダーク | OpenFreeMap（OpenMapTiles / OpenStreetMap） | ODbL（OSM）・OpenMapTiles の帰属 | 「ⓘ 出典」に表示 |
| オフライン時 | Natural Earth（同梱） | パブリックドメイン | 「ⓘ 出典」に表示 |

外部タイルは Service Worker で事前キャッシュしない（大量取得・規約違反の防止）。

## EOxCloudless 2016 と Mapbox Satellite の比較

| 観点 | Sentinel-2 cloudless 2016（EOX） | Mapbox Satellite |
|---|---|---|
| 無料利用 | APIキー不要で WMTS を利用可能 | 無料枠あり（要アカウント・アクセストークン）。枠の数値は料金ページで要確認 |
| 商用利用 | 2016 版は CC BY 4.0 と記載。ただし EOX の新しいページでは商用利用を「EOX Commercial Attribution-RestrictedUse」ライセンス経由としており、**商用時は EOX（cloudless@eox.at）に確認が必要** | 有料プラン・規約の範囲で可。規約上の制限（キャッシュ・オフライン保存の禁止など）あり |
| 帰属表示 | 上記クレジット文言を常時表示 | Mapbox ロゴ + 「© Mapbox © OpenStreetMap Improve this map」 |
| 解像度 | 約10m（Sentinel-2）。z14 まで。都市の街区程度 | 都市部は高解像度の航空写真（サブメートル級）、ズーム 19〜22 程度まで |
| 画像の新しさ | 2016〜2017 年の合成。雲なし・色調が均一 | 地域ごとに異なる年代のモザイク |
| 制限 | 公開サーバーの負荷配慮が必要（大量アクセス時は有償サービスやセルフホストを検討） | リクエスト数による従量課金。トークンの URL 制限が必要 |
| 費用 | 無料（商用ライセンスは別途見積もり） | 無料枠超過で従量課金（料金ページで要確認） |
| キー管理 | 不要 | 公開トークン（pk.）をクライアントに置く設計。URL 制限必須。**本プロジェクトの方針ではユーザー承認後に導入** |

参考: 2018〜2024 年版の Sentinel-2 cloudless は CC BY-NC-SA 4.0（非商用のみ）。`NEXT_PUBLIC_SATELLITE_PROVIDER=eox-s2cloudless-2024` で切り替えられるが、商用公開では使わないこと。

### 判断

- **現状（無料の個人公開・ベータ）**: 既定を 2016 版（CC BY 4.0）にする。画像は少し古いが、帰属表示を条件に使える版。
- **商用化前**: EOX に 2016 版の商用利用条件を確認する。必要なら EOX の商用ライセンス、または Mapbox Satellite（承認・トークン管理・費用見積もり後）に切り替える。
- Blue Marble は低ズームの地球儀用。NASA の謝辞を出典一覧に表示している。

## 差し替え方法（コード変更不要）

`.env.example` を参照。

- `NEXT_PUBLIC_SATELLITE_PROVIDER` — `eox-s2cloudless-2016`（既定）/ `eox-s2cloudless-2024`
- `NEXT_PUBLIC_SATELLITE_TILES` ほか — 任意の XYZ タイル（指定すると独自配信元として扱い、帰属表示も環境変数から）
- `NEXT_PUBLIC_GLOBE_TILES` — 低ズームの地球画像

実装: `src/lib/imagery.ts`（配信元の一覧）、`src/lib/map-styles.ts`（スタイル組み立て、Blue Marble → Sentinel のクロスフェード）。

## 描画品質（GPU・バッテリー）

設定 → 表示 → 描画品質（`src/lib/render-quality.ts`）。

| 品質 | 解像度 | 3D 地形 | カメラ更新 | タイルキャッシュ |
|---|---|---|---|---|
| 省電力 | 1倍 | なし | 1秒ごと | 60 |
| 自動 | 最大2倍（省データ設定・低メモリ端末では省電力） | あり | 0.5秒ごと | 150 |
| 高画質 | 最大3倍 | あり | 0.25秒ごと | 300 |

画面を離れると地図を破棄し、WebGL コンテキストを明示的に解放する。非表示中はカメラ更新を止める。

## 出典

- EOX s2maps.eu / cloudless.eox.at（ライセンス・料金ページ）
- NASA Earthdata GIBS（https://www.earthdata.nasa.gov/gibs）
- Mapbox Docs: Raster Tiles API、Pricing、帰属表示 FAQ
