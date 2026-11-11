import "./style.css";
import { getWeaponRange, parseMechs, resolveAttack, summarizeDamageByLocation, type AttackResult, type Facing, type Mech, type Weapon } from "./game";
import { RollHistory } from "./roll-history";

const mechFiles = import.meta.glob(["../mechs/**/*.txt", "../mechs/**/*.mtf"], { eager: true, query: "?raw", import: "default" }) as Record<string, string>;
const mechs = parseMechs(mechFiles);
const app = document.querySelector<HTMLDivElement>("#app");
const mobileBreakpoint = window.matchMedia("(max-width: 768px)");
const mobileUserAgent = /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(navigator.userAgent);

if (!app) throw new Error("The application root element is missing.");

let activeMech: Mech | undefined = mechs[0];
let selectedWeapons = shortRangeWeapons(activeMech, 6);
let results: AttackResult[] = [];
let resultsFacing: Facing = "Front";
let statusMessage = "";
let compactResults = mobileBreakpoint.matches || mobileUserAgent;

app.innerHTML = `
  <main class="shell">
    <header class="hero">
      <p class="eyebrow">BATTLETECH · QUICK ATTACK ROLLER</p>
      <h1>Box of Doom</h1>
      <p class="intro">Pick a 'Mech, set your GATOR modifiers, and resolve your volley.</p>
    </header>
    ${mechs.length === 0 ? `<p class="notice error">No .txt or .mtf 'Mech files were found in the mechs folder.</p>` : `
      <section class="panel" aria-labelledby="attacker-title">
        <h2 id="attacker-title">Attacker</h2>
        <label class="field">
          <span>'Mech</span>
          <select id="mech-select">${mechs.map((mech, index) => `<option value="${escapeHtml(mech.id)}"${index === 0 ? " selected" : ""}>${escapeHtml(mech.name)}${mechs.some((other) => other !== mech && other.name === mech.name) ? ` (${escapeHtml(mech.id.replace(/^\.\.\/mechs\//, ""))})` : ""}</option>`).join("")}</select>
        </label>
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
      </section>
    `}
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

if (mechs.length > 0) {
  const mechSelect = getElement<HTMLSelectElement>("mech-select");
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
      ${activeMech.weapons.map((weapon) => weaponRow(weapon, selectedWeapons.has(weapon.id), targetRange())).join("")}
    `;
    list.querySelectorAll<HTMLInputElement>("input[data-weapon-id]").forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        const id = checkbox.dataset.weaponId;
        if (!id) return;
        if (checkbox.checked) selectedWeapons.add(id);
        else selectedWeapons.delete(id);
        updateHeatGenerated();
        statusMessage = "";
        renderStatus();
      });
    });
  };

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
      return;
    }
    container.className = "result-list";
    container.innerHTML = attacks.map((attack) => resultCard(attack, compactResults)).join("");
    getElement("location-summary-facing").textContent = `${resultsFacing} facing`;
    getElement("location-damage-list").innerHTML = summarizeDamageByLocation(attacks, resultsFacing)
      .map(({ location, damage }) => `<div><dt>${escapeHtml(location)}</dt><dd>${damage === 0 ? '<span aria-label="No damage">-</span>' : damage}</dd></div>`)
      .join("");
  };

  mobileBreakpoint.addEventListener("change", () => {
    compactResults = mobileBreakpoint.matches || mobileUserAgent;
    app.classList.toggle("compact-results", compactResults);
    renderResults(results);
  });

  mechSelect.addEventListener("change", () => {
    activeMech = mechs.find((mech) => mech.id === mechSelect.value);
    const distance = targetRange();
    selectedWeapons = distance === null ? new Set() : shortRangeWeapons(activeMech, distance);
    results = [];
    statusMessage = "";
    renderWeapons();
    updateHeatGenerated();
    renderStatus();
    renderResults(results);
  });

  range.addEventListener("input", () => {
    const distance = targetRange();
    if (distance !== null) selectedWeapons = shortRangeWeapons(activeMech, distance);
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
    const selected = activeMech?.weapons.filter((weapon) => selectedWeapons.has(weapon.id)) ?? [];
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
      return resolveAttack(weapon, targetNumber + modifier, resultsFacing, undefined, (total) => history.record(total));
    });
    statusMessage = "";
    renderStatus();
    renderResults(results);
    getElement("results-title").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  renderWeapons();
  updateHeatGenerated();
  updateTargetNumber();
}

function shortRangeWeapons(mech: Mech | undefined, distance: number): Set<string> {
  return new Set(mech?.weapons
    .filter((weapon) => weapon.profile && weapon.ranges && getWeaponRange(weapon.ranges, distance).band === "Short")
    .map((weapon) => weapon.id) ?? []);
}

function weaponRow(weapon: Weapon, checked: boolean, distance: number | null): string {
  const details = weapon.profile
    ? weapon.profile.kind === "direct"
      ? `${weapon.profile.damage} damage`
      : weapon.profile.kind === "cluster"
        ? `${weapon.profile.rackSize}-missile rack`
        : "No direct damage"
    : "Unsupported weapon";
  const range = weapon.ranges && distance !== null ? getWeaponRange(weapon.ranges, distance) : null;
  const rangeText = !weapon.ranges ? "Range data unavailable"
    : !range ? "Enter a valid range"
      : range.modifier === null ? range.band : `${range.band} (+${range.modifier})`;
  const disabled = !weapon.profile || !range || range.modifier === null;
  return `
    <label class="weapon-row${weapon.profile ? "" : " unsupported"}">
      <input type="checkbox" data-weapon-id="${escapeHtml(weapon.id)}"${checked ? " checked" : ""}${disabled ? " disabled" : ""} />
      <span class="weapon-name">${escapeHtml(weapon.name)} <span class="weapon-location">${escapeHtml(weapon.location)}</span></span>
      <span class="weapon-detail">${details} · ${rangeText}</span>
    </label>
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
