export const DAMAGE_LOCATION_KEYS = [
  "head", "center-torso", "left-torso", "right-torso",
  "left-arm", "right-arm", "left-leg", "right-leg"
] as const;

export type DamageLocationKey = typeof DAMAGE_LOCATION_KEYS[number];
export type DamageSurface = "Front" | "Rear";

export type DamageProfileLocation = {
  armor: number;
  rearArmor?: number;
  internal: number;
};

export type DamageProfile = Record<DamageLocationKey, DamageProfileLocation>;
export type DamageValue = { current: number; maximum: number };
export type DamageRecordLocation = {
  armor: DamageValue;
  rearArmor?: DamageValue;
  internal: DamageValue;
};
export type DamageRecord = {
  version: 1;
  sourceMechId: string;
  sourceProfileFingerprint: string;
  locations: Record<DamageLocationKey, DamageRecordLocation>;
};

export type DamageTotals = {
  armor: DamageValue;
  internal: DamageValue;
};

export type LocationDamageApplication = {
  location: DamageLocationKey;
  surface: DamageSurface;
  amount: number;
  armorDamage: number;
  internalDamage: number;
  unapplied: number;
};

const torsoLocations = new Set<DamageLocationKey>(["center-torso", "left-torso", "right-torso"]);

const internalStructureByTonnage: Readonly<Record<number, readonly [number, number, number, number, number]>> = {
  10: [3, 4, 3, 1, 2],
  15: [3, 5, 4, 2, 3],
  20: [3, 6, 5, 3, 4],
  25: [3, 8, 6, 4, 6],
  30: [3, 10, 7, 5, 7],
  35: [3, 11, 8, 6, 8],
  40: [3, 12, 10, 6, 10],
  45: [3, 14, 11, 7, 11],
  50: [3, 16, 12, 8, 12],
  55: [3, 18, 13, 9, 13],
  60: [3, 20, 14, 10, 14],
  65: [3, 21, 15, 10, 15],
  70: [3, 22, 15, 11, 15],
  75: [3, 23, 16, 12, 16],
  80: [3, 25, 17, 13, 17],
  85: [3, 27, 18, 14, 18],
  90: [3, 29, 19, 15, 19],
  95: [3, 30, 20, 16, 20],
  100: [3, 31, 21, 17, 21]
};

