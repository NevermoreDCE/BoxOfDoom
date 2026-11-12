import { describe, expect, it } from "vitest";
import {
  applyDamage,
  createDamageRecord,
  damageFill,
  getDamageTotals,
  internalStructureForTonnage,
  restoreDamage,
  validateDamageRecord,
  type DamageProfile
} from "./damage";

const profile: DamageProfile = {
  head: { armor: 9, internal: 3 },
  "center-torso": { armor: 45, rearArmor: 14, internal: 31 },
  "left-torso": { armor: 32, rearArmor: 10, internal: 21 },
  "right-torso": { armor: 32, rearArmor: 10, internal: 21 },
  "left-arm": { armor: 32, internal: 17 },
  "right-arm": { armor: 32, internal: 17 },
  "left-leg": { armor: 40, internal: 21 },
  "right-leg": { armor: 40, internal: 21 }
};

describe("damage records", () => {
  it("initializes current values from the profile and counts each surface once", () => {
    const record = createDamageRecord("atlas.mtf", profile);
    expect(record.locations["center-torso"]).toEqual({
      armor: { current: 45, maximum: 45 },
      rearArmor: { current: 14, maximum: 14 },
      internal: { current: 31, maximum: 31 }
    });
    expect(getDamageTotals(record)).toEqual({
      armor: { current: 296, maximum: 296 },
      internal: { current: 152, maximum: 152 }
    });
  });

  it("applies armor damage before same-location internals and reports overflow", () => {
    const record = createDamageRecord("atlas.mtf", profile);
    const result = applyDamage(record, "center-torso", 50);
    expect(result.record.locations["center-torso"].armor.current).toBe(0);
    expect(result.record.locations["center-torso"].internal.current).toBe(26);
    expect(result.unapplied).toBe(0);
    expect(record.locations["center-torso"].armor.current).toBe(45);

    const overkill = applyDamage(result.record, "center-torso", 100);
    expect(overkill.record.locations["center-torso"].internal.current).toBe(0);
    expect(overkill.unapplied).toBe(74);
    expect(overkill.record.locations["left-torso"].internal.current).toBe(21);
  });

  it("keeps front and rear torso armor separate while sharing torso internals", () => {
    const record = createDamageRecord("atlas.mtf", profile);
    const result = applyDamage(record, "left-torso", 12, "Rear");
    expect(result.record.locations["left-torso"].rearArmor?.current).toBe(0);
    expect(result.record.locations["left-torso"].internal.current).toBe(19);
    expect(result.record.locations["left-torso"].armor.current).toBe(32);
  });

  it("restores armor and internals without changing the saved maximums", () => {
    const damaged = applyDamage(createDamageRecord("atlas.mtf", profile), "head", 12).record;
    const restored = restoreDamage(damaged);
    expect(restored.locations.head).toEqual({
      armor: { current: 9, maximum: 9 },
      internal: { current: 3, maximum: 3 }
    });
  });

  it("validates saved values and rejects invalid damage inputs", () => {
    const record = createDamageRecord("atlas.mtf", profile);
    expect(() => validateDamageRecord({ ...record, locations: { ...record.locations, head: { ...record.locations.head, armor: { current: 10, maximum: 9 } } } }))
      .toThrow(/Invalid saved damage/);
    for (const amount of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1, NaN]) {
      expect(() => applyDamage(record, "head", amount)).toThrow(/non-negative whole number/);
    }
    expect(() => applyDamage(record, "head", 1, "Rear")).toThrow(/only available on torso/);
  });
});

describe("internal structure and damage fill", () => {
  it("derives each location from the documented tonnage table", () => {
    expect(internalStructureForTonnage(100)).toEqual({
      head: 3, "center-torso": 31, "left-torso": 21, "right-torso": 21,
      "left-arm": 17, "right-arm": 17, "left-leg": 21, "right-leg": 21
    });
    expect(internalStructureForTonnage(82)).toMatchObject({ "center-torso": 27, "left-arm": 14 });
    expect(() => internalStructureForTonnage(105)).toThrow(/Unsupported/);
  });

  it("maps full, critical, and destroyed health to the specified fills", () => {
    expect(damageFill(100)).toEqual({ color: "#26FF00", opacity: 1 });
    expect(damageFill(50)).toEqual({ color: "#FFFF00", opacity: 1 });
    expect(damageFill(5)).toEqual({ color: "#E02020", opacity: 1 });
    expect(damageFill(0)).toEqual({ color: "#101010", opacity: 1 });
    expect(damageFill(75).color).not.toBe("#26FF00");
    expect(damageFill(25).color).not.toBe("#E02020");
    expect(damageFill(2).color).not.toBe("#101010");
  });
});
