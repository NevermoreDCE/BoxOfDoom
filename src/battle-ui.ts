import { BattleStore, TEAM_COLORS, defaultMechName, type Battle, type BattleData } from "./battles";
import type { Mech } from "./game";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character] ?? character);
}

function id(): string {
  return crypto.randomUUID();
}

export function setupBattles(
  mechs: Mech[],
  onSelect: (mech: Mech | undefined, disabledWeapons: string[], saveDisabled: (keys: string[]) => boolean) => void
): void {
  const controls = document.querySelector<HTMLElement>("#battle-controls");
  const picker = document.querySelector<HTMLDialogElement>("#battle-dialog");
  const manager = document.querySelector<HTMLDialogElement>("#roster-dialog");
  if (!controls || !picker || !manager) throw new Error("Battle interface is missing.");

  let store: BattleStore;
  try {
    store = new BattleStore(window.localStorage);
  } catch (error) {
    console.error("Could not load Battles:", error);
    controls.innerHTML = `<p class="error" role="alert">Battles could not be loaded. Check browser storage and reload. Saved data has not been changed.</p>`;
    onSelect(undefined, [], () => false);
    return;
  }

  let selectedId = "";
  let errorMessage = "";
  const activeBattle = (): Battle | undefined => store.data.battles.find((battle) => battle.id === store.data.activeBattleId);
  const findBattle = (data: BattleData): Battle => {
    const battle = data.battles.find((item) => item.id === data.activeBattleId);
    if (!battle) throw new Error("No Battle is open.");
    return battle;
  };
  const paletteOptions = (selected?: string, used: string[] = []): string => TEAM_COLORS.map((color, index) =>
    `<option value="${color}"${color === selected ? " selected" : ""}${used.includes(color) && color !== selected ? " disabled" : ""}>Color ${index + 1} (${color})</option>`
  ).join("");
  const colorField = (selected?: string, used: string[] = []): string => {
    const color = selected ?? TEAM_COLORS.find((item) => !used.includes(item)) ?? TEAM_COLORS[0];
    return `<label class="field"><span>Team color <span class="team-color color-preview" data-color-preview style="background:${color}"></span></span><select name="color">${paletteOptions(color, used)}</select></label>`;
  };
  const showError = (): void => {
    for (const element of document.querySelectorAll<HTMLElement>("[data-battle-error]")) {
      element.textContent = errorMessage;
      element.hidden = !errorMessage;
    }
  };
  const save = (change: (data: BattleData) => void): boolean => {
    try {
      store.update(change);
      errorMessage = "";
      showError();
      return true;
    } catch (error) {
      console.error("Could not save Battle:", error);
      errorMessage = error instanceof Error ? error.message : "Battle could not be saved.";
      showError();
      return false;
    }
  };

  const selectCurrent = (force = false): void => {
    const battle = activeBattle();
    const all = battle?.teams.flatMap((team) => team.mechs) ?? [];
    const previous = selectedId;
    if (!all.some((mech) => mech.id === selectedId)) selectedId = all[0]?.id ?? "";
    if (force || previous !== selectedId) {
      const instance = all.find((mech) => mech.id === selectedId);
      const instanceId = instance?.id;
      onSelect(mechs.find((mech) => mech.id === instance?.sourceMechId), instance?.disabledWeapons ?? [], (keys) =>
        save((data) => {
          const current = findBattle(data).teams.flatMap((team) => team.mechs).find((mech) => mech.id === instanceId);
          if (!current || selectedId !== instanceId) throw new Error("The selected mech is no longer available.");
          current.disabledWeapons = keys;
        }));
    }
  };

  const render = (): void => {
    const battle = activeBattle();
    const alert = `<p class="battle-error" data-battle-error role="alert"${errorMessage ? "" : " hidden"}>${escapeHtml(errorMessage)}</p>`;
    const options = battle?.teams.map((team) => `
      <optgroup label="${escapeHtml(team.name)}">${team.mechs.map((mech) => {
        const definition = mechs.find((item) => item.id === mech.sourceMechId);
        return `<option value="${escapeHtml(mech.id)}"${mech.id === selectedId ? " selected" : ""}>${escapeHtml(mech.name)}${definition ? ` — ${escapeHtml(definition.name)}` : " — design unavailable"}</option>`;
      }).join("")}</optgroup>`).join("") ?? "";
    const selected = battle?.teams.flatMap((team) => team.mechs).find((mech) => mech.id === selectedId);
    const missing = selected && !mechs.some((mech) => mech.id === selected.sourceMechId);
    controls.innerHTML = battle ? `
      <div class="battle-heading"><h2>Battle: ${escapeHtml(battle.name)}</h2>
        <button type="button" class="icon-button" data-action="pick" aria-label="Switch Battle" title="Switch Battle">&#8644;</button></div>
      ${alert}
      <label class="field"><span>Team / 'Mech</span><select id="battle-mech-select"${selectedId ? "" : " disabled"}>${selectedId ? options : '<option>No mechs in this Battle</option>'}</select></label>
      ${missing ? `<p class="battle-error" role="alert">This mech's bundled design is unavailable. Its roster entry is preserved; remove it or restore the original design file.</p>` : ""}
      <button class="secondary-button" type="button" data-action="manage">Manage Battle and roster</button>
    ` : `<p class="notice">Choose or create a Battle to begin.</p>${alert}<button class="secondary-button" type="button" data-action="pick">Choose Battle</button>`;

    picker.innerHTML = `
      <div class="dialog-heading"><h2>Choose a Battle</h2>${battle ? '<button type="button" class="icon-button" data-action="close-picker" aria-label="Close">&times;</button>' : ""}</div>
      ${alert}
      ${store.data.battles.length ? `<div class="battle-list">${store.data.battles.map((item) =>
        `<button type="button" class="secondary-button" data-action="open" data-id="${escapeHtml(item.id)}">${escapeHtml(item.name)}${item.id === battle?.id ? " (open)" : ""}</button>`
      ).join("")}</div>` : `<p class="notice">No saved Battles yet.</p>`}
      <form data-form="create-battle" class="battle-form">
        <h3>Create a Battle</h3>
        <label class="field"><span>Battle name</span><input name="name" required maxlength="100" /></label>
        <label class="field"><span>First team name</span><input name="team" required maxlength="100" /></label>
        ${colorField()}
        <button class="secondary-button" type="submit">Create Battle</button>
      </form>`;

    manager.innerHTML = battle ? `
      <div class="dialog-heading"><h2>Manage Battle</h2><button type="button" class="icon-button" data-action="close-manager" aria-label="Close">&times;</button></div>
      ${alert}
      <form data-form="rename-battle" class="battle-form">
        <label class="field"><span>Battle name</span><input name="name" required maxlength="100" value="${escapeHtml(battle.name)}" /></label>
        <button class="secondary-button" type="submit">Rename Battle</button>
      </form>
      <button class="danger-button" type="button" data-action="delete-battle">Delete Battle</button>
      <h3>Teams and roster</h3>
      ${battle.teams.map((team) => `
        <section class="team-card">
          <h4><span class="team-color" style="background:${team.color}"></span>${escapeHtml(team.name)}</h4>
          <form data-form="edit-team" data-id="${escapeHtml(team.id)}" class="battle-form">
            <label class="field"><span>Team name</span><input name="name" required maxlength="100" value="${escapeHtml(team.name)}" /></label>
            ${colorField(team.color, battle.teams.map((item) => item.color))}
            <button class="secondary-button" type="submit">Save team</button>
          </form>
          ${team.mechs.length ? team.mechs.map((mech) => `
            <div class="roster-mech">
              <form data-form="rename-mech" data-id="${escapeHtml(mech.id)}" data-team="${escapeHtml(team.id)}" class="battle-form">
                <label class="field"><span>Callsign · ${escapeHtml(mechs.find((item) => item.id === mech.sourceMechId)?.name ?? "Design unavailable")}</span><input name="name" required maxlength="100" value="${escapeHtml(mech.name)}" /></label>
                <button class="secondary-button" type="submit">Save callsign</button>
              </form>
              <button type="button" class="danger-button" data-action="remove-mech" data-id="${escapeHtml(mech.id)}" data-team="${escapeHtml(team.id)}">Remove mech</button>
            </div>`).join("") : `<p class="notice">No mechs in this team.</p>`}
          ${mechs.length ? `<form data-form="add-mech" data-id="${escapeHtml(team.id)}" class="battle-form">
            <label class="field"><span>Add bundled mech</span><select name="source">${mechs.map((mech) => `<option value="${escapeHtml(mech.id)}">${escapeHtml(mech.name)} (${escapeHtml(mech.id.replace(/^\.\.\/mechs\//, ""))})</option>`).join("")}</select></label>
            <button class="secondary-button" type="submit">Add mech</button>
          </form>` : `<p class="notice">No bundled mech designs are available.</p>`}
          ${battle.teams.length > 1 ? `<button type="button" class="danger-button" data-action="remove-team" data-id="${escapeHtml(team.id)}">Delete team</button>` : ""}
        </section>`).join("")}
      ${battle.teams.length < TEAM_COLORS.length ? `<form data-form="add-team" class="battle-form">
        <h3>Add team</h3>
        <label class="field"><span>Team name</span><input name="name" required maxlength="100" /></label>
        ${colorField(undefined, battle.teams.map((team) => team.color))}
        <button class="secondary-button" type="submit">Add team</button>
      </form>` : `<p class="notice">All 16 team colors are in use.</p>`}
    ` : "";
  };

  controls.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement) || target.id !== "battle-mech-select") return;
    selectedId = target.value;
    selectCurrent(true);
    render();
  });

  const handleClick = (event: Event): void => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    if (action === "pick") { render(); picker.showModal(); return; }
    if (action === "manage") { render(); manager.showModal(); return; }
    if (action === "close-picker") { picker.close(); return; }
    if (action === "close-manager") { manager.close(); return; }
    if (action === "open") {
      const battleId = button.dataset.id;
      if (!battleId || !save((data) => { data.activeBattleId = battleId; })) return;
      selectedId = "";
      selectCurrent(true);
      picker.close();
      render();
      return;
    }
    const battle = activeBattle();
    if (!battle) return;
    if (action === "delete-battle") {
      if (!window.confirm(`Permanently delete "${battle.name}" and its entire roster?`)) return;
      if (!save((data) => {
        data.battles = data.battles.filter((item) => item.id !== battle.id);
        data.activeBattleId = null;
      })) return;
      selectedId = "";
      selectCurrent(true);
      manager.close();
      render();
      picker.showModal();
    } else if (action === "remove-team") {
      const team = battle.teams.find((item) => item.id === button.dataset.id);
      if (!team || !window.confirm(`Delete team "${team.name}" and its ${team.mechs.length} mech(s)?`)) return;
      if (!save((data) => { findBattle(data).teams = findBattle(data).teams.filter((item) => item.id !== team.id); })) return;
      selectCurrent();
      render();
    } else if (action === "remove-mech") {
      const team = battle.teams.find((item) => item.id === button.dataset.team);
      const mech = team?.mechs.find((item) => item.id === button.dataset.id);
      if (!team || !mech || !window.confirm(`Remove "${mech.name}" from ${team.name}?`)) return;
      if (!save((data) => {
        const savedTeam = findBattle(data).teams.find((item) => item.id === team.id);
        if (!savedTeam) throw new Error("Team no longer exists.");
        savedTeam.mechs = savedTeam.mechs.filter((item) => item.id !== mech.id);
      })) return;
      selectCurrent();
      render();
    }
  };
  controls.addEventListener("click", handleClick);
  picker.addEventListener("click", handleClick);
  manager.addEventListener("click", handleClick);
  picker.addEventListener("cancel", (event) => { if (!activeBattle()) event.preventDefault(); });
  const updateColorPreview = (event: Event): void => {
    const select = event.target;
    if (!(select instanceof HTMLSelectElement) || select.name !== "color") return;
    const preview = select.parentElement?.querySelector<HTMLElement>("[data-color-preview]");
    if (preview) preview.style.backgroundColor = select.value;
  };
  picker.addEventListener("change", updateColorPreview);
  manager.addEventListener("change", updateColorPreview);

  const handleSubmit = (event: Event): void => {
    event.preventDefault();
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    const values = new FormData(form);
    const text = (key: string): string => String(values.get(key) ?? "").trim();
    const formName = form.dataset.form;
    const name = text("name");
    if (formName !== "add-mech" && !name) {
      errorMessage = "Enter a name.";
      showError();
      return;
    }
    if (formName === "create-battle" && !text("team")) {
      errorMessage = "Enter a team name.";
      showError();
      return;
    }
    const success = save((data) => {
      if (formName === "create-battle") {
        const battle: Battle = { id: id(), name, teams: [{ id: id(), name: text("team"), color: text("color"), mechs: [] }] };
        data.battles.push(battle);
        data.activeBattleId = battle.id;
        return;
      }
      const battle = findBattle(data);
      if (formName === "rename-battle") battle.name = name;
      else if (formName === "add-team") battle.teams.push({ id: id(), name, color: text("color"), mechs: [] });
      else {
        const teamId = formName === "rename-mech" ? form.dataset.team : form.dataset.id;
        const team = battle.teams.find((item) => item.id === teamId);
        if (!team) throw new Error("Team no longer exists.");
        if (formName === "edit-team") { team.name = name; team.color = text("color"); }
        else if (formName === "rename-mech") {
          const mech = team.mechs.find((item) => item.id === form.dataset.id);
          if (!mech) throw new Error("Mech no longer exists.");
          mech.name = name;
        } else if (formName === "add-mech") {
          const definition = mechs.find((item) => item.id === text("source"));
          if (!definition) throw new Error("Bundled mech design not found.");
          team.mechs.push({ id: id(), sourceMechId: definition.id, name: defaultMechName(definition.chassis, battle.teams), damage: null });
        }
      }
    });
    if (!success) return;
    if (formName === "create-battle") {
      selectedId = "";
      selectCurrent(true);
      picker.close();
    } else selectCurrent();
    render();
  };
  picker.addEventListener("submit", handleSubmit);
  manager.addEventListener("submit", handleSubmit);

  selectCurrent(true);
  render();
  if (!activeBattle()) picker.showModal();
}
