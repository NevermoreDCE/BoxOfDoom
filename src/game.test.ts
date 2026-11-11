import { describe, expect, it } from "vitest";
import { getClusterHits, getWeaponRange, parseMech, parseMechs, parseMtf, resolveAttack, summarizeDamageByLocation, type Weapon } from "./game";
import annihilatorExport from "../mechs/Annihilator ANH-1A.txt?raw";

const gladiatorExport = `Gladiator GLD-3RX
Double Heat Sink 13 [26]
Weapons
and Ammo              Location  Critical   Heat    Tonnage
4 LRM 5                  RT        4        2       8.0
4 Medium Laser           LA        4        3       4.0
4 Medium Laser           RA        4        3       4.0
TAG                      HD        1        0       1.0
`;

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

  it("excludes jump jets from the ANH-2L equipment table while keeping its weapons", () => {
    const mech = parseMech("anh-2l", `Annihilator ANH-2L
Double Heat Sink 13 [26]
Weapons
and Ammo              Location  Critical   Heat    Tonnage
LRM 5 Ammo (24)          LL        1        -       1.0
Jump Jet                 LL        1        -       2.0
2 LRM 5                  CT        2        2       4.0
7 LRM 5                  LA        7        2       14.0
Jump Jet                 RL        1        -       2.0
LRM 5                    HD        1        2       2.0
9 LRM 5                  RA        9        2       18.0
Mystery Cannon           RT        5        4       5.0
`);
    expect(mech.weapons).toHaveLength(20);
    expect(mech.weapons.filter((weapon) => weapon.name.startsWith("LRM 5"))).toHaveLength(19);
    expect(mech.weapons.at(-1)).toMatchObject({ name: "Mystery Cannon", profile: null });
  });

  it("reads modern MTF weapon mounts, heat sinks, and supported weapon definitions", () => {
    const mtf = `# Comment before the fields
generator:MegaMek Suite
chassis:Gladiator
model:GLD-3RX
techbase:Inner Sphere
heat sinks:13 IS Double
Weapons:13
${Array(6).fill("Medium Laser, Left Torso").join("\n")}
${Array(2).fill("Medium Laser, Right Torso").join("\n")}
${Array(4).fill("LRM 5, Right Torso").join("\n")}
TAG, Head

Left Torso:
Medium Laser
Medium Laser
`;
    const mech = parseMtf("gladiator.mtf", mtf);
    expect(mech.name).toBe("Gladiator GLD-3RX");
    expect(mech.heatSinkCapacity).toBe(26);
    expect(mech.weapons).toHaveLength(13);
    expect(new Set(mech.weapons.map((weapon) => weapon.id)).size).toBe(13);
    expect(mech.weapons.filter((weapon) => weapon.name === "Medium Laser" && weapon.location === "LT")).toHaveLength(6);
    expect(mech.weapons.filter((weapon) => weapon.name === "LRM 5" && weapon.location === "RT")).toHaveLength(4);
    expect(mech.weapons[0]).toMatchObject({ heat: 3, profile: { kind: "direct", damage: 5 }, ranges: { minimum: 0, short: 3, medium: 6, long: 9 } });
    expect(mech.weapons[8]).toMatchObject({ heat: 2, profile: { kind: "cluster", rackSize: 5 }, ranges: { minimum: 6, short: 7, medium: 14, long: 21 } });
    expect(mech.weapons[12]).toMatchObject({ heat: 0, location: "HD", profile: { kind: "utility" } });
  });

  it("handles legacy MTF headers, quantities, rear mounts, and unknown weapons", () => {
    const mech = parseMtf("legacy.mtf", `Version:1.1
Test
T-1
TechBase:Inner Sphere
Heat Sinks:10 Single
Weapons:2
2 Medium Laser (R), Left Torso (R)
1 Mystery Cannon, Right Arm, Ammo:10
`);
    expect(mech.name).toBe("Test T-1");
    expect(mech.heatSinkCapacity).toBe(10);
    expect(mech.weapons).toHaveLength(3);
    expect(mech.weapons.slice(0, 2).map((weapon) => [weapon.name, weapon.location, weapon.heat]))
      .toEqual([["Medium Laser #1", "LT (R)", 3], ["Medium Laser #2", "LT (R)", 3]]);
    expect(mech.weapons[2]).toMatchObject({ name: "Mystery Cannon", heat: null, profile: null, ranges: null });
  });

  it("does not apply Inner Sphere definitions to Clan or unspecified technology", () => {
    for (const techBase of ["techbase:Clan", ""]) {
      const mech = parseMtf("clan.mtf", `chassis:Test
model:C
${techBase}
heat sinks:10 Clan Double
Weapons:1
LRM 5, Right Torso
`);
      expect(mech.weapons[0]).toMatchObject({ heat: null, profile: null, ranges: null });
    }
  });

  it("rejects incomplete or malformed MTF data instead of silently omitting weapons", () => {
    const valid = `chassis:Test
model:T
techbase:Inner Sphere
heat sinks:10 Single
Weapons:1
PPC, Right Arm
`;
    expect(() => parseMtf("bad.mtf", valid.replace("10 Single", "10 Laser"))).toThrow(/heat-sink/);
    expect(() => parseMtf("bad.mtf", valid.replace("Weapons:1", "Weapons:2"))).toThrow(/weapon entry 2/);
    expect(() => parseMtf("bad.mtf", valid.replace("PPC, Right Arm", "0 PPC, Right Arm"))).toThrow(/quantity/);
    expect(() => parseMtf("bad.mtf", valid.replace("model:T", ""))).toThrow(/chassis and model/);
  });

  it("loads and sorts both formats in one collection", () => {
    const mechs = parseMechs({
      "mechs/z.txt": annihilatorExport,
      "mechs/Custom/a.mtf": `chassis:Atlas
model:AS7
techbase:Inner Sphere
heat sinks:10 Single
Weapons:0
`
    });
    expect(mechs.map((mech) => mech.name)).toEqual(["Annihilator ANH-1A", "Atlas AS7"]);
  });
});

