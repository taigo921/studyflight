import { describe, expect, it } from "vitest";
import airportsJson from "../../../public/data/airports.json";
import routesJson from "../../../public/data/routes.json";
import { parseAirportDataset } from "@/data/airports";
import { parseRouteGraph, planItinerary, searchFlights } from "../route-search";

const { airports } = parseAirportDataset(airportsJson);
const byId = new Map(airports.map((a) => [a.id, a]));
const graph = parseRouteGraph(routesJson as unknown as { routes: Record<string, [string, string][]> });
const A = (id: string) => byId.get(id)!;
const base = { byId, airports, graph, tolerance: { minus: 10, plus: 10 } };

describe("実在路線にもとづく候補", () => {
  it("羽田から100分前後: 新千歳など実在の直行便が route として出る", () => {
    const r = searchFlights({ ...base, origin: A("RJTT"), studyMinutes: 100 });
    expect(r.hasRouteData).toBe(true);
    const cts = r.fit.find((c) => c.airport.id === "RJCC");
    expect(cts?.source).toBe("route");
    expect(cts?.carriers.length).toBeGreaterThan(0);
    expect(r.fit.every((c) => c.blockMinutes >= 90 && c.blockMinutes <= 110)).toBe(true);
    // 路線データがある空港では推定候補を混ぜない（既定）
    expect(r.fit.every((c) => c.source === "route")).toBe(true);
  });

  it("30分（20〜40分）では直行便がほぼ無いので、長い便が分割候補になる", () => {
    const r = searchFlights({ ...base, origin: A("RJTT"), studyMinutes: 30 });
    expect(r.longer.length).toBeGreaterThan(0);
    expect(r.longer[0].sessions).toBeGreaterThanOrEqual(2);
    expect(r.longer.every((c) => c.blockMinutes > 40)).toBe(true);
  });

  it("推定候補は明示的に区別される", () => {
    const r = searchFlights({ ...base, origin: A("RJTT"), studyMinutes: 100, includeEstimated: true });
    expect(r.fit.some((c) => c.source === "estimated")).toBe(true);
    expect(r.fit.filter((c) => c.source === "estimated").every((c) => c.carriers.length === 0)).toBe(true);
  });

  it("許容幅を広げると候補が増える", () => {
    const narrow = searchFlights({ ...base, origin: A("RJGG"), studyMinutes: 60, tolerance: { minus: 5, plus: 5 } });
    const wide = searchFlights({ ...base, origin: A("RJGG"), studyMinutes: 60, tolerance: { minus: 30, plus: 30 } });
    expect(wide.fit.length).toBeGreaterThan(narrow.fit.length);
  });

  it("最終目的地への前進度が付き、近づく便が先に並ぶ", () => {
    const r = searchFlights({ ...base, origin: A("RJTT"), studyMinutes: 120, tolerance: { minus: 60, plus: 60 }, final: A("ROAH") });
    expect(r.fit[0].finalProgress).not.toBeNull();
    expect(r.fit[0].finalProgress!).toBeGreaterThan(0.3);
  });
});

describe("経由ルート", () => {
  it("中部から那覇へ直行便データがあれば1区間、無い組み合わせでも経由で到達", () => {
    const legs = planItinerary(graph, byId, "RJGG", "ROAH");
    expect(legs).not.toBeNull();
    expect(legs![legs!.length - 1].to.id).toBe("ROAH");
    const far = planItinerary(graph, byId, "RJCC", "LFPG");
    expect(far).not.toBeNull();
    expect(far!.length).toBeGreaterThanOrEqual(1);
    for (let i = 1; i < far!.length; i++) expect(far![i].from.id).toBe(far![i - 1].to.id);
  });
  it("到達できない場合は null", () => {
    expect(planItinerary(new Map(), byId, "RJGG", "ROAH")).toBeNull();
  });
});
