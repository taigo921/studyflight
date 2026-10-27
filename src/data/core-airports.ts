// 空港データ (public/data/airports.json) を読み込めない場合でも UI が壊れないための最小データ。
// 座標・コードは OurAirports (Public Domain) より。
import type { Airport } from "@/domain/types";

type Row = [id: string, iata: string, name: string, nameJa: string, city: string, cc: string, lat: number, lng: number, large: boolean];

const ROWS: Row[] = [
  ["RJTT", "HND", "Tokyo Haneda International Airport", "東京国際空港（羽田）", "Tokyo", "JP", 35.5497, 139.787, true],
  ["RJAA", "NRT", "Narita International Airport", "成田国際空港", "Narita", "JP", 35.7686, 140.3887, true],
  ["RJGG", "NGO", "Chubu Centrair International Airport", "中部国際空港（セントレア）", "Tokoname", "JP", 34.8584, 136.805, true],
  ["RJNA", "NKM", "Nagoya Airport", "県営名古屋空港（小牧）", "Nagoya", "JP", 35.2558, 136.9241, false],
  ["RJBB", "KIX", "Kansai International Airport", "関西国際空港", "Osaka", "JP", 34.4273, 135.244, true],
  ["RJOO", "ITM", "Osaka International Airport", "大阪国際空港（伊丹）", "Osaka", "JP", 34.7855, 135.438, true],
  ["RJCC", "CTS", "New Chitose Airport", "新千歳空港", "Sapporo", "JP", 42.7748, 141.6904, true],
  ["RJFF", "FUK", "Fukuoka Airport", "福岡空港", "Fukuoka", "JP", 33.5859, 130.451, true],
  ["ROAH", "OKA", "Naha International Airport", "那覇空港", "Naha", "JP", 26.1924, 127.6398, true],
  ["RJSS", "SDJ", "Sendai Airport", "仙台空港", "Sendai", "JP", 38.1397, 140.917, false],
  ["RKSI", "ICN", "Incheon International Airport", "仁川国際空港", "Seoul", "KR", 37.4691, 126.451, true],
  ["RCTP", "TPE", "Taiwan Taoyuan International Airport", "台湾桃園国際空港", "Taipei", "TW", 25.0777, 121.2328, true],
  ["VHHH", "HKG", "Hong Kong International Airport", "香港国際空港", "Hong Kong", "HK", 22.308, 113.9185, true],
  ["WSSS", "SIN", "Singapore Changi Airport", "シンガポール・チャンギ国際空港", "Singapore", "SG", 1.3502, 103.9944, true],
  ["PHNL", "HNL", "Daniel K. Inouye International Airport", "ダニエル・K・イノウエ国際空港（ホノルル）", "Honolulu", "US", 21.3187, -157.9225, true],
  ["KLAX", "LAX", "Los Angeles International Airport", "ロサンゼルス国際空港", "Los Angeles", "US", 33.9425, -118.4081, true],
  ["KJFK", "JFK", "John F. Kennedy International Airport", "ジョン・F・ケネディ国際空港", "New York", "US", 40.6394, -73.7793, true],
  ["EGLL", "LHR", "London Heathrow Airport", "ロンドン・ヒースロー空港", "London", "GB", 51.4707, -0.4599, true],
  ["LFPG", "CDG", "Charles de Gaulle International Airport", "パリ＝シャルル・ド・ゴール空港", "Paris", "FR", 49.0097, 2.5479, true],
  ["YSSY", "SYD", "Sydney Kingsford Smith International Airport", "シドニー国際空港", "Sydney", "AU", -33.9461, 151.1772, true],
];

export const CORE_AIRPORTS: Airport[] = ROWS.map(([id, iata, name, nameJa, municipality, countryCode, lat, lng, large]) => ({
  id,
  iata,
  icao: id,
  name,
  nameJa,
  municipality,
  countryCode,
  lat,
  lng,
  type: large ? "large_airport" : "medium_airport",
}));

/** 初回のおすすめ候補（最近使った空港が無いとき） */
export const SUGGESTED_AIRPORT_IDS = ["RJNA", "RJGG", "RJTT", "RJAA", "RJBB", "RJCC", "RJFF", "ROAH"];
