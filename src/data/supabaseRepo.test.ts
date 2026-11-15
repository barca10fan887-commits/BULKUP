import { describe, expect, it } from "vitest";
import { fromRow, toRow } from "./supabaseRepo";

describe("row mapping", () => {
  it("converts top-level keys only and adds user_id", () => {
    const row = toRow({ id: "1", weightKg: 70, custom: { leftArm: 35 }, note: undefined }, "u1");
    expect(row).toEqual({ user_id: "u1", id: "1", weight_kg: 70, custom: { leftArm: 35 } });
  });
  it("maps back, dropping nulls and parsing numeric strings", () => {
    const rec = fromRow<{ weightKg: number; armCm?: number; custom: object }>({ user_id: "u1", weight_kg: "70.5", arm_cm: null, custom: { leftArm: 35 } });
    expect(rec).toEqual({ weightKg: 70.5, custom: { leftArm: 35 } });
  });
});
