import rangeData from "../data/weapon-ranges.txt?raw";

export type Facing = "Front" | "Left" | "Right" | "Rear";

export type WeaponRanges = { minimum: number; short: number; medium: number; long: number };
export type RangeBand = "Short" | "Medium" | "Long" | "Out of range";
export type RangeResult = { band: RangeBand; modifier: number | null };

export type WeaponProfile =
  | { kind: "direct"; damage: number }
  | { kind: "cluster"; rackSize: number; damagePerProjectile: number; missilesPerLocation: number }
  | { kind: "utility" };

export type Weapon = {
  id: string;
  name: string;
  location: string;
  heat: number | null;
  profile: WeaponProfile | null;
  ranges: WeaponRanges | null;
};

export type Mech = {
  id: string;
  name: string;
  heatSinkCapacity: number;
  weapons: Weapon[];
};

export type DamageLocation = {
  damage: number;
  location: string;
  critical: boolean;
  locationRoll: number;
  reroll?: number;
};

export type AttackResult = {
  weapon: Weapon;
  targetNumber: number;
  hitRoll: number;
  hitDice: [number, number];
  hit: boolean;
  clusterRoll?: number;
  projectilesHit?: number;
  damageLocations: DamageLocation[];
};

const clusterSizes = [2, 3, 4, 5, 6, 9, 10, 12, 15, 20] as const;
const weaponDefinitions = new Map<string, { ranges: WeaponRanges; heat: number }>();
for (const line of rangeData.trim().split(/\r?\n/).slice(1)) {
  const [name, minimum, short, medium, long, heat, ...extra] = line.split(",");
  const values = [minimum, short, medium, long, heat];
  if (!name || extra.length || values.some((value) => !/^\d+$/.test(value ?? ""))) {
    throw new Error(`Invalid weapon range data: ${line}`);
  }
  const ranges = { minimum: Number(minimum), short: Number(short), medium: Number(medium), long: Number(long) };
  if (ranges.short > ranges.medium || ranges.medium > ranges.long || weaponDefinitions.has(name.toLowerCase())) {
    throw new Error(`Invalid or duplicate weapon range data: ${line}`);
  }
  weaponDefinitions.set(name.toLowerCase(), { ranges, heat: Number(heat) });
}

function weaponDefinition(name: string): { ranges: WeaponRanges; heat: number } | undefined {
  return weaponDefinitions.get(name.toLowerCase().replace(/^autocannon\s*\/\s*/, "ac/").replace(/^ac\s*\/\s*/, "ac/"));
}

export function getWeaponRange(ranges: WeaponRanges, distance: number): RangeResult {
  if (!Number.isInteger(distance) || distance < 0 || distance > 25) {
    throw new Error("Range to target must be a whole number from 0 to 25.");
  }
  if (distance > ranges.long) return { band: "Out of range", modifier: null };
  const band = distance <= ranges.short ? "Short" : distance <= ranges.medium ? "Medium" : "Long";
  const bandModifier = band === "Short" ? 0 : band === "Medium" ? 2 : 4;
  return { band, modifier: bandModifier + Math.max(0, ranges.minimum - distance) };
}

const clusterTable: Record<number, readonly number[]> = {
  2: [1, 1, 1, 1, 2, 3, 3, 4, 5, 6],
  3: [1, 1, 2, 2, 2, 3, 3, 4, 5, 6],
  4: [1, 1, 2, 2, 3, 4, 4, 5, 6, 9],
  5: [1, 2, 2, 3, 3, 5, 6, 8, 9, 12],
  6: [1, 2, 2, 3, 4, 5, 6, 8, 9, 12],
  7: [1, 2, 3, 3, 4, 5, 6, 8, 9, 12],
  8: [2, 2, 3, 3, 4, 5, 6, 8, 9, 12],
  9: [2, 2, 3, 4, 5, 7, 8, 10, 12, 16],
  10: [2, 3, 3, 4, 5, 7, 8, 10, 12, 16],
  11: [2, 3, 4, 5, 6, 9, 10, 12, 15, 20],
  12: [2, 3, 4, 5, 6, 9, 10, 12, 15, 20]
};