export function internalStructureForTonnage(tonnage: number): Record<DamageLocationKey, number> {
  if (!Number.isSafeInteger(tonnage) || tonnage < 10 || tonnage > 100) {
    throw new Error(`Unsupported BattleMech tonnage: ${tonnage}.`);
  }
  const tableTonnage = Math.ceil(tonnage / 5) * 5;
  const values = internalStructureByTonnage[tableTonnage];
  if (!values) throw new Error(`No internal structure data for ${tableTonnage} tons.`);
  const [head, center, side, arm, leg] = values;
  return {
    head, "center-torso": center, "left-torso": side, "right-torso": side,
    "left-arm": arm, "right-arm": arm, "left-leg": leg, "right-leg": leg
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validValue(value: unknown): value is DamageValue {
  return isObject(value) && Number.isSafeInteger(value.current) && (value.current as number) >= 0 &&
    Number.isSafeInteger(value.maximum) && (value.maximum as number) >= 0 &&
    (value.current as number) <= (value.maximum as number);
}

export function validateDamageRecord(value: unknown): asserts value is DamageRecord {
  if (!isObject(value) || value.version !== 1 || typeof value.sourceMechId !== "string" ||
      !value.sourceMechId.trim() || typeof value.sourceProfileFingerprint !== "string" ||
      !value.sourceProfileFingerprint || !isObject(value.locations)) {
    throw new Error("Invalid saved damage record.");
  }
  for (const key of DAMAGE_LOCATION_KEYS) {
    const location = value.locations[key];
    if (!isObject(location) || !validValue(location.armor) || !validValue(location.internal)) {
      throw new Error(`Invalid saved damage at ${key}.`);
    }
    if (torsoLocations.has(key)) {
      if (!validValue(location.rearArmor)) throw new Error(`Invalid saved rear armor at ${key}.`);
    } else if (location.rearArmor !== undefined) {
      throw new Error(`Unexpected rear armor at ${key}.`);
    }
  }
  if (Object.keys(value.locations).length !== DAMAGE_LOCATION_KEYS.length) {
    throw new Error("Saved damage record has unknown locations.");
  }
}

export function damageProfileFingerprint(sourceMechId: string, profile: DamageProfile): string {
  return JSON.stringify([
    sourceMechId,
    DAMAGE_LOCATION_KEYS.map((key) => [
      key, profile[key].armor, profile[key].rearArmor ?? null, profile[key].internal
    ])
  ]);
}

export function createDamageRecord(sourceMechId: string, profile: DamageProfile): DamageRecord {
  if (typeof sourceMechId !== "string" || !sourceMechId.trim()) throw new Error("Mech design identity is required.");
  const locations = Object.fromEntries(DAMAGE_LOCATION_KEYS.map((key) => {
    const source = profile[key];
    if (!source || !Number.isSafeInteger(source.armor) || source.armor < 0 ||
        !Number.isSafeInteger(source.internal) || source.internal < 0 ||
        (torsoLocations.has(key) && (!Number.isSafeInteger(source.rearArmor) || (source.rearArmor ?? -1) < 0)) ||
        (!torsoLocations.has(key) && source.rearArmor !== undefined)) {
      throw new Error(`Invalid damage profile at ${key}.`);
    }
    const location: DamageRecordLocation = {
      armor: { current: source.armor, maximum: source.armor },
      internal: { current: source.internal, maximum: source.internal }
    };
    if (torsoLocations.has(key)) {
      location.rearArmor = { current: source.rearArmor as number, maximum: source.rearArmor as number };
    }
    return [key, location];
  })) as Record<DamageLocationKey, DamageRecordLocation>;
  const record: DamageRecord = {
    version: 1, sourceMechId,
    sourceProfileFingerprint: damageProfileFingerprint(sourceMechId, profile),
    locations
  };
  validateDamageRecord(record);
  return record;
}

export function applyDamage(
  record: DamageRecord,
  location: DamageLocationKey,
  amount: number,
  surface: DamageSurface = "Front"
): { record: DamageRecord; unapplied: number } {
  validateDamageRecord(record);
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error("Damage must be a non-negative whole number.");
  if (!DAMAGE_LOCATION_KEYS.includes(location)) throw new Error("Unknown damage location.");
  if (surface !== "Front" && surface !== "Rear") throw new Error("Unknown armor facing.");
  if (!torsoLocations.has(location) && surface !== "Front") throw new Error("Rear armor is only available on torso locations.");

  const next = structuredClone(record);
  const target = next.locations[location];
  const armor = surface === "Rear" ? target.rearArmor : target.armor;
  if (!armor) throw new Error("Rear armor is unavailable at this location.");

  const armorDamage = Math.min(amount, armor.current);
  armor.current -= armorDamage;
  const remaining = amount - armorDamage;
  const internalDamage = Math.min(remaining, target.internal.current);
  target.internal.current -= internalDamage;
  return { record: next, unapplied: remaining - internalDamage };
}

export function applyDamageByLocation(
  record: DamageRecord,
  amounts: Partial<Record<DamageLocationKey, number>>,
  surface: DamageSurface = "Front"
): { record: DamageRecord; applications: LocationDamageApplication[] } {
  validateDamageRecord(record);
  if (!isObject(amounts)) throw new Error("Location damage must be an object.");
  for (const key of Object.keys(amounts)) {
    if (!DAMAGE_LOCATION_KEYS.includes(key as DamageLocationKey)) throw new Error(`Unknown damage location: ${key}.`);
    const amount = amounts[key as DamageLocationKey];
    if (!Number.isSafeInteger(amount) || (amount as number) < 0) {
      throw new Error("Damage must be a non-negative whole number.");
    }
  }
  if (surface !== "Front" && surface !== "Rear") throw new Error("Unknown armor facing.");

  let next = record;
  const applications: LocationDamageApplication[] = [];
  for (const location of DAMAGE_LOCATION_KEYS) {
    const amount = amounts[location];
    if (amount === undefined || amount === 0) continue;
    const armorSurface = torsoLocations.has(location) ? surface : "Front";
    const before = next.locations[location];
    const armor = armorSurface === "Rear" ? before.rearArmor : before.armor;
    if (!armor) throw new Error(`Rear armor is unavailable at ${location}.`);
    const result = applyDamage(next, location, amount, armorSurface);
    const after = result.record.locations[location];
    const updatedArmor = armorSurface === "Rear" ? after.rearArmor : after.armor;
    if (!updatedArmor) throw new Error(`Rear armor is unavailable at ${location}.`);
    applications.push({
      location,
      surface: armorSurface,
      amount,
      armorDamage: armor.current - updatedArmor.current,
      internalDamage: before.internal.current - after.internal.current,
      unapplied: result.unapplied
    });
    next = result.record;
  }
  return { record: next, applications };
}

export function restoreDamage(record: DamageRecord): DamageRecord {
  validateDamageRecord(record);
  const next = structuredClone(record);
  for (const key of DAMAGE_LOCATION_KEYS) {
    const location = next.locations[key];
    location.armor.current = location.armor.maximum;
    location.internal.current = location.internal.maximum;
    if (location.rearArmor) location.rearArmor.current = location.rearArmor.maximum;
  }
  return next;
}

export function getDamageTotals(record: DamageRecord): DamageTotals {
  validateDamageRecord(record);
  return DAMAGE_LOCATION_KEYS.reduce<DamageTotals>((totals, key) => {
    const location = record.locations[key];
    totals.armor.current += location.armor.current + (location.rearArmor?.current ?? 0);
    totals.armor.maximum += location.armor.maximum + (location.rearArmor?.maximum ?? 0);
    totals.internal.current += location.internal.current;
    totals.internal.maximum += location.internal.maximum;
    return totals;
  }, { armor: { current: 0, maximum: 0 }, internal: { current: 0, maximum: 0 } });
}

type Hsl = { hue: number; saturation: number; lightness: number };

function hexToHsl(hex: string): Hsl {
  const red = parseInt(hex.slice(1, 3), 16) / 255;
  const green = parseInt(hex.slice(3, 5), 16) / 255;
  const blue = parseInt(hex.slice(5, 7), 16) / 255;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const difference = maximum - minimum;
  let hue = 0;
  if (difference) {
    if (maximum === red) hue = ((green - blue) / difference) % 6;
    else if (maximum === green) hue = (blue - red) / difference + 2;
    else hue = (red - green) / difference + 4;
  }
  return {
    hue: (hue * 60 + 360) % 360,
    saturation: difference ? difference / (1 - Math.abs(2 * ((maximum + minimum) / 2) - 1)) : 0,
    lightness: (maximum + minimum) / 2
  };
}

function hslToHex({ hue, saturation, lightness }: Hsl): string {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const section = hue / 60;
  const intermediate = chroma * (1 - Math.abs(section % 2 - 1));
  const [red, green, blue] = section < 1 ? [chroma, intermediate, 0]
    : section < 2 ? [intermediate, chroma, 0]
      : section < 3 ? [0, chroma, intermediate]
        : section < 4 ? [0, intermediate, chroma]
          : section < 5 ? [intermediate, 0, chroma] : [chroma, 0, intermediate];
  const offset = lightness - chroma / 2;
  return `#${[red, green, blue].map((value) =>
    Math.round((value + offset) * 255).toString(16).padStart(2, "0")
  ).join("")}`.toUpperCase();
}

export function damageFill(healthPercent: number): { color: string; opacity: number } {
  if (!Number.isFinite(healthPercent)) throw new Error("Health percentage must be finite.");
  const percent = Math.max(0, Math.min(100, healthPercent));
  if (percent === 0) return { color: "#101010", opacity: 1 };
  if (percent === 5) return { color: "#E02020", opacity: 1 };
  if (percent === 50) return { color: "#FFFF00", opacity: 1 };
  if (percent === 100) return { color: "#26FF00", opacity: 1 };

  const startHex = percent > 50 ? "#26FF00" : percent > 5 ? "#FFFF00" : "#E02020";
  const endHex = percent > 50 ? "#FFFF00" : percent > 5 ? "#E02020" : "#101010";
  const upperPercent = percent > 50 ? 100 : percent > 5 ? 50 : 5;
  const lowerPercent = percent > 50 ? 50 : percent > 5 ? 5 : 0;
  const start = hexToHsl(startHex);
  const end = hexToHsl(endHex);
  const progress = (upperPercent - percent) / (upperPercent - lowerPercent);
  let hueDifference = end.hue - start.hue;
  if (hueDifference > 180) hueDifference -= 360;
  if (hueDifference < -180) hueDifference += 360;
  return {
    color: hslToHex({
      hue: (start.hue + hueDifference * progress + 360) % 360,
      saturation: start.saturation + (end.saturation - start.saturation) * progress,
      lightness: start.lightness + (end.lightness - start.lightness) * progress
    }),
    opacity: 1
  };
}
