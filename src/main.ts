import "./style.css";
import { getWeaponRange, parseAvailableMechs, resolveAttack, summarizeDamageByLocation, weaponTargetNumber, type AttackResult, type Facing, type Mech, type Weapon } from "./game";
import { RollHistory } from "./roll-history";
import { setupBattles, type DamageRosterEntry } from "./battle-ui";
import { setupDamageTracking } from "./damage-ui";
import {
  applyDamageByLocation,
  createDamageRecord,
  validateDamageRecord,
  type DamageLocationKey,
  type DamageRecord,
  type DamageSurface
} from "./damage";

const mechFiles = import.meta.glob(["../mechs/**/*.txt", "../mechs/**/*.mtf"], { eager: true, query: "?raw", import: "default" }) as Record<string, string>;
const { mechs, errors: mechErrors } = parseAvailableMechs(mechFiles);
const app = document.querySelector<HTMLDivElement>("#app");
const mobileBreakpoint = window.matchMedia("(max-width: 768px)");
const mobileUserAgent = /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(navigator.userAgent);

if (!app) throw new Error("The application root element is missing.");

let activeMech: Mech | undefined;
let disabledWeapons = new Set<string>();
let saveDisabledWeapons: (keys: string[]) => boolean = () => false;
let selectedWeapons = shortRangeWeapons(activeMech, 6, disabledWeapons);
let results: AttackResult[] = [];
let resultsFacing: Facing = "Front";
let volleyDamageApplied = false;
let appliedDamageStatus = "";
let getDamageRoster: () => DamageRosterEntry[] = () => [];
let getCurrentTeamId: () => string | undefined = () => undefined;
let saveTargetDamage: (mechId: string, damage: DamageRecord) => string | undefined = () => "Battle storage is unavailable.";
let statusMessage = "";
let compactResults = mobileBreakpoint.matches || mobileUserAgent;

const damageLocationKeysByName: Record<string, DamageLocationKey> = {
  Head: "head",
  "Center Torso": "center-torso",
  "Left Torso": "left-torso",
  "Right Torso": "right-torso",
  "Left Arm": "left-arm",
  "Right Arm": "right-arm",
  "Left Leg": "left-leg",
  "Right Leg": "right-leg"
};
const damageLocationNames: Record<DamageLocationKey, string> = {
  head: "Head",
  "center-torso": "Center Torso",
  "left-torso": "Left Torso",
  "right-torso": "Right Torso",
  "left-arm": "Left Arm",
  "right-arm": "Right Arm",
  "left-leg": "Left Leg",
  "right-leg": "Right Leg"
};