const locationTable: Record<Facing, Record<number, string>> = {
  Left: {
    3: "Left Leg", 4: "Left Arm", 5: "Left Arm", 6: "Left Leg",
    7: "Left Torso", 8: "Center Torso", 9: "Right Torso",
    10: "Right Arm", 11: "Right Leg", 12: "Head"
  },
  Front: {
    3: "Right Arm", 4: "Right Arm", 5: "Right Leg", 6: "Right Torso",
    7: "Center Torso", 8: "Left Torso", 9: "Left Leg",
    10: "Left Arm", 11: "Left Arm", 12: "Head"
  },
  Rear: {
    3: "Right Arm", 4: "Right Arm", 5: "Right Leg", 6: "Right Torso",
    7: "Center Torso", 8: "Left Torso", 9: "Left Leg",
    10: "Left Arm", 11: "Left Arm", 12: "Head"
  },
  Right: {
    3: "Right Leg", 4: "Right Arm", 5: "Right Arm", 6: "Right Leg",
    7: "Right Torso", 8: "Center Torso", 9: "Left Torso",
    10: "Left Arm", 11: "Left Leg", 12: "Head"
  }
};

export function summarizeDamageByLocation(attacks: AttackResult[], facing: Facing): { location: string; damage: number }[] {
  const totals = new Map<string, number>();
  for (let roll = 3; roll <= 12; roll += 1) {
    const location = locationTable[facing][roll];
    if (!totals.has(location)) totals.set(location, 0);
  }
  for (const attack of attacks) {
    for (const hit of attack.damageLocations) {
      const current = totals.get(hit.location);
      if (current === undefined) throw new Error(`Unknown hit location: ${hit.location}`);
      totals.set(hit.location, current + hit.damage);
    }
  }
  return Array.from(totals, ([location, damage]) => ({ location, damage }));
}

export function rollD6(): number {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) {
    throw new Error("Secure random number generation is unavailable in this browser.");
  }

  const value = new Uint8Array(1);
  do {
    cryptoApi.getRandomValues(value);
  } while (value[0] >= 252);
  return (value[0] % 6) + 1;
}

export function roll2D6(rollDie: () => number = rollD6, recordRoll?: (total: number) => void): [number, number] {
  const dice: [number, number] = [rollDie(), rollDie()];
  recordRoll?.(dice[0] + dice[1]);
  return dice;
}

export function getClusterHits(rackSize: number, roll: number): number {
  const table = clusterTable[roll];
  const rackIndex = clusterSizes.indexOf(rackSize as typeof clusterSizes[number]);
  if (!table || rackIndex < 0 || !Number.isInteger(roll) || roll < 2 || roll > 12) {
    throw new Error(`No cluster table entry for rack size ${rackSize} and roll ${roll}.`);
  }
  return table[rackIndex];
}

function getLocation(facing: Facing, rollDie: () => number, recordRoll?: (total: number) => void): DamageLocation {
  const [first, second] = roll2D6(rollDie, recordRoll);
  const locationRoll = first + second;
  if (locationRoll === 2) {
    let reroll: number;
    do {
      const [rerollFirst, rerollSecond] = roll2D6(rollDie, recordRoll);
      reroll = rerollFirst + rerollSecond;
    } while (reroll === 2);
    return {
      damage: 0,
      location: locationTable[facing][reroll],
      critical: true,
      locationRoll,
      reroll
    };
  }
  return {
    damage: 0,
    location: locationTable[facing][locationRoll],
    critical: false,
    locationRoll
  };
}

export function resolveAttack(
  weapon: Weapon,
  targetNumber: number,
  facing: Facing,
  rollDie: () => number = rollD6,
  recordRoll?: (total: number) => void
): AttackResult {
  if (!weapon.profile) {
    throw new Error(`${weapon.name} is not supported yet. Deselect it to fire the other weapons.`);
  }

  const hitDice = roll2D6(rollDie, recordRoll);
  const hitRoll = hitDice[0] + hitDice[1];
  if (hitRoll < targetNumber) {
    return { weapon, targetNumber, hitRoll, hitDice, hit: false, damageLocations: [] };
  }
  if (weapon.profile.kind === "utility") {
    return { weapon, targetNumber, hitRoll, hitDice, hit: true, damageLocations: [] };
  }
  if (weapon.profile.kind === "direct") {
    const location = getLocation(facing, rollDie, recordRoll);
    return {
      weapon,
      targetNumber,
      hitRoll,
      hitDice,
      hit: true,
      damageLocations: [{ ...location, damage: weapon.profile.damage }]
    };
  }

  const clusterDice = roll2D6(rollDie, recordRoll);
  const clusterRoll = clusterDice[0] + clusterDice[1];
  const projectilesHit = getClusterHits(weapon.profile.rackSize, clusterRoll);
  const damageLocations: DamageLocation[] = [];
  for (let remaining = projectilesHit; remaining > 0;) {
    const projectilesAtLocation = Math.min(remaining, weapon.profile.missilesPerLocation);
    const location = getLocation(facing, rollDie, recordRoll);
    damageLocations.push({
      ...location,
      damage: projectilesAtLocation * weapon.profile.damagePerProjectile
    });
    remaining -= projectilesAtLocation;
  }
  return {
    weapon,
    targetNumber,
    hitRoll,
    hitDice,
    hit: true,
    clusterRoll,
    projectilesHit,
    damageLocations
  };
}