describe("attack resolution", () => {
  it("sums direct, cluster, and floating critical damage in hit-chart order for each facing", () => {
    const laser: Weapon = { id: "laser", name: "Medium Laser", location: "RA", heat: 3, ranges: null, profile: { kind: "direct", damage: 5 } };
    const lrm: Weapon = { id: "lrm", name: "LRM 5", location: "RT", heat: 2, ranges: null, profile: { kind: "cluster", rackSize: 5, damagePerProjectile: 1, missilesPerLocation: 5 } };
    const dice = [6, 6, 1, 1, 1, 2, 6, 6, 6, 6, 1, 2];
    const roll = () => {
      const die = dice.shift();
      if (die === undefined) throw new Error("Unexpected die roll");
      return die;
    };
    const attacks = [resolveAttack(laser, 8, "Front", roll), resolveAttack(lrm, 8, "Front", roll)];
    expect(summarizeDamageByLocation(attacks, "Front")).toEqual([
      { location: "Right Arm", damage: 10 },
      { location: "Right Leg", damage: 0 },
      { location: "Right Torso", damage: 0 },
      { location: "Center Torso", damage: 0 },
      { location: "Left Torso", damage: 0 },
      { location: "Left Leg", damage: 0 },
      { location: "Left Arm", damage: 0 },
      { location: "Head", damage: 0 }
    ]);
    expect(summarizeDamageByLocation(attacks, "Rear").map((row) => row.location))
      .toEqual(summarizeDamageByLocation(attacks, "Front").map((row) => row.location));
    expect(summarizeDamageByLocation(attacks, "Left").map((row) => row.location))
      .toEqual(["Left Leg", "Left Arm", "Left Torso", "Center Torso", "Right Torso", "Right Arm", "Right Leg", "Head"]);
    expect(summarizeDamageByLocation(attacks, "Right").map((row) => row.location))
      .toEqual(["Right Leg", "Right Arm", "Right Torso", "Center Torso", "Left Torso", "Left Arm", "Left Leg", "Head"]);
    expect(dice).toEqual([]);
  });

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
