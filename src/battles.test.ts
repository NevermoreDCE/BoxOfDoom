import { describe, expect, it } from "vitest";
import { BATTLE_STORAGE_KEY, BattleStore, TEAM_COLORS, defaultMechName, validateBattleData, type BattleData } from "./battles";

class MemoryStorage implements Storage {
  private items = new Map<string, string>();
  get length(): number { return this.items.size; }
  clear(): void { this.items.clear(); }
  getItem(key: string): string | null { return this.items.get(key) ?? null; }
  key(index: number): string | null { return Array.from(this.items.keys())[index] ?? null; }
  removeItem(key: string): void { this.items.delete(key); }
  setItem(key: string, value: string): void { this.items.set(key, value); }
}

function fixture(): BattleData {
  return {
    version: 1, activeBattleId: "battle", battles: [{
      id: "battle", name: "Battle", teams: [{
        id: "team", name: "Blue", color: TEAM_COLORS[0], mechs: [
          { id: "mech1", sourceMechId: "missing-file", name: "Annihilator 1", damage: null }
        ]
      }]
    }]
  };
}

describe("Battle storage", () => {
  it("persists and restores an active Battle, empty teams, and missing design references", () => {
    const storage = new MemoryStorage();
    const store = new BattleStore(storage);
    store.update((data) => Object.assign(data, fixture()));
    store.update((data) => { data.battles[0].teams.push({ id: "empty", name: "Red", color: TEAM_COLORS[1], mechs: [] }); });
    const restored = new BattleStore(storage);
    expect(restored.data.activeBattleId).toBe("battle");
    expect(restored.data.battles[0].teams[0].mechs[0]).toEqual(fixture().battles[0].teams[0].mechs[0]);
    expect(restored.data.battles[0].teams[1].mechs).toEqual([]);
  });

  it("preserves invalid or future data rather than overwriting it", () => {
    const storage = new MemoryStorage();
    for (const raw of ["{", JSON.stringify({ ...fixture(), version: 2 })]) {
      storage.setItem(BATTLE_STORAGE_KEY, raw);
      expect(() => new BattleStore(storage)).toThrow();
      expect(storage.getItem(BATTLE_STORAGE_KEY)).toBe(raw);
    }
  });

  it("does not commit invalid changes or failed writes", () => {
    const storage = new MemoryStorage();
    const store = new BattleStore(storage);
    store.update((data) => Object.assign(data, fixture()));
    const raw = storage.getItem(BATTLE_STORAGE_KEY);
    expect(() => store.update((data) => {
      data.battles[0].teams.push({ id: "other", name: " blue ", color: TEAM_COLORS[1], mechs: [] });
    })).toThrow(/Duplicate team/);
    expect(storage.getItem(BATTLE_STORAGE_KEY)).toBe(raw);
    expect(store.data).toEqual(fixture());
    storage.setItem = () => { throw new Error("quota exceeded"); };
    expect(() => store.update((data) => { data.battles[0].name = "Changed"; })).toThrow(/quota/);
    expect(store.data).toEqual(fixture());
    expect(storage.getItem(BATTLE_STORAGE_KEY)).toBe(raw);
  });

  it("detects changes from another tab before overwriting them", () => {
    const storage = new MemoryStorage();
    const first = new BattleStore(storage);
    const second = new BattleStore(storage);
    first.update((data) => Object.assign(data, fixture()));
    expect(() => second.update((data) => { data.activeBattleId = null; })).toThrow(/another tab/);
    expect(new BattleStore(storage).data).toEqual(fixture());
  });

  it("persists disabled weapon keys independently for each mech and loads older records", () => {
    const storage = new MemoryStorage();
    const old = fixture();
    storage.setItem(BATTLE_STORAGE_KEY, JSON.stringify(old));
    const store = new BattleStore(storage);
    expect(store.data.battles[0].teams[0].mechs[0].disabledWeapons).toBeUndefined();
    store.update((data) => {
      const mechs = data.battles[0].teams[0].mechs;
      mechs.push({ id: "mech2", sourceMechId: "missing-file", name: "Annihilator 2", damage: null });
      mechs[0].disabledWeapons = ["weapon-key"];
    });
    const saved = new BattleStore(storage).data.battles[0].teams[0].mechs;
    expect(saved[0].disabledWeapons).toEqual(["weapon-key"]);
    expect(saved[1].disabledWeapons).toBeUndefined();
    store.update((data) => { data.battles[0].teams[0].mechs[0].disabledWeapons = []; });
    expect(new BattleStore(storage).data.battles[0].teams[0].mechs[0].disabledWeapons).toEqual([]);
  });

  it("rejects malformed or duplicate disabled keys without overwriting storage", () => {
    const storage = new MemoryStorage();
    const store = new BattleStore(storage);
    store.update((data) => Object.assign(data, fixture()));
    const raw = storage.getItem(BATTLE_STORAGE_KEY);
    expect(() => store.update((data) => { data.battles[0].teams[0].mechs[0].disabledWeapons = ["same", "same"]; })).toThrow(/disabled weapon/);
    expect(storage.getItem(BATTLE_STORAGE_KEY)).toBe(raw);
  });

  it("enforces unique colors and IDs and the 16-team limit", () => {
    expect(new Set(TEAM_COLORS).size).toBe(16);
    const data = fixture();
    data.battles[0].teams.push({ id: "other", name: "Red", color: TEAM_COLORS[0], mechs: [] });
    expect(() => validateBattleData(data)).toThrow(/Duplicate team/);
    data.battles[0].teams[1].color = TEAM_COLORS[1];
    data.battles[0].teams[1].id = "mech1";
    expect(() => validateBattleData(data)).toThrow(/identifier/);
    data.battles[0].teams = Array.from({ length: 17 }, (_, index) => ({
      id: `team${index}`, name: `Team ${index}`, color: TEAM_COLORS[index % 16], mechs: []
    }));
    expect(() => validateBattleData(data)).toThrow(/Invalid saved Battle/);
  });

  it("creates distinct default callsigns across teams", () => {
    expect(defaultMechName("Annihilator", fixture().battles[0].teams)).toBe("Annihilator 2");
  });
});