function weaponProfile(name: string): WeaponProfile | null {
  const normalized = name.replace(/\s+/g, " ").trim();
  const lrm = normalized.match(/^LRM\s*(\d+)$/i);
  if (lrm) {
    const rackSize = Number(lrm[1]);
    return clusterSizes.includes(rackSize as typeof clusterSizes[number])
      ? { kind: "cluster", rackSize, damagePerProjectile: 1, missilesPerLocation: 5 }
      : null;
  }
  const srm = normalized.match(/^SRM\s*(\d+)$/i);
  if (srm) {
    const rackSize = Number(srm[1]);
    return clusterSizes.includes(rackSize as typeof clusterSizes[number])
      ? { kind: "cluster", rackSize, damagePerProjectile: 2, missilesPerLocation: 1 }
      : null;
  }
  if (/^Medium Laser$/i.test(normalized)) return { kind: "direct", damage: 5 };
  if (/^Small Laser$/i.test(normalized)) return { kind: "direct", damage: 3 };
  if (/^Large Laser$/i.test(normalized)) return { kind: "direct", damage: 8 };
  if (/^PPC$/i.test(normalized)) return { kind: "direct", damage: 10 };
  const autocannon = normalized.match(/^(?:AC|Autocannon)\s*\/\s*(2|5|10|20)$/i);
  if (autocannon) return { kind: "direct", damage: Number(autocannon[1]) };
  if (/^TAG$/i.test(normalized)) return { kind: "utility" };
  return null;
}

export function parseMech(id: string, contents: string): Mech {
  const lines = contents.split(/\r?\n/);
  const name = lines.find((line) => line.trim())?.trim() || id;
  const heatSinkLine = lines.find((line) => /^\s*(?:Double\s+)?Heat Sink\b/i.test(line));
  const heatSink = heatSinkLine?.match(/^\s*(Double\s+)?Heat Sink\s+(\d+)(?:\s+\[(\d+)\])?/i);
  if (!heatSink) {
    throw new Error(`Could not determine heat-sink capacity for '${name}'.`);
  }
  const sinkCount = Number(heatSink[2]);
  const heatSinkCapacity = Number(heatSink[3] ?? (heatSink[1] ? sinkCount * 2 : sinkCount));
  const weaponsHeader = lines.findIndex((line) => line.trim() === "Weapons");
  const equipmentHeader = weaponsHeader < 0
    ? -1
    : lines.findIndex((line, index) => index > weaponsHeader && /^\s*and Ammo\b/.test(line));
  const weapons: Weapon[] = [];
  if (equipmentHeader >= 0) {
    lines.slice(equipmentHeader + 1).forEach((line, lineIndex) => {
      const row = line.match(/^\s*(\d+)?\s*(.*?)\s{2,}([A-Z]{2})\s+\d+\s+([-\d]+)\s+[-\d.]+\s*$/);
      if (!row) return;
      const quantity = Number(row[1] || 1);
      const weaponName = row[2].trim().replace(/\s+/g, " ");
      const location = row[3];
      const heat = row[4] === "-" ? 0 : Number(row[4]);
      if (/heat sink|ammo|ecm suite|c3 computer|targeting computer|\bjump jets?\b/i.test(weaponName)) return;

      const profile = weaponProfile(weaponName);
      for (let index = 0; index < quantity; index += 1) {
        const suffix = quantity > 1 ? ` #${index + 1}` : "";
        weapons.push({
          id: `${id}-${lineIndex}-${index}`,
          name: `${weaponName}${suffix}`,
          location,
          heat,
          profile,
          ranges: weaponDefinition(weaponName)?.ranges ?? null
        });
      }
    });
  }
  return { id, name, heatSinkCapacity, weapons };
}

