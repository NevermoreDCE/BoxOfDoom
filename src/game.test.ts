import { describe, expect, it } from "vitest";
import { getClusterHits, getWeaponRange, parseMech, resolveAttack, type Weapon } from "./game";
import annihilatorExport from "../mechs/Annihilator ANH-1A.txt?raw";
import gladiatorExport from "../mechs/Gladiator GLD-3RX.txt?raw";

describe("mech equipment parsing", () => {
  it("reads every weapon from the supplied 'Mech exports", () => {
    const annihilator = parseMech("annihilator", annihilatorExport);
    const gladiator = parseMech("gladiator", gladiatorExport);

    expect(annihilator.heatSinkCapacity).toBe(18);
    expect(gladiator.heatSinkCapacity).toBe(26);
    expect(annihilator.weapons).toHaveLength(8);
    expect(gladiator.weapons).toHaveLength(13);
    expect(gladiator.weapons.filter((weapon) => weapon.name.startsWith("LRM 5"))).toHaveLength(4);
    expect(gladiator.weapons.filter((weapon) => weapon.name.startsWith("LRM 5")).every((weapon) => weapon.heat === 2)).toBe(true);
    expect(gladiator.weapons.every((weapon) => weapon.profile !== null)).toBe(true);
    expect(annihilator.weapons.every((weapon) => weapon.ranges !== null)).toBe(true);
    expect(gladiator.weapons.every((weapon) => weapon.ranges !== null)).toBe(true);
    expect(gladiator.weapons.find((weapon) => weapon.name.startsWith("LRM 5"))?.ranges)
      .toEqual({ minimum: 6, short: 7, medium: 14, long: 21 });
  });

  it("expands weapon quantities, recognizes supported equipment, and ignores non-weapons", () => {
    const mech = parseMech("test", `Test Mech
Heat Sink 10
Weapons
and Ammo              Location  Critical   Heat    Tonnage
2 Medium Laser         CT        2          3       2.0
AC/10                  RT        7          3       12.0
LRM 5 Ammo (24)        LT        1          -       1.0
TAG                    HD        1          0       1.0
`);

    expect(mech.weapons.map((weapon) => weapon.name)).toEqual([
      "Medium Laser #1", "Medium Laser #2", "AC/10", "TAG"
    ]);
    expect(mech.weapons[0].profile).toEqual({ kind: "direct", damage: 5 });
    expect(mech.weapons[2].profile).toEqual({ kind: "direct", damage: 10 });
    expect(mech.weapons[3].profile).toEqual({ kind: "utility" });
    expect(mech.weapons.map((weapon) => weapon.heat)).toEqual([3, 3, 3, 0]);
    expect(mech.heatSinkCapacity).toBe(10);
  });

  it("preserves unsupported weapons so the user can see and deselect them", () => {
    const mech = parseMech("test", `Test
Double Heat Sink 10 [18]
Weapons
and Ammo              Location  Critical   Heat    Tonnage
Mystery Cannon         RA        5          4       5.0
`);
    expect(mech.weapons).toHaveLength(1);
    expect(mech.weapons[0].profile).toBeNull();
    expect(mech.heatSinkCapacity).toBe(18);
  });
});

describe("attack resolution", () => {
  it("uses the supplied cluster-hit table for an LRM 5 rack", () => {
    expect([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((roll) => getClusterHits(5, roll)))
      .toEqual([1, 2, 2, 3, 3, 3, 3, 4, 4, 5, 5]);
  });

  it("groups LRM damage by five and marks floating criticals", () => {
    const weapon: Weapon = {
      id: "lrm", name: "LRM 5", location: "RT", heat: 2, ranges: { minimum: 6, short: 7, medium: 14, long: 21 },
      profile: { kind: "cluster", rackSize: 5, damagePerProjectile: 1, missilesPerLocation: 5 }
    };
    const rolls = [6, 6, 1, 1, 1, 1, 4, 4];
    const result = resolveAttack(weapon, 8, "Front", () => rolls.shift() ?? 1);
    expect(result.hit).toBe(true);
    expect(result.projectilesHit).toBe(1);
    expect(result.damageLocations).toEqual([
      { damage: 1, location: "Left Torso", critical: true, locationRoll: 2, reroll: 8 }
    ]);
  });

  it("reports a missed shot without rolling cluster or hit locations", () => {
    const weapon: Weapon = { id: "laser", name: "Medium Laser", location: "RA", heat: 3, ranges: { minimum: 0, short: 3, medium: 6, long: 9 }, profile: { kind: "direct", damage: 5 } };
    const rolls = [1, 1];
    const result = resolveAttack(weapon, 4, "Front", () => rolls.shift() ?? 1);
    expect(result.hit).toBe(false);
    expect(result.damageLocations).toEqual([]);
    expect(rolls).toEqual([]);
  });

  describe("weapon ranges", () => {
    const lrm = { minimum: 6, short: 7, medium: 14, long: 21 };

    it("uses each inclusive range boundary and rejects targets beyond long range", () => {
      expect([6, 7, 8, 14, 15, 21, 22].map((distance) => getWeaponRange(lrm, distance))).toEqual([
        { band: "Short", modifier: 0 }, { band: "Short", modifier: 0 },
        { band: "Medium", modifier: 2 }, { band: "Medium", modifier: 2 },
        { band: "Long", modifier: 4 }, { band: "Long", modifier: 4 },
        { band: "Out of range", modifier: null }
      ]);
    });

    it("applies the requested minimum-range penalty", () => {
      expect(getWeaponRange(lrm, 3)).toEqual({ band: "Short", modifier: 3 });
      expect(getWeaponRange(lrm, 0)).toEqual({ band: "Short", modifier: 6 });
      expect(getWeaponRange(lrm, 6)).toEqual({ band: "Short", modifier: 0 });
    });

    it("rejects invalid distances", () => {
      for (const distance of [-1, 26, 1.5, NaN]) {
        expect(() => getWeaponRange(lrm, distance)).toThrow();
      }
    });

    it("uses each weapon's own range modifier to resolve its target number", () => {
      const mech = parseMech("gladiator", gladiatorExport);
      const missile = mech.weapons.find((weapon) => weapon.name.startsWith("LRM 5"));
      const laser = mech.weapons.find((weapon) => weapon.name.startsWith("Medium Laser"));
      expect(missile?.ranges).toBeTruthy();
      expect(laser?.ranges).toBeTruthy();
      if (!missile?.ranges || !laser?.ranges) throw new Error("Missing test weapon ranges");
      const missileModifier = getWeaponRange(missile.ranges, 6).modifier;
      const laserModifier = getWeaponRange(laser.ranges, 6).modifier;
      if (missileModifier === null || laserModifier === null) throw new Error("Weapons should be in range");
      expect(resolveAttack(missile, 8 + missileModifier, "Front", () => 1).targetNumber).toBe(8);
      expect(resolveAttack(laser, 8 + laserModifier, "Front", () => 1).targetNumber).toBe(10);
    });
  });
});
