import { expect, test } from "@playwright/test";
import { chooseSeat, resumeFlight, setMinutes, skipOnboarding, startFlight, T0 } from "./helpers";

test.describe("集中フロー", () => {
  test("初回スキップ→25分フライト→リロード復元→一時停止→着陸→記録・集計", async ({ page }) => {
    await page.clock.install({ time: T0 });
    await skipOnboarding(page);
    await expect(page.getByTestId("today-total")).toHaveText("0分");

    const id = await startFlight(page);
    await expect(page.getByTestId("remaining")).toHaveText(/^2[45]:\d\d$/);

    // 10分経過してからリロード → 10分相当に戻る（二重保存されない）
    await page.clock.fastForward("10:00");
    await page.reload();
    await expect(page.getByTestId("elapsed")).toHaveText(/^10:0\d$/);
    await expect(page.getByTestId("remaining")).toHaveText(/^1[45]:\d\d$/);

    // 一時停止中は10分放置しても増えない
    await page.getByRole("button", { name: "一時停止" }).click();
    await expect(page.getByTestId("flight-screen")).toHaveAttribute("data-status", "paused");
    const pausedAt = await page.getByTestId("elapsed").textContent();
    await page.clock.fastForward("10:00");
    await page.reload();
    await expect(page.getByTestId("elapsed")).toHaveText(pausedAt!);

    // 再開して残り時間を飛ばすと自動で着陸
    await page.getByRole("button", { name: "再開" }).click();
    // 再開の保存が終わってから時計を進める（先に進めると再開時刻が15分後として記録される）
    await expect(page.getByTestId("flight-screen")).toHaveAttribute("data-status", "active");
    await page.clock.fastForward("15:30");
    await page.waitForURL(`**/arrival/?id=${id}`);
    await expect(page.getByTestId("arrival-focus")).toHaveText("25分");
    await expect(page.getByTestId("arrival-points")).toHaveText("+35");
    await page.getByRole("button", { name: "保存して閉じる" }).click();

    // ホーム・分析・パスポートが同じ原本から一致した数字を出す
    await page.waitForURL((u) => u.pathname === "/");
    await expect(page.getByTestId("today-total")).toHaveText("25分");
    await page.getByRole("link", { name: "分析" }).click();
    await page.getByRole("radio", { name: "今日" }).click();
    await expect(page.getByText("今日の集中時間")).toBeVisible();
    await expect(page.locator("main").getByText("25分").first()).toBeVisible();
    await page.getByRole("link", { name: "パスポート" }).click();
    await expect(page.getByTestId("total-points")).toHaveText("35");
    await page.getByRole("link", { name: "ログ" }).click();
    await expect(page.getByRole("button", { name: /NKMからHND、自由学習、定刻着陸/ })).toHaveCount(1);
  });

  test("タブを閉じている間に予定時刻を過ぎたら、次回起動時に1回だけ着陸を確定", async ({ page }) => {
    await page.clock.install({ time: T0 });
    await skipOnboarding(page);
    await startFlight(page);
    await page.goto("/log/");
    await page.clock.fastForward("02:00:00");
    await page.reload();
    await expect(page.getByText(/予定時刻に着陸しました/)).toBeVisible();
    await expect(page.getByRole("button", { name: /定刻着陸/ })).toHaveCount(1);
  });

  test("早期着陸（5分未満）は欠航扱いで確認ダイアログが出る", async ({ page }) => {
    await page.clock.install({ time: T0 });
    await skipOnboarding(page);
    await startFlight(page);
    await page.clock.fastForward("03:00");
    await page.getByRole("button", { name: "早期着陸" }).click();
    await expect(page.getByRole("dialog")).toContainText("欠航扱い");
    await page.getByRole("button", { name: "欠航にする" }).click();
    await page.waitForURL((u) => u.pathname === "/");
    await expect(page.getByTestId("today-total")).toHaveText("0分");
  });

  test("2タブで同じフライトを開いても完了・ポイントは1回だけ", async ({ page, context }) => {
    await context.clock.install({ time: T0 });
    await skipOnboarding(page);
    const id = await startFlight(page);
    const second = await context.newPage();
    await second.goto(`/flight/?id=${id}`);
    await expect(second.getByTestId("flight-screen")).toBeVisible();
    await context.clock.fastForward("26:00");
    await page.waitForURL("**/arrival/**");
    await second.waitForURL("**/arrival/**");
    await page.goto("/passport/");
    await expect(page.getByTestId("total-points")).toHaveText("35");
    await page.goto("/log/");
    await expect(page.getByRole("button", { name: /定刻着陸/ })).toHaveCount(1);
  });
});

