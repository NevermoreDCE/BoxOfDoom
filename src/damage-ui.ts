import armorDiagram from "../docs/design/diagrams/ArmorDiagram.svg?raw";
import internalsDiagram from "../docs/design/diagrams/InternalsDiagram.svg?raw";
import {
  DAMAGE_LOCATION_KEYS,
  applyDamage,
  createDamageRecord,
  damageProfileFingerprint,
  damageFill,
  getDamageTotals,
  restoreDamage,
  type DamageLocationKey,
  type DamageRecord,
  type DamageSurface
} from "./damage";
import type { DamageRosterEntry } from "./battle-ui";

const locationNames: Record<DamageLocationKey, string> = {
  head: "Head",
  "center-torso": "Center Torso",
  "left-torso": "Left Torso",
  "right-torso": "Right Torso",
  "left-arm": "Left Arm",
  "right-arm": "Right Arm",
  "left-leg": "Left Leg",
  "right-leg": "Right Leg"
};
const rearContextLocations: DamageLocationKey[] = ["head", "left-arm", "right-arm", "left-leg", "right-leg"];
const hitChartLocationOrder: DamageLocationKey[] = [
  "right-arm", "right-leg", "right-torso", "center-torso",
  "left-torso", "left-leg", "left-arm", "head"
];

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character] ?? character);
}

function inlineSvg(raw: string): string {
  return raw.replace(/^\s*<\?xml[^?]*\?>\s*/, "").replace(/<!--[\s\S]*?-->/g, "");
}

