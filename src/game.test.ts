import { describe, expect, it } from "vitest";
import { getClusterHits, parseMech, resolveAttack, type Weapon } from "./game";
import annihilatorExport from "../mechs/Annihilator ANH-1A.txt?raw";
import gladiatorExport from "../mechs/Gladiator GLD-3RX.txt?raw";

describe("mech equipment parsing", () => {
  it("reads every weapon from the supplied 'Mech exports", () => {
    const annihilator = parseMech("annihilator", annihilatorExport);
    const gladiator = parseMech("gladiator", gladiatorExport);

    expect(annihilator.weapons).toHaveLength(8);
    expect(gladiator.weapons).toHaveLength(13);
    expect(gladiator.weapons.filter((weapon) => weapon.name.startsWith("LRM 5"))).toHaveLength(4);
    expect(gladiator.weapons.every((weapon) => weapon.profile !== null)).toBe(true);
  });

  it("expands weapon quantities, recognizes supported equipment, and ignores non-weapons", () => {
    const mech = parseMech("test", `Test Mech
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
  });

  it("preserves unsupported weapons so the user can see and deselect them", () => {
    const mech = parseMech("test", `Test
Weapons
and Ammo              Location  Critical   Heat    Tonnage
Mystery Cannon         RA        5          4       5.0
`);
    expect(mech.weapons).toHaveLength(1);
    expect(mech.weapons[0].profile).toBeNull();
  });
});

describe("attack resolution", () => {
  it("uses the supplied cluster-hit table for an LRM 5 rack", () => {
    expect([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((roll) => getClusterHits(5, roll)))
      .toEqual([1, 2, 2, 3, 3, 3, 3, 4, 4, 5, 5]);
  });

  it("groups LRM damage by five and marks floating criticals", () => {
    const weapon: Weapon = {
      id: "lrm", name: "LRM 5", location: "RT",
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
    const weapon: Weapon = { id: "laser", name: "Medium Laser", location: "RA", profile: { kind: "direct", damage: 5 } };
    const rolls = [1, 1];
    const result = resolveAttack(weapon, 4, "Front", () => rolls.shift() ?? 1);
    expect(result.hit).toBe(false);
    expect(result.damageLocations).toEqual([]);
    expect(rolls).toEqual([]);
  });
});
