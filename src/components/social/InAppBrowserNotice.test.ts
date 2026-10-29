import { describe, expect, it } from "vitest";
import { inAppBrowserName } from "./InAppBrowserNotice";

describe("inAppBrowserName", () => {
  it("LINE などアプリ内ブラウザを見分ける", () => {
    expect(inAppBrowserName("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.10.0")).toBe("LINE");
    expect(inAppBrowserName("Mozilla/5.0 (iPhone) Instagram 300.0")).toBe("Instagram");
  });
  it("Safari やホーム画面のアプリは対象外", () => {
    expect(inAppBrowserName("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1")).toBeNull();
    expect(inAppBrowserName("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148")).toBeNull();
  });
});