app.innerHTML = `
  <main class="shell">
    <header class="hero">
      <p class="eyebrow">BATTLETECH · QUICK ATTACK ROLLER</p>
      <h1>Box of Doom</h1>
      <p class="intro">Pick a 'Mech, set your GATOR modifiers, and resolve your volley.</p>
    </header>
    ${mechErrors.length ? `<details class="panel error"><summary>${mechErrors.length} bundled mech design(s) could not be loaded</summary><ul>${mechErrors.map(({ path, message }) => `<li>${escapeHtml(path)}: ${escapeHtml(message)}</li>`).join("")}</ul></details>` : ""}
    <section id="battle-controls" class="panel" aria-label="Battle"></section>
    <div id="attack-screen" hidden>
      <section class="panel" aria-labelledby="attacker-title">
        <h2 id="attacker-title">Attacker</h2>
        <p id="attacker-name" class="notice"></p>
        <label class="field range-field">
          <span>Range to target</span>
          <input id="range-to-target" type="number" min="0" max="25" step="1" value="6" inputmode="numeric" aria-describedby="range-help" />
          <span id="range-help" class="field-hint">Enter 0 to 25 hexes. Changing range selects short-range weapons.</span>
        </label>
        <div id="weapon-list" class="weapon-list"></div>
        <div class="target-number heat-summary"><span>Heat Generated / Heat Sink Capacity</span><strong id="heat-generated">0 / ${activeMech?.heatSinkCapacity ?? 0}</strong></div>
        <p class="heat-reminder">Weapon heat only, other heat sources such as movement may apply separately</p>
      </section>

      <section class="panel" aria-labelledby="gator-title">
        <h2 id="gator-title">Attack modifiers <span class="subtitle">GATOR</span></h2>
        <div class="form-grid">
          <label class="field">
            <span>Gunnery skill</span>
            <select id="gunnery">${[5, 4, 3, 2, 1, 0, -1].map((value) => `<option value="${value}"${value === 4 ? " selected" : ""}>${value}${value === 5 ? " · worst" : value === -1 ? " · best" : ""}</option>`).join("")}</select>
          </label>
          <label class="field">
            <span>Attacker movement</span>
            <select id="movement">
              <option value="0">Stationary (+0)</option><option value="1">Walk (+1)</option>
              <option value="2" selected>Run (+2)</option><option value="3">Jump (+3)</option>
              <option value="4">Prone (+4)</option>
            </select>
          </label>
          <label class="field">
            <span>Target movement</span>
            <select id="target-movement">${Array.from({ length: 7 }, (_, value) => `<option value="${value}"${value === 2 ? " selected" : ""}>${value}</option>`).join("")}</select>
          </label>
          <label class="field">
            <span>Other modifier</span>
            <input id="other" type="number" step="1" value="0" inputmode="numeric" />
          </label>
          <label class="field">
            <span>Target facing</span>
            <select id="facing"><option selected>Front</option><option>Left</option><option>Right</option><option>Rear</option></select>
          </label>
        </div>
        <div class="target-number"><span>Target number</span><strong id="target-number">8 + Range</strong></div>
        <button id="fire" class="fire-button" type="button">Fire selected weapons</button>
        <p id="status" class="status" role="status" aria-live="polite"></p>
      </section>

      <section class="panel results-panel" aria-labelledby="results-title">
        <div class="results-header">
          <h2 id="results-title">Volley results</h2>
          <div class="damage-summary" aria-live="polite">
            <span class="damage-label">Total damage</span>
            <strong id="total-damage">0</strong>
            <span id="psr-required" class="psr-warning" hidden>PSR required</span>
          </div>
        </div>
        <div id="results" class="results-empty">Your attack results will appear here.</div>
        <section id="location-summary" class="location-summary" aria-labelledby="location-summary-title" hidden>
          <h3 id="location-summary-title">Damage by location</h3>
          <p id="location-summary-facing" class="location-summary-facing"></p>
          <dl id="location-damage-list" class="location-damage-list"></dl>
        </section>
        <div id="apply-damage-controls"></div>
      </section>
    </div>
    <section id="damage-screen" hidden aria-label="Damage tracking"></section>
    <dialog id="apply-damage-dialog" class="damage-dialog" aria-labelledby="apply-damage-title"></dialog>
    <dialog id="battle-dialog" class="battle-dialog" aria-label="Choose a Battle"></dialog>
    <dialog id="roster-dialog" class="battle-dialog" aria-label="Manage Battle"></dialog>
    <footer>
      <span>Rolls use your browser's cryptographically secure random number generator.</span>
      <button id="open-diagnostics" class="gear-button" type="button" aria-label="Open dice roll diagnostics" title="Dice roll diagnostics">&#9881;</button>
    </footer>
    <dialog id="diagnostics-dialog" class="diagnostics-dialog" aria-labelledby="diagnostics-title">
      <div class="diagnostics-heading">
        <h2 id="diagnostics-title">Dice roll diagnostics</h2>
        <button id="close-diagnostics" class="diagnostics-close" type="button" aria-label="Close diagnostics">&times;</button>
      </div>
      <p class="diagnostics-description">2D6 totals for to-hit, cluster, and hit-location rolls, including rerolls. History is kept in this tab until it closes.</p>
      <p id="diagnostics-error" class="diagnostics-error" role="alert"></p>
      <p id="roll-count" aria-live="polite"></p>
      <div id="roll-chart" class="roll-chart" role="img" aria-label="Dice roll totals chart"></div>
      <button id="reset-rolls" class="reset-button" type="button">Reset roll history</button>
    </dialog>
  </main>
`;

app.classList.toggle("compact-results", compactResults);

const history = new RollHistory((message) => {
  getElement("diagnostics-error").textContent = message;
  getElement("open-diagnostics").classList.toggle("diagnostics-has-error", Boolean(message));
  getElement("open-diagnostics").title = message || "Dice roll diagnostics";
}, () => window.sessionStorage);
const diagnosticsDialog = getElement<HTMLDialogElement>("diagnostics-dialog");
const renderRollChart = (): void => {
  const counts = history.counts();
  const maximum = Math.max(...counts, 1);
  const total = counts.reduce((sum, count) => sum + count, 0);
  getElement("roll-count").textContent = `${total} ${total === 1 ? "roll" : "rolls"} recorded`;
  const chart = getElement("roll-chart");
  chart.setAttribute("aria-label", `Dice roll totals: ${counts.map((count, index) => `${index + 2}: ${count}`).join(", ")}`);
  chart.innerHTML = counts.map((count, index) => `
    <div class="roll-chart-row" aria-hidden="true">
      <span class="roll-chart-total">${index + 2}</span>
      <span class="roll-chart-track"><span class="roll-chart-bar" style="width: ${count / maximum * 100}%"></span></span>
      <span class="roll-chart-count">${count}</span>
    </div>
  `).join("");
};