export function setupDamageTracking(onBack: () => void): {
  updateContext: (getRoster: () => DamageRosterEntry[], saveDamage: (mechId: string, damage: DamageRecord) => string | undefined) => void;
  render: () => void;
} {
  const screen = document.querySelector<HTMLElement>("#damage-screen");
  if (!screen) throw new Error("Damage tracking screen is missing.");

  let getRoster: () => DamageRosterEntry[] = () => [];
  let saveDamage: (mechId: string, damage: DamageRecord) => string | undefined = () => "Damage storage is unavailable.";
  let selectedMechId = "";
  let selectedTab: "Front" | "Rear" | "Internal" = "Front";
  let statusMessage = "";
  const dialog = document.createElement("dialog");
  dialog.className = "damage-dialog";
  dialog.setAttribute("aria-labelledby", "damage-dialog-title");
  document.body.append(dialog);
  let pending: { entry: DamageRosterEntry; location: DamageLocationKey; record: DamageRecord } | undefined;

  const currentEntry = (): DamageRosterEntry | undefined =>
    getRoster().find((entry) => entry.instance.id === selectedMechId);

  const diagramMarkup = (): string => selectedTab === "Internal" ? inlineSvg(internalsDiagram) : inlineSvg(armorDiagram);

  const render = (): void => {
    const roster = getRoster();
    if (!roster.some((entry) => entry.instance.id === selectedMechId)) selectedMechId = roster[0]?.instance.id ?? "";
    let entry = currentEntry();
    if (!entry) {
      screen.innerHTML = `
        <section class="panel damage-panel">
          <div class="damage-screen-heading"><h2>Damage tracking</h2><button class="secondary-button" type="button" data-action="back">Back to attack</button></div>
          <p class="notice">Add a 'Mech to this Battle to track its damage.</p>
        </section>`;
      return;
    }

    let record = entry.instance.damage;
    let initializationError = "";
    if (!record && entry.definition?.damageProfile) {
      record = createDamageRecord(entry.instance.sourceMechId, entry.definition.damageProfile);
      const error = saveDamage(entry.instance.id, record);
      if (error) {
        initializationError = error;
        statusMessage = error;
        record = null;
      }
      else entry = currentEntry() ?? entry;
      record = entry.instance.damage ?? record;
    }
    const unsupportedReason = initializationError ||
      (record && record.sourceMechId !== entry.instance.sourceMechId ? "Saved damage belongs to a different mech design."
        : !record && !entry.definition ? "This bundled mech design is unavailable."
          : !record && !entry.definition?.damageProfile ? entry.definition?.damageUnavailableReason ?? "Armor or internal-structure data is unavailable."
            : !record ? "Damage values could not be initialized." : "");
    const usableRecord = !unsupportedReason ? record : null;
    const designChanged = Boolean(usableRecord && entry.definition?.damageProfile &&
      usableRecord.sourceProfileFingerprint !== damageProfileFingerprint(entry.instance.sourceMechId, entry.definition.damageProfile));
    const designUnavailable = Boolean(usableRecord && (!entry.definition || !entry.definition.damageProfile));
    const totals = usableRecord ? getDamageTotals(usableRecord) : null;
    const teamOptions = roster.map((member) => `
      <option value="${escapeHtml(member.instance.id)}"${member.instance.id === selectedMechId ? " selected" : ""}>
        ${escapeHtml(member.teamName)} · ${escapeHtml(member.instance.name)}${member.definition ? ` — ${escapeHtml(member.definition.name)}` : " — design unavailable"}
      </option>`).join("");
    const visibleKeys = selectedTab === "Rear"
      ? hitChartLocationOrder.filter((key) => key === "center-torso" || key === "left-torso" || key === "right-torso")
      : hitChartLocationOrder;
    const locationRows = usableRecord ? visibleKeys.map((key) => {
      const location = usableRecord.locations[key];
      const displayedArmor = selectedTab === "Rear" && location.rearArmor ? location.rearArmor : location.armor;
      const armorLabel = selectedTab === "Rear" && location.rearArmor ? "Rear armor" : "Front armor";
      return `<button type="button" class="damage-location-row" data-action="apply" data-location="${key}">
        <span class="damage-location-name">${locationNames[key]}</span>
        <span>${armorLabel}: ${displayedArmor.current}/${displayedArmor.maximum} · Internal: ${location.internal.current}/${location.internal.maximum}</span>
      </button>`;
    }).join("") : "";
    const viewTitle = selectedTab === "Internal" ? "Internal structure" : `${selectedTab} armor`;
    const svg = usableRecord ? diagramMarkup() : "";
    screen.innerHTML = `
      <section class="panel damage-panel">
        <div class="damage-screen-heading"><h2>Damage tracking</h2><button class="secondary-button" type="button" data-action="back">Back to attack</button></div>
        <label class="field damage-mech-picker"><span>Team / 'Mech</span><select data-action="select-mech">${teamOptions}</select></label>
        ${unsupportedReason ? `<p class="battle-error" role="alert">${escapeHtml(unsupportedReason)}</p>` : ""}
        ${designUnavailable ? `<p class="notice" role="status">The bundled design data is unavailable. This saved damage record remains usable.</p>` : ""}
        ${designChanged ? `<p class="notice" role="status">The bundled design data changed after this damage record was created. Saved maximums and damage are preserved.</p>` : ""}
        ${totals ? `<p class="damage-totals" aria-live="polite">Armor ${totals.armor.current}/${totals.armor.maximum} · Internal ${totals.internal.current}/${totals.internal.maximum}</p>` : ""}
        <div class="damage-tabs" role="tablist" aria-label="Damage diagram">
          ${(["Front", "Rear", "Internal"] as const).map((tab) =>
            `<button type="button" role="tab" aria-selected="${selectedTab === tab}" class="damage-tab${selectedTab === tab ? " active" : ""}" data-action="tab" data-tab="${tab}">${tab === "Internal" ? "Internal structure" : `${tab} armor`}</button>`
          ).join("")}
        </div>
        ${usableRecord ? `<h3 class="damage-view-title">${viewTitle}</h3>
          <div class="damage-diagram">${svg}</div>
          <div class="damage-location-list" aria-label="${viewTitle} values">${locationRows}</div>
          <p class="field-hint">Select a location to apply damage. Damage reduces the selected armor first, then that location's internal structure.</p>
          <p class="damage-status" role="status" aria-live="polite">${escapeHtml(statusMessage)}</p>
          <button type="button" class="danger-button" data-action="restore">Restore original armor and internals</button>` : ""}
      </section>`;

    if (usableRecord) initializeDiagram(screen, usableRecord);
  };

  const initializeDiagram = (root: HTMLElement, record: DamageRecord): void => {
    const paths = new Map<DamageLocationKey, SVGGraphicsElement>();
    for (const key of DAMAGE_LOCATION_KEYS) {
      const svgId = selectedTab === "Internal" ? `${key}-internal` : key;
      const path = root.querySelector<SVGGraphicsElement>(`.damage-diagram #${svgId}`);
      if (path) paths.set(key, path);
    }
    const svgContainer = root.querySelector<HTMLElement>(".damage-diagram");
    const svgRoot = svgContainer?.querySelector("svg");
    if (!svgRoot || paths.size !== DAMAGE_LOCATION_KEYS.length) {
      if (svgContainer) svgContainer.hidden = true;
      root.querySelector(".damage-location-list")?.classList.add("list-only");
      return;
    }
    svgRoot.removeAttribute("width");
    svgRoot.removeAttribute("height");
    svgRoot.setAttribute("preserveAspectRatio", "xMidYMin meet");
    svgRoot.setAttribute("role", "group");
    svgRoot.setAttribute("aria-label", selectedTab === "Internal" ? "Internal structure locations" : `${selectedTab} armor locations`);

    const overlay = document.createElementNS("http://www.w3.org/2000/svg", "g");
    overlay.setAttribute("aria-hidden", "true");
    overlay.setAttribute("class", "damage-value-overlays");
    overlay.setAttribute("pointer-events", "none");

    for (const key of DAMAGE_LOCATION_KEYS) {
      const path = paths.get(key);
      if (!path) continue;
      const location = record.locations[key];
      const surface = selectedTab === "Rear" && location.rearArmor ? location.rearArmor
        : selectedTab === "Internal" ? location.internal : location.armor;
      const fill = damageFill(surface.maximum > 0 ? surface.current / surface.maximum * 100 : 0);
      path.style.fill = fill.color;
      path.style.fillOpacity = String(fill.opacity);
      path.setAttribute("data-damage-location", key);
      path.setAttribute("role", "button");
      path.setAttribute("tabindex", "0");
      const label = selectedTab === "Internal" ? "internal structure"
        : selectedTab === "Rear" ? "rear armor" : "front armor";
      path.setAttribute("aria-label", `${locationNames[key]}, ${label} ${surface.current} of ${surface.maximum}. Apply damage.`);

      const bounds = path.getBBox();
      const value = document.createElementNS("http://www.w3.org/2000/svg", "text");
      value.setAttribute("x", String(bounds.x + bounds.width / 2));
      const verticalPosition = key === "left-torso" || key === "right-torso"
        ? bounds.y + bounds.height * 0.25
        : bounds.y + bounds.height / 2;
      value.setAttribute("y", String(verticalPosition));
      value.setAttribute("class", "damage-diagram-value");
      value.setAttribute("text-anchor", "middle");
      value.setAttribute("dominant-baseline", "central");
      value.textContent = `${surface.current} / ${surface.maximum}`;
      overlay.append(value);
    }
    svgRoot.append(overlay);
    if (selectedTab === "Rear") {
      for (const key of rearContextLocations) {
        const path = paths.get(key);
        if (!path) continue;
        path.style.opacity = "0.2";
        path.removeAttribute("role");
        path.removeAttribute("tabindex");
        path.removeAttribute("data-damage-location");
        path.setAttribute("aria-hidden", "true");
        path.setAttribute("pointer-events", "none");
      }
    }
  };

  const openDialog = (location: DamageLocationKey): void => {
    const entry = currentEntry();
    const record = entry?.instance.damage;
    if (!entry || !record) return;
    pending = { entry, location, record };
    const rear = record.locations[location].rearArmor;
    dialog.innerHTML = `
      <form class="damage-entry-form">
        <div class="dialog-heading"><h2 id="damage-dialog-title">Apply damage · ${escapeHtml(locationNames[location])}</h2></div>
        <p>Damage reduces armor first, then internal structure at this location. Excess damage is not transferred.</p>
        ${rear ? `<label class="field"><span>Armor facing</span><select name="surface"><option value="Front" selected>Front</option><option value="Rear">Rear</option></select></label>` : ""}
        <label class="field"><span>Damage amount</span><input name="amount" type="number" min="0" max="9007199254740991" step="1" required inputmode="numeric" /></label>
        <p class="damage-dialog-error" role="alert"></p>
        <div class="dialog-actions"><button class="secondary-button" type="submit">Apply damage</button><button class="secondary-button" type="button" data-action="cancel">Cancel</button></div>
      </form>`;
    dialog.showModal();
    dialog.querySelector<HTMLInputElement>('input[name="amount"]')?.focus();
  };

  screen.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    if (target.dataset.action === "select-mech") {
      selectedMechId = target.value;
      statusMessage = "";
      render();
    }
  });
  screen.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const path = target.closest<SVGElement>("[data-damage-location]");
    if (path?.getAttribute("data-damage-location")) {
      openDialog(path.getAttribute("data-damage-location") as DamageLocationKey);
      return;
    }
    const button = target.closest<HTMLButtonElement>("button[data-action]");
    if (!button) return;
    if (button.dataset.action === "back") onBack();
    else if (button.dataset.action === "tab" && (button.dataset.tab === "Front" || button.dataset.tab === "Rear" || button.dataset.tab === "Internal")) {
      selectedTab = button.dataset.tab;
      statusMessage = "";
      render();
    } else if (button.dataset.action === "apply" && button.dataset.location) {
      openDialog(button.dataset.location as DamageLocationKey);
    } else if (button.dataset.action === "restore") {
      const entry = currentEntry();
      const record = entry?.instance.damage;
      if (!entry || !record || !window.confirm(`Restore ${entry.instance.name} to its original armor and internal values?`)) return;
      const error = saveDamage(entry.instance.id, restoreDamage(record));
      statusMessage = error ?? "Damage values restored.";
      render();
    }
  });
  screen.addEventListener("keydown", (event) => {
    if (!(event.target instanceof SVGElement) || !event.target.hasAttribute("data-damage-location") ||
        (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    const location = event.target.getAttribute("data-damage-location") as DamageLocationKey | null;
    if (location) openDialog(location);
  });
  dialog.addEventListener("click", (event) => {
    if (event.target instanceof HTMLButtonElement && event.target.dataset.action === "cancel") dialog.close();
  });
  dialog.addEventListener("close", () => { pending = undefined; });
  dialog.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !pending) return;
    const input = form.elements.namedItem("amount");
    if (!(input instanceof HTMLInputElement)) return;
    if (!/^\d+$/.test(input.value)) {
      const error = dialog.querySelector<HTMLElement>(".damage-dialog-error");
      if (error) error.textContent = "Enter a non-negative whole number.";
      input.focus();
      return;
    }
    const amount = Number(input.value);
    if (!Number.isSafeInteger(amount)) {
      const error = dialog.querySelector<HTMLElement>(".damage-dialog-error");
      if (error) error.textContent = "Enter a safe whole number.";
      input.focus();
      return;
    }
    const surfaceInput = form.elements.namedItem("surface");
    const surface: DamageSurface = surfaceInput instanceof HTMLSelectElement && surfaceInput.value === "Rear" ? "Rear" : "Front";
    const result = applyDamage(pending.record, pending.location, amount, surface);
    const error = saveDamage(pending.entry.instance.id, result.record);
    if (error) {
      const message = dialog.querySelector<HTMLElement>(".damage-dialog-error");
      if (message) message.textContent = error;
      return;
    }
    const name = locationNames[pending.location];
    statusMessage = result.unapplied
      ? `${amount - result.unapplied} damage applied to ${name}; ${result.unapplied} excess damage ignored.`
      : `${amount} damage applied to ${name}.`;
    dialog.close();
    render();
  });

  return {
    updateContext: (roster, save) => {
      getRoster = roster;
      saveDamage = save;
    },
    render
  };
}
