import { validateDamageRecord, type DamageRecord } from "./damage";

export const TEAM_COLORS = [
  "#0077bb", "#ff7700", "#eeccbb", "#665533",
  "#aa00ff", "#bbccff", "#44ff77", "#bb6688",
  "#999966", "#991177", "#ff55ff", "#cc3300",
  "#ccee00", "#6633bb", "#00bbbb", "#99eeee"
] as const;

export type BattleMech = {
  id: string;
  sourceMechId: string;
  name: string;
  damage: DamageRecord | null;
  disabledWeapons?: string[];
};

export type Team = { id: string; name: string; color: string; mechs: BattleMech[] };
export type Battle = { id: string; name: string; teams: Team[] };
export type BattleData = { version: 2; activeBattleId: string | null; battles: Battle[] };

export const BATTLE_STORAGE_KEY = "box-of-doom-battles";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonempty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateBattleData(value: unknown): asserts value is BattleData {
  if (!isObject(value) || value.version !== 2 || !Array.isArray(value.battles) ||
      !(value.activeBattleId === null || nonempty(value.activeBattleId))) {
    throw new Error("Unrecognized or invalid Battle data.");
  }
  const ids = new Set<string>();
  const uniqueId = (id: unknown): void => {
    if (!nonempty(id) || ids.has(id)) throw new Error("Invalid or duplicate Battle data identifier.");
    ids.add(id);
  };
  for (const battle of value.battles) {
    if (!isObject(battle) || !nonempty(battle.name) || !Array.isArray(battle.teams) ||
        battle.teams.length < 1 || battle.teams.length > TEAM_COLORS.length) {
      throw new Error("Invalid saved Battle.");
    }
    uniqueId(battle.id);
    const names = new Set<string>();
    const colors = new Set<string>();
    for (const team of battle.teams) {
      if (!isObject(team) || !nonempty(team.name) || typeof team.color !== "string" ||
          !TEAM_COLORS.some((color) => color === team.color) || !Array.isArray(team.mechs)) {
        throw new Error("Invalid saved team.");
      }
      uniqueId(team.id);
      const name = team.name.trim().toLocaleLowerCase();
      if (names.has(name) || colors.has(team.color)) throw new Error("Duplicate team name or color.");
      names.add(name);
      colors.add(team.color);
      for (const mech of team.mechs) {
        if (!isObject(mech) || !nonempty(mech.sourceMechId) || !nonempty(mech.name) ||
            !(mech.damage === null || isObject(mech.damage))) {
          throw new Error("Invalid saved mech.");
        }
        if (mech.damage !== null) validateDamageRecord(mech.damage);
        if (mech.disabledWeapons !== undefined &&
            (!Array.isArray(mech.disabledWeapons) || !mech.disabledWeapons.every(nonempty) ||
              new Set(mech.disabledWeapons).size !== mech.disabledWeapons.length)) {
          throw new Error("Invalid disabled weapon data.");
        }
        uniqueId(mech.id);
      }
    }
  }
}

export class BattleStore {
  private raw: string | null;
  data: BattleData;

  constructor(private readonly storage: Storage) {
    this.raw = storage.getItem(BATTLE_STORAGE_KEY);
    if (this.raw === null) {
      this.data = { version: 2, activeBattleId: null, battles: [] };
    } else {
      const parsed: unknown = JSON.parse(this.raw);
      if (isObject(parsed) && parsed.version === 1) {
        const migrated: unknown = { ...parsed, version: 2 };
        validateBattleData(migrated);
        const raw = JSON.stringify(migrated);
        storage.setItem(BATTLE_STORAGE_KEY, raw);
        this.raw = raw;
        this.data = migrated;
      } else {
        validateBattleData(parsed);
        this.data = parsed;
      }
    }
  }

  update(change: (data: BattleData) => void): void {
    if (this.storage.getItem(BATTLE_STORAGE_KEY) !== this.raw) {
      throw new Error("Battle data changed in another tab. Reload this page before making changes.");
    }
    const next: BattleData = JSON.parse(JSON.stringify(this.data));
    change(next);
    validateBattleData(next);
    const raw = JSON.stringify(next);
    this.storage.setItem(BATTLE_STORAGE_KEY, raw);
    this.raw = raw;
    this.data = next;
  }
}

export function defaultMechName(chassis: string, teams: Team[]): string {
  const names = new Set(teams.flatMap((team) => team.mechs.map((mech) => mech.name.toLocaleLowerCase())));
  let number = 1;
  while (names.has(`${chassis} ${number}`.toLocaleLowerCase())) number += 1;
  return `${chassis} ${number}`;
}
