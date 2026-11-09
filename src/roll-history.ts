const STORAGE_KEY = "box-of-doom-roll-history";

export class RollHistory {
  private rolls: number[] = [];
  private storage: Storage | null = null;
  private blocked = false;

  constructor(private readonly reportError: (message: string) => void, getStorage: () => Storage) {
    try {
      this.storage = getStorage();
      const saved = this.storage.getItem(STORAGE_KEY);
      if (saved !== null) {
        const parsed: unknown = JSON.parse(saved);
        if (!Array.isArray(parsed) || !parsed.every((value) => Number.isInteger(value) && value >= 2 && value <= 12)) {
          throw new Error("Invalid saved roll history.");
        }
        this.rolls = parsed;
      }
    } catch (error) {
      this.blocked = true;
      console.error("Could not load dice roll history:", error);
      this.reportError("Dice history could not be loaded or saved. Reset it to try again; new rolls are kept in memory.");
    }
  }

  record(total: number): void {
    if (!Number.isInteger(total) || total < 2 || total > 12) {
      throw new Error(`Invalid 2D6 total: ${total}.`);
    }
    this.rolls.push(total);
    if (!this.storage || this.blocked) return;
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.rolls));
    } catch (error) {
      this.blocked = true;
      console.error("Could not save dice roll history:", error);
      this.reportError("Dice history could not be saved. New rolls are kept in memory for this page.");
    }
  }

  counts(): number[] {
    const counts = Array<number>(11).fill(0);
    for (const roll of this.rolls) counts[roll - 2] += 1;
    return counts;
  }

  reset(): void {
    this.rolls = [];
    try {
      if (!this.storage) throw new Error("Session storage is unavailable.");
      this.storage.removeItem(STORAGE_KEY);
      this.blocked = false;
      this.reportError("");
    } catch (error) {
      this.blocked = true;
      console.error("Could not reset saved dice roll history:", error);
      this.reportError("The current chart was cleared, but saved dice history could not be removed.");
    }
  }
}