export function parseMtf(id: string, contents: string): Mech {
  const lines = contents.split(/\r?\n/);
  const field = (key: string): string | undefined => {
    const prefix = `${key.toLowerCase()}:`;
    return lines.find((line) => line.trim().toLowerCase().startsWith(prefix))?.trim().slice(prefix.length).trim();
  };
  const versionIndex = lines.findIndex((line) => /^\s*version\s*:/i.test(line));
  const legacyName = versionIndex >= 0
    ? lines.slice(versionIndex + 1).filter((line) => line.trim() && !line.trim().startsWith("#")).slice(0, 2).map((line) => line.trim())
    : [];
  const chassis = field("chassis") || legacyName[0];
  const model = field("model") || legacyName[1];
  if (!chassis || !model || chassis.includes(":") || model.includes(":")) {
    throw new Error(`Could not determine chassis and model for '${id}'.`);
  }
  const name = `${chassis} ${model}`;
  const sinks = field("heat sinks")?.match(/^(\d+)\s+(?:(?:IS|Clan)\s+)?(Single|Double)$/i);
  if (!sinks) throw new Error(`Could not determine heat-sink capacity for '${name}'.`);
  const heatSinkCapacity = Number(sinks[1]) * (sinks[2].toLowerCase() === "double" ? 2 : 1);
  const weaponsIndex = lines.findIndex((line) => /^\s*weapons\s*:/i.test(line));
  const header = weaponsIndex < 0 ? null : lines[weaponsIndex].match(/^\s*weapons\s*:\s*(\d+)\s*$/i);
  if (!header) throw new Error(`Could not determine weapon count for '${name}'.`);

  const techBase = field("techbase")?.toLowerCase();
  const useInnerSphereDefinitions = techBase === "inner sphere";
  const weapons: Weapon[] = [];
  const count = Number(header[1]);
  for (let index = 0; index < count; index += 1) {
    const line = lines[weaponsIndex + 1 + index];
    const parts = line?.split(",").map((part) => part.trim());
    if (!parts || parts.length < 2 || !parts[0] || !parts[1] || parts[1].includes(":")) {
      throw new Error(`Invalid weapon entry ${index + 1} for '${name}'.`);
    }
    const match = parts[0].match(/^(?:(\d+)\s+)?(.+?)(?:\s+\(R\))?$/i);
    if (!match) throw new Error(`Invalid weapon entry ${index + 1} for '${name}'.`);
    const quantity = Number(match[1] ?? 1);
    if (quantity < 1) throw new Error(`Invalid weapon quantity in '${name}'.`);
    const weaponName = match[2].replace(/\s+/g, " ");
    const definition = useInnerSphereDefinitions ? weaponDefinition(weaponName) : undefined;
    const rear = /\(R\)\s*$/i.test(parts[0]) || /\(R\)\s*$/i.test(parts[1]);
    const locationNames: Record<string, string> = {
      "head": "HD", "center torso": "CT", "left torso": "LT", "right torso": "RT",
      "left arm": "LA", "right arm": "RA", "left leg": "LL", "right leg": "RL"
    };
    const rawLocation = parts[1].replace(/\s*\(R\)\s*$/i, "").trim();
    const location = `${locationNames[rawLocation.toLowerCase()] ?? rawLocation}${rear ? " (R)" : ""}`;
    for (let item = 0; item < quantity; item += 1) {
      weapons.push({
        id: `${id}-${index}-${item}`,
        name: `${weaponName}${quantity > 1 ? ` #${item + 1}` : ""}`,
        location,
        heat: definition?.heat ?? null,
        profile: useInnerSphereDefinitions ? weaponProfile(weaponName) : null,
        ranges: definition?.ranges ?? null
      });
    }
  }
  return { id, name, heatSinkCapacity, weapons };
}

export function parseMechs(files: Record<string, string>): Mech[] {
  return Object.entries(files)
    .map(([path, contents]) => /\.mtf$/i.test(path) ? parseMtf(path, contents) : parseMech(path, contents))
    .sort((left, right) => left.name.localeCompare(right.name));
}
