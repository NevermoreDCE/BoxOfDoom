import { describe, expect, it, vi } from "vitest";
import { RollHistory } from "./roll-history";
import { resolveAttack, type Weapon } from "./game";

function memoryStorage(): Storage {
  const entries = new Map<string, string>();
  return {
    get length() { return entries.size; },
    clear: () => entries.clear(),
    getItem: (key) => entries.get(key) ?? null,
    key: (index) => Array.from(entries.keys())[index] ?? null,
    removeItem: (key) => { entries.delete(key); },
    setItem: (key, value) => { entries.set(key, value); }
  };
}

describe("dice diagnostics", () => {
  it("counts totals, restores them in the same session, and resets them", () => {
    const storage = memoryStorage();
    const report = vi.fn();
    const history = new RollHistory(report, () => storage);
    history.record(2);
    history.record(7);
    history.record(7);
    history.record(12);
    const restored = new RollHistory(report, () => storage);
    expect(restored.counts()).toEqual([1, 0, 0, 0, 0, 2, 0, 0, 0, 0, 1]);
    restored.reset();
    expect(restored.counts()).toEqual(Array(11).fill(0));
    expect(new RollHistory(report, () => storage).counts()).toEqual(Array(11).fill(0));
  });

  it("records hit, cluster, location and repeated floating critical rerolls", () => {
    const history = new RollHistory(() => {}, memoryStorage);
    const weapon: Weapon = {
      id: "lrm", name: "LRM 5", location: "RT", heat: 2,
      ranges: { minimum: 6, short: 7, medium: 14, long: 21 },
      profile: { kind: "cluster", rackSize: 5, damagePerProjectile: 1, missilesPerLocation: 5 }
    };
    const dice = [6, 6, 1, 1, 1, 1, 1, 1, 4, 4];
    resolveAttack(weapon, 8, "Front", () => {
      const die = dice.shift();
      if (die === undefined) throw new Error("Unexpected die roll");
      return die;
    }, (total) => history.record(total));
    expect(history.counts()).toEqual([3, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1]);
    expect(dice).toEqual([]);
  });

  it("reports storage failure while keeping current rolls in memory", () => {
    const report = vi.fn();
    const history = new RollHistory(report, () => { throw new Error("Storage blocked"); });
    history.record(7);
    expect(history.counts()[5]).toBe(1);
    expect(report).toHaveBeenCalledWith(expect.stringContaining("could not be loaded or saved"));
    history.reset();
    expect(history.counts()[5]).toBe(0);
    expect(report).toHaveBeenLastCalledWith(expect.stringContaining("could not be removed"));
  });
});
