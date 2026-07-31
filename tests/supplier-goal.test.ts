import { describe, expect, it } from "vitest";
import {
  APPROVED_SUPPLIER_STAGE_SET,
  CLOSED_SUPPLIER_STAGE_SET,
  REJECTED_SUPPLIER_STAGE_SET,
  SUPPLIER_CLOSE_GOAL,
  supplierCloseGoalProgress,
} from "@/lib/domain";

describe("supplier close goal", () => {
  it("starts at the seven approved suppliers already on file", () => {
    expect(SUPPLIER_CLOSE_GOAL.baselineAuthorized).toBe(7);
    expect(SUPPLIER_CLOSE_GOAL.additionalTarget).toBe(20);
    expect(SUPPLIER_CLOSE_GOAL.targetAuthorized).toBe(27);
    expect(supplierCloseGoalProgress(7)).toEqual({
      completed: 0,
      remaining: 20,
      percent: 0,
      reached: false,
    });
  });

  it("counts only approvals gained after the baseline", () => {
    expect(supplierCloseGoalProgress(12)).toEqual({
      completed: 5,
      remaining: 15,
      percent: 25,
      reached: false,
    });
  });

  it("caps visual progress after the goal is reached", () => {
    expect(supplierCloseGoalProgress(30)).toEqual({
      completed: 20,
      remaining: 0,
      percent: 100,
      reached: true,
    });
  });
});

describe("supplier outcome books", () => {
  it("keeps approved and rejected stages separate", () => {
    expect(APPROVED_SUPPLIER_STAGE_SET.has("AUTHORIZED")).toBe(true);
    expect(APPROVED_SUPPLIER_STAGE_SET.has("DECLINED")).toBe(false);
    expect(REJECTED_SUPPLIER_STAGE_SET.has("DECLINED")).toBe(true);
    expect(REJECTED_SUPPLIER_STAGE_SET.has("AUTHORIZED")).toBe(false);
    expect(CLOSED_SUPPLIER_STAGE_SET.has("AUTHORIZED")).toBe(true);
    expect(CLOSED_SUPPLIER_STAGE_SET.has("DECLINED")).toBe(true);
  });
});
