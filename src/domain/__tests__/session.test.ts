import { describe, expect, it } from "vitest";
import {
  abandonSession,
  completeOnTime,
  earlyLandingOutcome,
  elapsedSeconds,
  hasClockAnomaly,
  isDue,
  landEarly,
  pauseSession,
  remainingSeconds,
  resumeSession,
  scheduledEndMs,
  startSession,
  TransitionError,
  validatePlannedMinutes,
} from "../session";
import { makeSession, min, T0 } from "./fixtures";

const started = () => startSession(makeSession(), T0, "seg1").session;

describe("タイマー計算", () => {
  it("boarding は経過0", () => {
    expect(elapsedSeconds(makeSession(), T0 + min(10))).toBe(0);
  });

  it("active は保存時刻から再計算される（リロード後も10分相当に戻る）", () => {
    const s = started();
    expect(elapsedSeconds(s, T0 + min(10))).toBe(600);
    expect(remainingSeconds(s, T0 + min(10))).toBe(900);
  });

  it("計画時間で上限", () => {
    expect(elapsedSeconds(started(), T0 + min(60))).toBe(1500);
    expect(isDue(started(), T0 + min(25))).toBe(true);
    expect(isDue(started(), T0 + min(24))).toBe(false);
  });

  it("一時停止中は放置しても増えない", () => {
    const paused = pauseSession(started(), T0 + min(5)).session;
    expect(paused.status).toBe("paused");
    expect(elapsedSeconds(paused, T0 + min(5))).toBe(300);
    expect(elapsedSeconds(paused, T0 + min(15))).toBe(300);
  });

  it("再開後は停止前の累積 + 新区間", () => {
    const paused = pauseSession(started(), T0 + min(5)).session;
    const resumed = resumeSession(paused, T0 + min(15), "seg2").session;
    expect(elapsedSeconds(resumed, T0 + min(20))).toBe(600);
    expect(scheduledEndMs(resumed)).toBe(T0 + min(15) + 1200_000);
  });

  it("端末時刻が戻っても負にならない", () => {
    const s = started();
    expect(elapsedSeconds(s, T0 - min(3))).toBe(0);
    expect(hasClockAnomaly(s, T0 - min(3))).toBe(true);
    const p = pauseSession(s, T0 - min(3));
    expect(p.session.accumulatedFocusSeconds).toBe(0);
    expect(p.session.clockAnomaly).toBe(true);
  });
});

describe("状態遷移", () => {
  it("start は区間を開く", () => {
    const r = startSession(makeSession(), T0, "seg1");
    expect(r.session.status).toBe("active");
    expect(r.segments.open?.id).toBe("seg1");
    expect(r.segments.open?.endedAt).toBeNull();
  });

  it("pause は区間を閉じる", () => {
    const r = pauseSession(started(), T0 + min(7));
    expect(r.segments.close?.durationSeconds).toBe(420);
  });

  it("不正な遷移は例外", () => {
    expect(() => pauseSession(makeSession(), T0)).toThrow(TransitionError);
    expect(() => resumeSession(started(), T0, "x")).not.toThrow(); // active→resume は noop
    expect(resumeSession(started(), T0, "x").noop).toBe(true);
    expect(() => completeOnTime(started(), T0 + min(10))).toThrow(TransitionError);
  });

  it("時間達成で on_time 完了。着陸時刻は終了予定時刻", () => {
    const r = completeOnTime(started(), T0 + min(90));
    expect(r.session.status).toBe("completed");
    expect(r.session.completionType).toBe("on_time");
    expect(r.session.actualFocusSeconds).toBe(1500);
    expect(r.session.completedAt).toBe(new Date(T0 + min(25)).toISOString());
    expect(r.segments.close?.endedAt).toBe(new Date(T0 + min(25)).toISOString());
    expect(r.session.earnedSkyPoints).toBe(25 + 10);
  });

  it("多重完了してもポイントは一度だけ（2回目は noop）", () => {
    const first = completeOnTime(started(), T0 + min(25)).session;
    const second = completeOnTime(first, T0 + min(26));
    expect(second.noop).toBe(true);
    expect(second.session).toBe(first);
    expect(landEarly(first, T0 + min(30)).noop).toBe(true);
    expect(abandonSession(first, T0 + min(30)).noop).toBe(true);
  });

  it("paused 状態でも予定に到達していれば on_time で完了できる", () => {
    const s = pauseSession(started(), T0 + min(25)).session;
    const r = completeOnTime(s, T0 + min(40));
    expect(r.session.completionType).toBe("on_time");
    expect(r.session.actualFocusSeconds).toBe(1500);
  });

  it("早期着陸: 5分以上は early 完了", () => {
    const s = started();
    expect(earlyLandingOutcome(s, T0 + min(12))).toBe("early");
    const r = landEarly(s, T0 + min(12));
    expect(r.session.status).toBe("completed");
    expect(r.session.completionType).toBe("early");
    expect(r.session.actualFocusSeconds).toBe(720);
    expect(r.session.earnedSkyPoints).toBe(12); // 80%未満なのでボーナスなし
  });

  it("早期着陸: 5分未満は放棄扱い・ポイント0", () => {
    const r = landEarly(started(), T0 + min(4));
    expect(r.session.status).toBe("abandoned");
    expect(r.session.earnedSkyPoints).toBe(0);
    expect(r.session.abandonmentReason).toBe("early_landing_below_minimum");
  });

  it("早期着陸の閾値は設定可能", () => {
    expect(landEarly(started(), T0 + min(4), 120).session.status).toBe("completed");
  });

  it("一時停止中の早期着陸は累積時間で判定", () => {
    const paused = pauseSession(started(), T0 + min(6)).session;
    const r = landEarly(paused, T0 + min(60));
    expect(r.session.actualFocusSeconds).toBe(360);
    expect(r.segments.close).toBeUndefined();
  });

  it("放棄はポイント0", () => {
    const r = abandonSession(started(), T0 + min(20));
    expect(r.session.status).toBe("abandoned");
    expect(r.session.earnedSkyPoints).toBe(0);
    expect(r.segments.close?.durationSeconds).toBe(1200);
  });

  it("boarding の放棄は区間なし", () => {
    const r = abandonSession(makeSession(), T0);
    expect(r.session.status).toBe("abandoned");
    expect(r.segments).toEqual({});
  });
});

describe("時間バリデーション", () => {
  it("5–240分の整数", () => {
    expect(validatePlannedMinutes(25)).toBeNull();
    expect(validatePlannedMinutes(4)).not.toBeNull();
    expect(validatePlannedMinutes(241)).not.toBeNull();
    expect(validatePlannedMinutes(12.5)).not.toBeNull();
    expect(validatePlannedMinutes(NaN)).not.toBeNull();
  });
});