test("WebGL が使えなくても 2D 航路図でタイマーと記録が動く", async ({ page }) => {
  await page.addInitScript(() => {
    // テスト用に WebGL コンテキストの取得を失敗させる
    const proto = HTMLCanvasElement.prototype as unknown as { getContext: (type: string, ...rest: unknown[]) => unknown };
    const orig = proto.getContext;
    proto.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      return type.startsWith("webgl") ? null : orig.call(this, type, ...rest);
    };
  });
  await page.clock.install({ time: T0 });
  await skipOnboarding(page);
  await startFlight(page, "NRT", "LAX");
  await expect(page.locator("[data-map-mode]")).toHaveAttribute("data-map-mode", "2d");
  await expect(page.getByRole("img", { name: /NRTからLAXへの航路図/ })).toBeVisible();
  await page.clock.fastForward("25:30");
  await page.waitForURL("**/arrival/**");
  await expect(page.getByTestId("arrival-focus")).toHaveText("25分");
});

test("iPhone 幅でボトムナビの各操作が 44px 以上", async ({ page }) => {
  await skipOnboarding(page);
  const links = page.getByRole("navigation", { name: "メインナビゲーション" }).getByRole("link");
  await expect(links).toHaveCount(5);
  for (const l of await links.all()) {
    const box = await l.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
  }
  await page.goto("/boarding/");
  const seatBox = await page.locator('button[aria-label^="座席 "]').first().boundingBox();
  expect(seatBox!.height).toBeGreaterThanOrEqual(44);
  // 横スクロールが発生しない
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("オフラインでもアプリシェルを開いてフライトを開始・記録できる", async ({ page, context }) => {
  await skipOnboarding(page);
  // Service Worker のインストールとプリキャッシュ完了を待つ
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return reg.active?.state;
  });
  await page.waitForFunction(async () => (await caches.keys()).some((k) => k.startsWith("studyflight-")));
  await page.waitForFunction(async () => {
    const key = (await caches.keys()).find((k) => k.startsWith("studyflight-"))!;
    const cache = await caches.open(key);
    return !!(await cache.match("/data/airports.json")) && !!(await cache.match("/boarding/"));
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText("オフライン")).toBeVisible();
  const id = await startFlight(page, "HND", "CTS");
  expect(id).toBeTruthy();
  await page.getByRole("button", { name: "一時停止" }).click();
  await expect(page.getByTestId("flight-screen")).toHaveAttribute("data-status", "paused");
  await context.setOffline(false);
});

test("旅がつながる: 着陸した空港が次の出発地になり、時間に応じた候補から選べる", async ({ page }) => {
  await page.clock.install({ time: T0 });
  await skipOnboarding(page);

  // 1便目: 中部 → 羽田（推定60分 / 学習60分）
  await startFlight(page, "NGO", "HND", 60);
  await page.clock.fastForward("01:00:30");
  await page.waitForURL("**/arrival/**");
  await expect(page.getByTestId("arrival-title")).toContainText("到着");
  await page.getByRole("button", { name: "保存して閉じる" }).click();
  await page.waitForURL((u) => u.pathname === "/");
  await expect(page.getByRole("region", { name: "現在地と旅の軌跡" })).toContainText("HND");

  // 2便目: 出発地を指定しない → 現在地の羽田から。100分の「時間に合う便」に新千歳（推定105分）がある
  await page.goto("/boarding/");
  await chooseSeat(page);
  await expect(page.getByText("現在地").locator("..")).toContainText("HND");
  await setMinutes(page, 100);
  await expect(page.getByRole("radiogroup", { name: "行き先の候補" }).first().getByRole("radio", { name: /^CTS/ })).toBeAttached();
  await startFlight(page, null, "CTS", 100);
  // 学習時間（100分）が予定飛行時間（105分）より短いので、今回は手前で上空待機
  await expect(page.getByTestId("partial-note")).toBeVisible();
  await page.clock.fastForward("01:40:30");
  await page.waitForURL("**/arrival/**");
  await expect(page.getByTestId("arrival-title")).toContainText("上空で一時停止");
  await page.getByRole("button", { name: "保存して閉じる" }).click();
  await page.waitForURL((u) => u.pathname === "/");
  await expect(page.getByTestId("journey-air")).toContainText("HND → CTS");

  // 続き（残り5分）で到着
  await resumeFlight(page, 30);
  await page.clock.fastForward("05:30");
  await page.waitForURL("**/arrival/**");
  await expect(page.getByTestId("arrival-title")).toContainText("到着");
  await page.getByRole("button", { name: "保存して閉じる" }).click();
  await page.waitForURL((u) => u.pathname === "/");
  await expect(page.getByRole("list", { name: "これまでの旅" })).toHaveText(/NGO\s*→\s*HND\s*→\s*CTS/);
});

test("長い便は途中で学習を終えても、次回は同じ地点から再開できる", async ({ page }) => {
  await page.clock.install({ time: T0 });
  await skipOnboarding(page);
  // 羽田 → 那覇（推定160分）を60分ずつ
  await startFlight(page, "HND", "OKA", 60);
  await page.clock.fastForward("30:00");
  await page.getByRole("button", { name: "早期着陸" }).click();
  await expect(page.getByRole("dialog")).toContainText("この地点から OKA へ飛行を再開");
  await page.getByRole("button", { name: "今回の学習を終える" }).click();
  await page.waitForURL("**/arrival/**");
  await expect(page.getByTestId("arrival-title")).toContainText("上空で一時停止");
  await expect(page.getByTestId("arrival-focus")).toHaveText("30分");
  await page.getByRole("button", { name: "保存して閉じる" }).click();
  await page.waitForURL((u) => u.pathname === "/");
  // 学習した30分ぶんだけ進んでいる（30/160 ≒ 19%）
  await expect(page.getByTestId("journey-air")).toContainText("HND → OKA");
  await expect(page.getByRole("region", { name: "現在地と旅の軌跡" })).toContainText("19%");

  // リロードしても上空の状態が復元され、続きから飛べる
  await page.reload();
  await page.goto("/boarding/");
  await chooseSeat(page);
  await expect(page.getByText("上空で一時停止中")).toBeVisible();
  await expect(page.getByText(/HND → OKA · 19%/)).toBeVisible();
  await setMinutes(page, 150);
  await page.getByRole("button", { name: "続きの搭乗券を発行" }).click();
  await page.getByRole("button", { name: "チェックイン" }).click();
  await page.getByRole("button", { name: "搭乗する" }).click();
  await page.getByRole("button", { name: "出発する" }).click();
  await page.waitForURL("**/flight/?id=*");
  // 残り130分だけを飛ぶ
  await expect(page.getByTestId("remaining")).toHaveText(/^2:(09|10):\d\d$/);
  await page.clock.fastForward("02:10:30");
  await page.waitForURL("**/arrival/**");
  await expect(page.getByTestId("arrival-title")).toContainText("到着");
  await page.getByRole("button", { name: "保存して閉じる" }).click();
  await page.waitForURL((u) => u.pathname === "/");
  await expect(page.getByRole("region", { name: "現在地と旅の軌跡" })).toContainText("OKA");
});

test("ログの記録をその場で削除できる（確認は同じシート内）", async ({ page }) => {
  await page.clock.install({ time: T0 });
  await skipOnboarding(page);
  await startFlight(page, "NGO", "HND", 30);
  await page.clock.fastForward("30:30");
  await page.waitForURL("**/arrival/**");
  await page.getByRole("button", { name: "保存して閉じる" }).click();
  await page.waitForURL((u) => u.pathname === "/");
  await page.getByRole("link", { name: "ログ" }).click();
  await page.getByRole("button", { name: /NGOからHND/ }).click();
  await page.getByRole("button", { name: "記録を削除" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toBeVisible();
  await expect(confirm).toContainText("この記録を削除しますか？");
  await confirm.getByRole("button", { name: "削除する" }).click();
  await expect(page.getByText("記録を削除しました")).toBeVisible();
  await expect(page.getByRole("button", { name: /NGOからHND/ })).toHaveCount(0);
});