getElement<HTMLButtonElement>("open-diagnostics").addEventListener("click", () => {
  renderRollChart();
  diagnosticsDialog.showModal();
});
getElement<HTMLButtonElement>("close-diagnostics").addEventListener("click", () => diagnosticsDialog.close());
getElement<HTMLButtonElement>("reset-rolls").addEventListener("click", () => {
  history.reset();
  renderRollChart();
});

{
  const gunnery = getElement<HTMLSelectElement>("gunnery");
  const movement = getElement<HTMLSelectElement>("movement");
  const targetMovement = getElement<HTMLSelectElement>("target-movement");
  const other = getElement<HTMLInputElement>("other");
  const range = getElement<HTMLInputElement>("range-to-target");
  const facing = getElement<HTMLSelectElement>("facing");
  const fireButton = getElement<HTMLButtonElement>("fire");

  const updateTargetNumber = (): number => {
    const targetNumber = Number(gunnery.value) + Number(movement.value) + Number(targetMovement.value) +
      Number(other.value || 0);
    getElement("target-number").textContent = `${targetNumber} + Range`;
    return targetNumber;
  };

  const targetRange = (): number | null => {
    const distance = range.valueAsNumber;
    return Number.isInteger(distance) && distance >= 0 && distance <= 25 ? distance : null;
  };

  const updateHeatGenerated = (): void => {
    const selected = activeMech?.weapons.filter((weapon) => selectedWeapons.has(weapon.id)) ?? [];
    const heat = selected.some((weapon) => weapon.heat === null)
      ? "Unknown"
      : selected.reduce((total, weapon) => total + (weapon.heat ?? 0), 0);
    getElement("heat-generated").textContent = `${heat} / ${activeMech?.heatSinkCapacity ?? 0}`;
  };

  const renderWeapons = (): void => {
    if (!activeMech) return;
    const list = getElement("weapon-list");
    if (activeMech.weapons.length === 0) {
      list.innerHTML = `<p class="notice">No weapon rows were recognized in this 'Mech export.</p>`;
      return;
    }
    list.innerHTML = `
      <div class="list-heading"><h3>Weapons</h3><span>${activeMech.weapons.length} listed</span></div>
      <p id="weapon-actions-help" class="field-hint">Press and hold a weapon row to disable or enable it. On a keyboard, focus the row and press D.</p>
      ${activeMech.weapons.map((weapon) => weaponRow(weapon, selectedWeapons.has(weapon.id), targetRange(), disabledWeapons.has(weaponKey(weapon)))).join("")}
      ${Array.from(disabledWeapons).some((key) => !activeMech?.weapons.some((weapon) => weaponKey(weapon) === key))
        ? `<p class="battle-error" role="alert">Some disabled weapons no longer match this mech's design. Their saved state is preserved.</p>` : ""}
    `;
    list.querySelectorAll<HTMLInputElement>("input[data-weapon-id]").forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        const id = checkbox.dataset.weaponId;
        if (!id) return;
        const weapon = activeMech?.weapons.find((item) => item.id === id);
        if (checkbox.checked && weapon && !disabledWeapons.has(weaponKey(weapon))) selectedWeapons.add(id);
        else selectedWeapons.delete(id);
        updateHeatGenerated();
        statusMessage = "";
        renderStatus();
      });
    });
  };

  const toggleWeapon = (id: string): void => {
    const weapon = activeMech?.weapons.find((item) => item.id === id);
    if (!weapon) return;
    const key = weaponKey(weapon);
    const enabling = disabledWeapons.has(key);
    if (!window.confirm(`${enabling ? "Enable" : "Disable"} ${weapon.name} (${weapon.location})?`)) return;
    const next = new Set(disabledWeapons);
    if (enabling) next.delete(key);
    else next.add(key);
    if (!saveDisabledWeapons(Array.from(next))) return;
    disabledWeapons = next;
    selectedWeapons.delete(weapon.id);
    statusMessage = "";
    renderWeapons();
    updateHeatGenerated();
    renderStatus();
  };

  const weaponList = getElement("weapon-list");
  let hold: { id: string; pointer: number; x: number; y: number; timer: number } | null = null;
  let suppressClickUntil = 0;
  const cancelHold = (): void => {
    if (hold) window.clearTimeout(hold.timer);
    hold = null;
  };
  weaponList.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0 || !(event.target instanceof Element)) return;
    const row = event.target.closest<HTMLElement>("[data-weapon-row]");
    const id = row?.dataset.weaponRow;
    if (!id) return;
    cancelHold();
    suppressClickUntil = 0;
    const timer = window.setTimeout(() => {
      hold = null;
      suppressClickUntil = performance.now() + 2000;
      toggleWeapon(id);
    }, 600);
    hold = { id, pointer: event.pointerId, x: event.clientX, y: event.clientY, timer };
  });
  window.addEventListener("pointermove", (event) => {
    if (hold?.pointer === event.pointerId && Math.hypot(event.clientX - hold.x, event.clientY - hold.y) > 10) cancelHold();
  });
  window.addEventListener("pointerup", (event) => {
    if (hold?.pointer === event.pointerId) cancelHold();
  });
  window.addEventListener("pointercancel", (event) => {
    if (hold?.pointer === event.pointerId) cancelHold();
  });
  window.addEventListener("blur", cancelHold);
  weaponList.addEventListener("contextmenu", (event) => {
    if (hold || performance.now() < suppressClickUntil) event.preventDefault();
  });
  weaponList.addEventListener("click", (event) => {
    if (event.detail > 0 && performance.now() < suppressClickUntil) {
      event.preventDefault();
      event.stopPropagation();
      suppressClickUntil = 0;
    }
  }, true);
  weaponList.addEventListener("dblclick", (event) => {
    if (!(event.target instanceof Element)) return;
    const row = event.target.closest<HTMLElement>("[data-weapon-row]");
    if (row?.dataset.weaponRow) {
      event.preventDefault();
      toggleWeapon(row.dataset.weaponRow);
    }
  });
  weaponList.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() !== "d" || event.repeat || !(event.target instanceof Element)) return;
    const row = event.target.closest<HTMLElement>("[data-weapon-row]");
    const id = row?.dataset.weaponRow;
    if (!id) return;
    event.preventDefault();
    toggleWeapon(id);
    weaponList.querySelectorAll<HTMLElement>("[data-weapon-row]").forEach((item) => {
      if (item.dataset.weaponRow === id) item.focus();
    });
  });

  const renderStatus = (): void => {
    getElement("status").textContent = statusMessage;
    getElement("status").classList.toggle("error-text", Boolean(statusMessage));
  };

  const renderResults = (attacks: AttackResult[]): void => {
    const container = getElement("results");
    const totalDamage = attacks.reduce(
      (total, attack) => total + attack.damageLocations.reduce((damage, location) => damage + location.damage, 0),
      0
    );
    getElement("total-damage").textContent = String(totalDamage);
    getElement("psr-required").hidden = totalDamage < 20;
    getElement("location-summary").hidden = attacks.length === 0;
    if (attacks.length === 0) {
      container.className = "results-empty";
      container.textContent = "Your attack results will appear here.";
      getElement("location-damage-list").innerHTML = "";
      renderApplyDamage();
      return;
    }
    container.className = "result-list";
    container.innerHTML = attacks.map((attack) => resultCard(attack, compactResults)).join("");
    getElement("location-summary-facing").textContent = `${resultsFacing} facing`;
    getElement("location-damage-list").innerHTML = summarizeDamageByLocation(attacks, resultsFacing)
      .map(({ location, damage }) => `<div><dt>${escapeHtml(location)}</dt><dd>${damage === 0 ? '<span aria-label="No damage">-</span>' : damage}</dd></div>`)
      .join("");
    renderApplyDamage();
  };

  type DamageTargetState = { record: DamageRecord; error?: never } | { record?: never; error: string };
  type PreparedVolleyDamage = ReturnType<typeof applyDamageByLocation>;

  const damageTargetState = (entry: DamageRosterEntry): DamageTargetState => {
    if (entry.instance.damage) {
      try {
        validateDamageRecord(entry.instance.damage);
        if (entry.instance.damage.sourceMechId !== entry.instance.sourceMechId) {
          return { error: "Saved damage belongs to a different mech design." };
        }
        return { record: entry.instance.damage };
      } catch (error) {
        return { error: error instanceof Error ? error.message : "Saved damage data is invalid." };
      }
    }
    if (!entry.definition) return { error: "Bundled mech design is unavailable." };
    if (!entry.definition.damageProfile) {
      return { error: entry.definition.damageUnavailableReason ?? "Armor or internal-structure data is unavailable." };
    }
    try {
      return { record: createDamageRecord(entry.instance.sourceMechId, entry.definition.damageProfile) };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Damage values could not be initialized." };
    }
  };

  const eligibleDamageTargets = (): DamageRosterEntry[] => {
    const teamId = getCurrentTeamId();
    return teamId ? getDamageRoster().filter((entry) => entry.teamId !== teamId) : [];
  };

  const prepareVolleyDamage = (entry: DamageRosterEntry): PreparedVolleyDamage => {
    const state = damageTargetState(entry);
    if (!state.record) throw new Error(state.error);
    const amounts: Partial<Record<DamageLocationKey, number>> = {};
    for (const { location, damage } of summarizeDamageByLocation(results, resultsFacing)) {
      if (damage === 0) continue;
      const key = damageLocationKeysByName[location];
      if (!key) throw new Error(`Unsupported hit location: ${location}.`);
      amounts[key] = damage;
    }
    const surface: DamageSurface = resultsFacing === "Rear" ? "Rear" : "Front";
    return applyDamageByLocation(state.record, amounts, surface);
  };

  const renderApplyDamage = (): void => {
    const controls = getElement("apply-damage-controls");
    if (results.length === 0) {
      controls.innerHTML = "";
      return;
    }
    const totalDamage = results.reduce((sum, attack) =>
      sum + attack.damageLocations.reduce((damage, hit) => damage + hit.damage, 0), 0);
    const targets = eligibleDamageTargets();
    const hasUsableTarget = targets.some((entry) => Boolean(damageTargetState(entry).record));
    const disabled = volleyDamageApplied || totalDamage === 0 || !hasUsableTarget;
    let message = appliedDamageStatus;
    if (!message && volleyDamageApplied) message = "Damage from this volley has already been applied.";
    else if (!message && totalDamage === 0) message = "This volley caused no damage to apply.";
    else if (!message && !hasUsableTarget) {
      message = targets.length
        ? `No opposing mech has a usable damage record: ${targets.map((entry) => `${entry.teamName} · ${entry.instance.name}: ${damageTargetState(entry).error}`).join("; ")}.`
        : "There are no mechs on another team to target.";
    }
    controls.innerHTML = `
      <div class="apply-damage-actions">
        <button id="open-apply-damage" class="secondary-button" type="button"${disabled ? " disabled" : ""}>Apply Damage</button>
        <p class="apply-damage-status" role="status" aria-live="polite">${escapeHtml(message)}</p>
      </div>`;
  };

  const applyDamageDialog = getElement<HTMLDialogElement>("apply-damage-dialog");

  const renderDamagePreview = (): void => {
    const form = applyDamageDialog.querySelector<HTMLFormElement>("form[data-form='apply-volley-damage']");
    if (!form) return;
    const targetSelect = form.elements.namedItem("target");
    const preview = form.querySelector<HTMLElement>("[data-damage-preview]");
    const error = form.querySelector<HTMLElement>("[data-preview-error]");
    const applyButton = form.querySelector<HTMLButtonElement>("button[type='submit']");
    if (!(targetSelect instanceof HTMLSelectElement) || !preview || !error || !applyButton) return;
    const entry = eligibleDamageTargets().find((candidate) => candidate.instance.id === targetSelect.value);
    if (!entry) {
      preview.innerHTML = "";
      error.textContent = "";
      applyButton.disabled = true;
      return;
    }
    try {
      const prepared = prepareVolleyDamage(entry);
      preview.innerHTML = prepared.applications.length
        ? `<h3>Damage preview · ${escapeHtml(entry.teamName)} · ${escapeHtml(entry.instance.name)}</h3>
          <ul>${prepared.applications.map((application) => {
            const location = prepared.record.locations[application.location];
            const armor = application.surface === "Rear" ? location.rearArmor : location.armor;
            if (!armor) throw new Error(`Rear armor is unavailable at ${application.location}.`);
            const surfaceLabel = application.surface === "Rear" ? "Rear armor" : "Armor";
            return `<li><strong>${damageLocationNames[application.location]}</strong>: ${application.amount} damage; ${surfaceLabel} ${armor.current}/${armor.maximum}, internal ${location.internal.current}/${location.internal.maximum}${application.unapplied ? `; ${application.unapplied} overkill ignored` : ""}.</li>`;
          }).join("")}</ul>`
        : `<p>This volley has no location damage to apply.</p>`;
      error.textContent = "";
      applyButton.disabled = prepared.applications.length === 0;
    } catch (caught) {
      preview.innerHTML = "";
      error.textContent = caught instanceof Error ? caught.message : "Damage preview could not be calculated.";
      applyButton.disabled = true;
    }
  };

  const openApplyDamageDialog = (): void => {
    const targets = eligibleDamageTargets();
    if (volleyDamageApplied || targets.every((entry) => !damageTargetState(entry).record)) return;
    const options = targets.map((entry) => {
      const state = damageTargetState(entry);
      const label = `${entry.teamName} · ${entry.instance.name}`;
      return `<option value="${escapeHtml(entry.instance.id)}"${state.error ? " disabled" : ""}>${escapeHtml(label)}${state.error ? ` — unavailable: ${escapeHtml(state.error)}` : ""}</option>`;
    }).join("");
    applyDamageDialog.innerHTML = `
      <form class="damage-entry-form" data-form="apply-volley-damage">
        <div class="dialog-heading"><h2 id="apply-damage-title">Apply volley damage</h2></div>
        <label class="field"><span>Target mech</span>
          <select name="target" required>
            <option value="" selected disabled>Choose an opposing mech</option>
            ${options}
          </select>
        </label>
        <p class="field-hint">Only mechs on teams other than the attacker's team can be targeted.</p>
        <div class="apply-damage-preview" data-damage-preview></div>
        <p class="damage-dialog-error" data-preview-error role="alert"></p>
        <p class="damage-dialog-error" data-save-error role="alert"></p>
        <div class="dialog-actions">
          <button class="secondary-button" type="submit" disabled>Apply damage</button>
          <button class="secondary-button" type="button" data-action="cancel">Cancel</button>
        </div>
      </form>`;
    applyDamageDialog.showModal();
  };

  getElement("apply-damage-controls").addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest("#open-apply-damage")) openApplyDamageDialog();
  });
  applyDamageDialog.addEventListener("change", (event) => {
    if (event.target instanceof HTMLSelectElement && event.target.name === "target") renderDamagePreview();
  });
  applyDamageDialog.addEventListener("click", (event) => {
    if (event.target instanceof HTMLButtonElement && event.target.dataset.action === "cancel") applyDamageDialog.close();
  });
  applyDamageDialog.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.dataset.form !== "apply-volley-damage") return;
    const targetSelect = form.elements.namedItem("target");
    const saveError = form.querySelector<HTMLElement>("[data-save-error]");
    if (!(targetSelect instanceof HTMLSelectElement) || !saveError) return;
    const target = eligibleDamageTargets().find((entry) => entry.instance.id === targetSelect.value);
    if (!target) {
      saveError.textContent = "The selected target is no longer available.";
      return;
    }
    try {
      const prepared = prepareVolleyDamage(target);
      if (prepared.applications.length === 0) {
        saveError.textContent = "This volley has no location damage to apply.";
        return;
      }
      const persistenceError = saveTargetDamage(target.instance.id, prepared.record);
      if (persistenceError) {
        saveError.textContent = persistenceError;
        return;
      }
      volleyDamageApplied = true;
      const overkill = prepared.applications.reduce((sum, application) => sum + application.unapplied, 0);
      appliedDamageStatus = `Damage applied to ${target.teamName} · ${target.instance.name}.${overkill ? ` ${overkill} excess damage ignored.` : ""}`;
      applyDamageDialog.close();
      renderApplyDamage();
    } catch (error) {
      saveError.textContent = error instanceof Error ? error.message : "Damage could not be applied.";
    }
  });

  mobileBreakpoint.addEventListener("change", () => {
    compactResults = mobileBreakpoint.matches || mobileUserAgent;
    app.classList.toggle("compact-results", compactResults);
    renderResults(results);
  });

  const damageTracking = setupDamageTracking(() => {
    getElement("damage-screen").hidden = true;
    getElement("attack-screen").hidden = !activeMech;
  });

  setupBattles(mechs, (mech, savedDisabled, saveDisabled, roster, currentTeamId, saveDamage) => {
    activeMech = mech;
    disabledWeapons = new Set(savedDisabled);
    saveDisabledWeapons = saveDisabled;
    getDamageRoster = roster;
    getCurrentTeamId = currentTeamId;
    saveTargetDamage = saveDamage;
    damageTracking.updateContext(roster, saveDamage);
    getElement("attack-screen").hidden = !mech;
    getElement("attacker-name").textContent = mech?.name ?? "";
    range.value = "6";
    range.setCustomValidity("");
    getElement("range-help").textContent = "Enter 0 to 25 hexes. Changing range selects short-range weapons.";
    gunnery.value = "4";
    movement.value = "2";
    targetMovement.value = "2";
    other.value = "0";
    facing.value = "Front";
    selectedWeapons = shortRangeWeapons(activeMech, 6, disabledWeapons);
    results = [];
    resultsFacing = "Front";
    volleyDamageApplied = false;
    appliedDamageStatus = "";
    statusMessage = "";
    renderWeapons();
    updateHeatGenerated();
    updateTargetNumber();
    renderStatus();
    renderResults(results);
    if (!getElement("damage-screen").hidden) damageTracking.render();
  }, (visible) => {
    getElement("attack-screen").hidden = visible || !activeMech;
    getElement("damage-screen").hidden = !visible;
    if (visible) damageTracking.render();
  });

  range.addEventListener("input", () => {
    const distance = targetRange();
    if (distance !== null) selectedWeapons = shortRangeWeapons(activeMech, distance, disabledWeapons);
    range.setCustomValidity(distance === null ? "Enter a whole number from 0 to 25." : "");
    getElement("range-help").textContent = distance === null
      ? "Enter a whole number from 0 to 25 hexes."
      : "Enter 0 to 25 hexes. Changing range selects short-range weapons.";
    renderWeapons();
    updateHeatGenerated();
    statusMessage = "";
    renderStatus();
  });

  [gunnery, movement, targetMovement, other].forEach((control) => {
    control.addEventListener("input", updateTargetNumber);
    control.addEventListener("change", updateTargetNumber);
  });

  fireButton.addEventListener("click", () => {
    const distance = targetRange();
    if (distance === null) {
      range.reportValidity();
      statusMessage = "Range to target must be a whole number from 0 to 25.";
      renderStatus();
      return;
    }
    const selected = activeMech?.weapons.filter((weapon) => selectedWeapons.has(weapon.id) && !disabledWeapons.has(weaponKey(weapon))) ?? [];
    if (selected.length === 0) {
      statusMessage = "Select at least one weapon to fire.";
      renderStatus();
      return;
    }
    const unsupported = selected.find((weapon) => !weapon.profile);
    if (unsupported) {
      statusMessage = `${unsupported.name} is not supported yet. Deselect it to fire the other weapons.`;
      renderStatus();
      return;
    }
    const unavailable = selected.find((weapon) => !weapon.ranges || getWeaponRange(weapon.ranges, distance).modifier === null);
    if (unavailable) {
      statusMessage = `${unavailable.name} is out of range or has no range data.`;
      renderStatus();
      return;
    }
    const targetNumber = updateTargetNumber();
    resultsFacing = facing.value as Facing;
    results = selected.map((weapon) => {
      if (!weapon.ranges) throw new Error(`Missing range data for ${weapon.name}.`);
      const modifier = getWeaponRange(weapon.ranges, distance).modifier;
      if (modifier === null) throw new Error(`${weapon.name} is out of range.`);
      return resolveAttack(weapon, weaponTargetNumber(targetNumber, modifier, weapon), resultsFacing, undefined, (total) => history.record(total));
    });
    volleyDamageApplied = false;
    appliedDamageStatus = "";
    statusMessage = "";
    renderStatus();
    renderResults(results);
    getElement("results-title").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  renderWeapons();
  updateHeatGenerated();
  updateTargetNumber();
}

function weaponKey(weapon: Weapon): string {
  return JSON.stringify([weapon.id, weapon.name, weapon.location, weapon.techBase ?? null]);
}

function shortRangeWeapons(mech: Mech | undefined, distance: number, disabled: Set<string>): Set<string> {
  return new Set(mech?.weapons
    .filter((weapon) => !disabled.has(weaponKey(weapon)) && weapon.profile && weapon.ranges && getWeaponRange(weapon.ranges, distance).band === "Short")
    .map((weapon) => weapon.id) ?? []);
}

function weaponRow(weapon: Weapon, checked: boolean, distance: number | null, disabledByUser: boolean): string {
  const details = weapon.profile
    ? weapon.profile.kind === "direct"
      ? `${weapon.profile.damage} damage`
      : weapon.profile.kind === "cluster"
        ? `${weapon.profile.rackSize}-missile rack`
        : "No direct damage"
    : weapon.unavailableReason ?? "Unsupported weapon";
  const range = weapon.ranges && distance !== null ? getWeaponRange(weapon.ranges, distance) : null;
  const rangeText = !weapon.ranges ? "Range data unavailable"
    : !range ? "Enter a valid range"
      : range.modifier === null ? range.band : `${range.band} (+${range.modifier})`;
  const disabled = disabledByUser || !weapon.profile || !range || range.modifier === null;
  return `
    <div class="weapon-row${weapon.profile ? "" : " unsupported"}${disabledByUser ? " weapon-disabled" : ""}" data-weapon-row="${escapeHtml(weapon.id)}" tabindex="0" role="group" aria-label="${escapeHtml(weapon.name)} ${escapeHtml(weapon.location)}${disabledByUser ? ", disabled" : ""}" aria-describedby="weapon-actions-help">
      <label class="weapon-selection">
        <input type="checkbox" data-weapon-id="${escapeHtml(weapon.id)}"${checked && !disabled ? " checked" : ""}${disabled ? " disabled" : ""} />
        <span class="weapon-name">${escapeHtml(weapon.name)} <span class="weapon-location">${escapeHtml(weapon.location)}</span>${disabledByUser ? ' <span class="weapon-disabled-label">Disabled</span>' : ""}</span>
        <span class="weapon-detail">${weapon.techBase ?? "Unknown tech"} · ${escapeHtml(details)}${weapon.attackModifier ? ` · hit ${weapon.attackModifier > 0 ? "+" : ""}${weapon.attackModifier}` : ""} · ${rangeText}</span>
      </label>
    </div>
  `;
}

function resultCard(attack: AttackResult, compact: boolean): string {
  const dice = `${attack.hitDice[0]} + ${attack.hitDice[1]} = ${attack.hitRoll}`;
  let detail: string;
  const damageTotal = attack.damageLocations.reduce((sum, location) => sum + location.damage, 0);
  if (!attack.hit) {
    detail = `<p class="result-outcome miss">Miss · no damage</p>`;
  } else if (attack.weapon.profile?.kind === "utility") {
    detail = `<p class="result-outcome hit">Hit · no direct damage</p>`;
  } else {
    const clusterText = attack.projectilesHit === undefined
      ? ""
      : `<p class="cluster-detail">Cluster roll ${attack.clusterRoll}: ${attack.projectilesHit} missiles hit</p>`;
    const locations = attack.damageLocations.length === 0
      ? `<p class="result-outcome hit">Hit · no missiles struck</p>`
      : `<ul class="damage-list">${attack.damageLocations.map((location) => `
          <li><strong>${location.damage} damage</strong> → ${escapeHtml(location.location)}
            ${location.critical ? `<span class="critical">CRITICAL</span>` : ""}
            <span class="dice-note">(location roll ${location.locationRoll}${location.reroll ? `, floating crit reroll ${location.reroll}` : ""})</span>
          </li>`).join("")}</ul>`;
    detail = `<p class="result-outcome hit">Hit · ${damageTotal} total damage</p>${clusterText}${locations}`;
  }
  const expandedContent = `
      <div class="result-heading"><h3>${escapeHtml(attack.weapon.name)} <span>${escapeHtml(attack.weapon.location)}</span></h3><span class="tn">TN ${attack.targetNumber}</span></div>
      <p class="roll-detail">To-hit roll: ${dice}</p>
      ${detail}
  `;
  if (!compact) return `<article class="result-card">${expandedContent}</article>`;

  const locationSummary = attack.damageLocations.map((location) =>
    `${location.damage} to ${escapeHtml(location.location)}${location.critical ? " (crit)" : ""}`
  ).join(", ");
  const damageSummary = locationSummary
    ? `Total ${damageTotal} damage · ${locationSummary}`
    : attack.projectilesHit === 0
      ? "0 damage · No missiles hit"
      : "0 damage · No location";
  return `
    <details class="result-card compact-result">
      <summary class="compact-summary">
        <span class="compact-name">${escapeHtml(attack.weapon.name)}</span>
        <span class="compact-outcome ${attack.hit ? "hit" : "miss"}">${attack.hit ? "Hit" : "Miss"}</span>
        <span class="compact-damage-location">${damageSummary}</span>
      </summary>
      <div class="compact-details">${expandedContent}</div>
    </details>
  `;
}

function getElement<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Required application element "${id}" is missing.`);
  return element as T;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character] ?? character);
}
