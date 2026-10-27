import { describe, expect, it } from "vitest";
import { CORE_AIRPORTS } from "@/data/core-airports";
import { parseAirportDataset } from "@/data/airports";
import { searchAirports } from "../airport-search";
import dataset from "../../../public/data/airports.json";

describe("空港検索", () => {
  it("IATA 完全一致が最優先", () => {
    expect(searchAirports(CORE_AIRPORTS, "hnd")[0].id).toBe("RJTT");
    expect(searchAirports(CORE_AIRPORTS, "ＮＫＭ")[0].id).toBe("RJNA"); // 全角も可
  });
  it("ICAO・日本語名・都市名", () => {
    expect(searchAirports(CORE_AIRPORTS, "RJGG")[0].id).toBe("RJGG");
    expect(searchAirports(CORE_AIRPORTS, "羽田")[0].id).toBe("RJTT");
    expect(searchAirports(CORE_AIRPORTS, "london")[0].id).toBe("EGLL");
  });
  it("空クエリは空", () => {
    expect(searchAirports(CORE_AIRPORTS, "  ")).toEqual([]);
  });
  it("同梱データセットを解析・検索できる", () => {
    const { airports } = parseAirportDataset(dataset);
    expect(airports.length).toBeGreaterThan(4000);
    expect(searchAirports(airports, "小牧")[0]?.id).toBe("RJNA");
    expect(searchAirports(airports, "成田")[0]?.id).toBe("RJAA");
    expect(searchAirports(airports, "CDG")[0]?.id).toBe("LFPG");
  });
});
