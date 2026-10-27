// MapLibre GL 6 は ESM ワーカーを別ファイルで読み込む。バンドラ依存を避けるため
// public/maplibre/ に複製し、setWorkerUrl() で明示的に参照する。
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pkgPath = require.resolve("maplibre-gl/package.json");
const dist = join(dirname(pkgPath), "dist");
const version = JSON.parse(readFileSync(pkgPath, "utf8")).version;
const outDir = join(process.cwd(), "public", "maplibre");
mkdirSync(outDir, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl.css"]) {
  copyFileSync(join(dist, file), join(outDir, file));
}
console.log(`[maplibre] copied worker v${version} -> public/maplibre/`);
