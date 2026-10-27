import { describe, expect, it } from "vitest";
import { BLUE_MARBLE, DEFAULT_PROVIDER_ID, satelliteProvider } from "../imagery";
import { resolveRenderSettings } from "../render-quality";
import { nearest } from "@/domain/geo";
import { formatLatLng } from "@/domain/format";

describe("satelliteProvider", () => {
  it("既定は帰属表示つきで利用できる 2016 版", () => {
    const p = satelliteProvider({});
    expect(p.id).toBe(DEFAULT_PROVIDER_ID);
    expect(p.license).toBe("CC BY 4.0");
    expect(p.tiles).toContain("s2cloudless_3857");
    expect(p.attribution).toContain("EOX");
  });
  it("2024 版は非商用ライセンスと明示される", () => {
    expect(satelliteProvider({ NEXT_PUBLIC_SATELLITE_PROVIDER: "eox-s2cloudless-2024" }).license).toMatch(/NC/);
  });
  it("未知の ID は既定に戻り、タイル URL 指定は独自配信元になる", () => {
    expect(satelliteProvider({ NEXT_PUBLIC_SATELLITE_PROVIDER: "nope" }).id).toBe(DEFAULT_PROVIDER_ID);
    const c = satelliteProvider({ NEXT_PUBLIC_SATELLITE_TILES: "https://x/{z}/{x}/{y}.jpg", NEXT_PUBLIC_SATELLITE_MAXZOOM: "18", NEXT_PUBLIC_SATELLITE_TILESIZE: "512" });
    expect(c).toMatchObject({ id: "custom", maxzoom: 18, tileSize: 512 });
  });
  it("Blue Marble は GIBS の Web メルカトル z0-8", () => {
    expect(BLUE_MARBLE.tiles).toContain("epsg3857");
    expect(BLUE_MARBLE.maxzoom).toBe(8);
  });
});

describe("resolveRenderSettings", () => {
  it("省電力は解像度1倍・地形なし・1秒更新", () => {
    expect(resolveRenderSettings("low", { devicePixelRatio: 3 })).toMatchObject({ pixelRatio: 1, terrain: false, frameIntervalMs: 1000 });
  });
  it("自動は最大2倍、省データ設定や低メモリでは省電力", () => {
    expect(resolveRenderSettings("auto", { devicePixelRatio: 3 }).pixelRatio).toBe(2);
    expect(resolveRenderSettings("auto", { devicePixelRatio: 3, saveData: true }).terrain).toBe(false);
    expect(resolveRenderSettings("auto", { devicePixelRatio: 2, deviceMemory: 2 }).pixelRatio).toBe(1);
  });
  it("高画質は端末の解像度（最大3倍）", () => {
    expect(resolveRenderSettings("high", { devicePixelRatio: 3 }).pixelRatio).toBe(3);
  });
});

describe("nearest / formatLatLng", () => {
  it("最寄りの地点と距離", () => {
    const r = nearest([139.78, 35.55], [
      { id: "HND", lng: 139.78, lat: 35.55 },
      { id: "NRT", lng: 140.39, lat: 35.77 },
    ]);
    expect(r?.item.id).toBe("HND");
    expect(r?.km).toBeLessThan(1);
    expect(nearest([0, 0], [])).toBeNull();
  });
  it("南半球・西半球", () => {
    expect(formatLatLng(-46.47, -23.43)).toBe("23.43°S 46.47°W");
    expect(formatLatLng(139.78, 35.55, 1)).toBe("35.5°N 139.8°E");
  });
});
