// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BoardingPass, flightNumber } from "../flight/BoardingPass";
import { DurationPicker } from "../flight/DurationPicker";
import { SubjectBreakdown } from "../analytics/SubjectBreakdown";

afterEach(cleanup);

describe("DurationPicker", () => {
  it("プリセット選択で分数を通知", () => {
    const onChange = vi.fn();
    render(<DurationPicker value={25} onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "60分" }));
    expect(onChange).toHaveBeenCalledWith(60);
  });

  it("範囲外のカスタム入力はエラー表示し null を通知", () => {
    const onChange = vi.fn();
    render(<DurationPicker value={25} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("カスタム時間（分）"), { target: { value: "300" } });
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole("alert")).toHaveTextContent("240分以下");
    fireEvent.change(screen.getByLabelText("カスタム時間（分）"), { target: { value: "50" } });
    expect(onChange).toHaveBeenLastCalledWith(50);
  });
});

describe("BoardingPass", () => {
  it("入力内容と便名を表示し、スクリーンリーダー向けの要約を持つ", () => {
    render(
      <BoardingPass
        data={{
          passenger: "Taigo",
          flightNo: flightNumber("abc"),
          subjectName: "生理学",
          subjectColor: "#3987e5",
          origin: { name: "Nagoya", code: "NKM" },
          destination: { name: "Haneda", code: "HND" },
          minutes: 45,
          seat: "12A",
        }}
      />,
    );
    expect(screen.getByRole("article")).toHaveAccessibleName(/NKMからHND、生理学、45分/);
    expect(flightNumber("abc")).toBe(flightNumber("abc"));
    expect(flightNumber("abc")).toMatch(/^SF \d{4}$/);
  });
});

describe("SubjectBreakdown", () => {
  it("数値と割合をテキストでも表示", () => {
    render(
      <SubjectBreakdown
        slices={[
          { id: "a", name: "生理学", color: "#3987e5", seconds: 3600 },
          { id: "b", name: "生化学", color: "#d95926", seconds: 1800 },
        ]}
      />,
    );
    expect(screen.getByText("生理学")).toBeInTheDocument();
    expect(screen.getByText(/67%/)).toBeInTheDocument();
    expect(screen.getByText(/33%/)).toBeInTheDocument();
  });
});
