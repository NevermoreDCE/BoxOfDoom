

# purpose
this is an assistant app to help with running large numbers of mechs for a GM'd campaign game or to help run mechs that have a lot of weapon systems and can be arduous to roll individually.
it is not designed to completely replace pencil-and-paper-plus-dice recordkeeping or gameplay, but simply to speed up the "enemy" turns and to make simple tracking of armor damage for "enemy" mechs easy to do.

## out of scope
this app will not track critical damage or any specific internal modifications of the mech
this app will not track pilot effects/damage
this app will not directly track heat or the impact of heat effects on the mech, those should be handled outside and applied manually as "other" modifiers

# technical Overview
static web-app
use typescript
target hosting is github.io pages
must be mobile-friendly, very easy to use with touch-based inputs

# data source
read MegaMek `.txt` export and `.mtf` files from the "mechs" folder and its subfolders

Weapon ranges and MTF weapon heat use bundled Inner Sphere and Clan definitions. Mixed-tech weapons use an explicit per-weapon tech base or, in MTF files, an unambiguous matching critical slot; ambiguous or unspecified technology remains unavailable rather than guessing. Weapons with special firing rules not yet implemented remain visible but cannot be selected.

should be able to read in the equipment for a mech

# MVP

user should be able to pick a mech (from teh mechs folder) by a dropdown

main UI should list all weapons for the mech

user should be able to select which weapons to fire (default to all weapons selected)

user should be able to enter all GATOR values
- Gunnery skill should be a value from 5 (worst) to -1 (best), starting at 4
- Attacker movement should selected from these options, should apply the modifier in the parenthesis, and should default to "Run":
  - Stationary (+0)
  - Walk (+1)
  - Run (+2)
  - Jump (+3)
  - Prone (+4)
- Target movement should be a value from 0 to 6, default to 2
- Other should be a numeric entry field, default to 0
- Range should be selected from these options, should apply the modifier in parenthesis, and should default to "Short":
  - Short (+0)
  - Medium (+2)
  - Long (+4)

The sum total of GATOR determines the Target Number (TN)

user should be able to select the hit location on the target from the following options, default to "Front":
- Front
- Left
- Right
- Rear

user can then click "Fire" button to continue

for each selected weapon:

  should use strong cryptographic randomness to roll 2D6
  if the rolled number is equal to or greater than the TN, the weapon hits.
  calculate damage applied including using the cluster hit table for cluster weapons
  calcuate the hit location for each hit or cluster hit
  report the result to the user by indicating the weapon name, the TN, the rolled to-hit, the damage(s), and the location(s)




---

# Cluster Hit Table
| Die Roll (2D6) | Number of Missiles/Pellets Fired |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
|   | 2 | 3 | 4 | 5 | 6 | 9 | 10 | 12 | 15 | 20 |
| 2 | 1 | 1 | 1 | 1 | 2 | 3 | 3 | 4 | 5 | 6 |
| 3 | 1 | 1 | 2 | 2 | 2 | 3 | 3 | 4 | 5 | 6 |
| 4 | 1 | 1 | 2 | 2 | 3 | 4 | 4 | 5 | 6 | 9 |
| 5 | 1 | 2 | 2 | 3 | 3 | 5 | 6 | 8 | 9 | 12 |
| 6 | 1 | 2 | 2 | 3 | 4 | 5 | 6 | 8 | 9 | 12 |
| 7 | 1 | 2 | 3 | 3 | 4 | 5 | 6 | 8 | 9 | 12 |
| 8 | 2 | 2 | 3 | 3 | 4 | 5 | 6 | 8 | 9 | 12 |
| 9 | 2 | 2 | 3 | 4 | 5 | 7 | 8 | 10 | 12 | 16 |
| 10 | 2 | 3 | 3 | 4 | 5 | 7 | 8 | 10 | 12 | 16 |
| 11 | 2 | 3 | 4 | 5 | 6 | 9 | 10 | 12 | 15 | 20 |
| 12 | 2 | 3 | 4 | 5 | 6 | 9 | 10 | 12 | 15 | 20 |

---

# Hit Location Table
| Die Roll (2D6) | Left Side | Front/Rear | Right Side |
| --- | --- | --- | --- |
| 2 | Floating Crit | Floating Crit | Floating Crit |
| 3 | Left Leg | Right Arm | Right Leg |
| 4 | Left Arm | Right Arm | Right Arm |
| 5 | Left Arm | Right Leg | Right Arm |
| 6 | Left Leg | Right Torso | Right Leg |
| 7 | Left Torso | C Torso | Right Torso |
| 8 | C Torso | Left Torso | C Torso |
| 9 | Right Torso | Left Leg | Left Torso |
| 10 | Right Arm | Left Arm | Left Arm |
| 11 | Right Leg | Left Arm | Left Leg |
| 12 | Head | Head | Head |

For "Floating Crit" results, roll again to deterimine the location of the crit and indicate that it is a crit in that location.

## BattleMech Internal Structure by Tonnage

Reference table for standard biped BattleMechs. The values are internal-structure points per location; left/right side torsos, arms, and legs use the same value. This table is transcribed from MegaMek's [`Mek.getInternalForTonnage`](https://github.com/MegaMek/megamek/blob/master/megamek/src/megamek/common/units/Mek.java) (the source array order is Head, Center Torso, Side Torso, Arm, Leg). For tonnages between 10 and 100 that are not multiples of 5, MegaMek selects the next 5-ton increment.

| Tonnage | Head | Center Torso | Each Side Torso | Each Arm | Each Leg |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 10 | 3 | 4 | 3 | 1 | 2 |
| 15 | 3 | 5 | 4 | 2 | 3 |
| 20 | 3 | 6 | 5 | 3 | 4 |
| 25 | 3 | 8 | 6 | 4 | 6 |
| 30 | 3 | 10 | 7 | 5 | 7 |
| 35 | 3 | 11 | 8 | 6 | 8 |
| 40 | 3 | 12 | 10 | 6 | 10 |
| 45 | 3 | 14 | 11 | 7 | 11 |
| 50 | 3 | 16 | 12 | 8 | 12 |
| 55 | 3 | 18 | 13 | 9 | 13 |
| 60 | 3 | 20 | 14 | 10 | 14 |
| 65 | 3 | 21 | 15 | 10 | 15 |
| 70 | 3 | 22 | 15 | 11 | 15 |
| 75 | 3 | 23 | 16 | 12 | 16 |
| 80 | 3 | 25 | 17 | 13 | 17 |
| 85 | 3 | 27 | 18 | 14 | 18 |
| 90 | 3 | 29 | 19 | 15 | 19 |
| 95 | 3 | 30 | 20 | 16 | 20 |
| 100 | 3 | 31 | 21 | 17 | 21 |

---

# Post-MVP Updates

## Update 1: Volley damage total and PSR

- Add the volley’s total applied damage to the top-right of the Volley Results header.
- Show “PSR required” when the volley’s total damage is 20 or greater.
- Reset the total to 0 when volley results are cleared.

## Update 2: Compact mobile volley results

- Use compact results when the viewport is at or below the mobile-width breakpoint (768px), or the browser identifies itself as a mobile user agent.
- In compact mode, show each weapon’s name, hit/miss outcome, damage, and hit location in a collapsed accordion row.
- Tapping a weapon row expands it to show the remaining attack details, including the target number, to-hit roll, cluster roll, and hit-location roll.
- Keep the full, expanded result cards on desktop layouts.

## Update 3: Selected weapon heat

- Add a heat summary box at the end of the weapon list, styled like the GATOR target-number display.
- Show the sum of the Heat values for currently selected weapons over the 'Mech's total heat-sink capacity.
- For double heat sinks, use the total capacity shown in square brackets rather than the number of sinks.
- Update the displayed heat whenever a weapon is selected or deselected, or the active 'Mech changes.
- Immediately below the heat box, remind users that the total covers weapon heat only and other sources such as movement may apply separately.

## Rework range
need to rework how the Range modifier is entered and used.
it should be entered as a numeric field above the weapons labeled "Range to target", allowing a value of 0 to 25, default to 6
Each weapon should then calculate its range band based on the selected range to target to identify if it is short, medium, or long range and display that information as part of the weapon profile. it should also track the range modifier for each weapon and apply that to the TN for that weapon.
Default to all weapons in short range selected, other weapons not selected by default.
if the weapon has a minimum range and the range-to-target is shorter than that minimum range, apply a +1 modifier to the TN for each value the range is inside the minimum (e.g. a range-to-target of 3 for a weapon with a minimum range of 6 should apply a +3 modifier).
Update the target number display to indicate "# + Range".
use the megamek api (https://api.quartermaster-command.services, documentation found at https://github.com/MegaMek/api-data) to find weapon profiles, load the weapon profiles into text files in a ./data/ folder in this repository

- When the range changes, reset the selection to supported short-range weapons. Medium- and long-range weapons may be selected manually.
- Show weapons beyond long range as out of range and prevent them from being selected or fired.
- Show weapons without supported profiles or range data as unavailable rather than guessing their range.
- The MegaMek API host was unavailable during implementation; the local range profiles use the corresponding published MegaMek source definitions as an approved fallback.

## Dice roll diagnostics

- Record every 2D6 total, including to-hit, cluster, hit-location, and floating critical rerolls, in the current browser tab's session.
- Provide a gear button near the bottom of the page that opens a chart of roll counts for totals 2 through 12.
- Provide an option to clear the recorded history and reset the chart.

## Damage by location

- After the volley results, show total damage for every hit location, including locations with no damage.
- Display a dash instead of zero for locations with no damage.
- Order locations by their first appearance in the hit-location table for the facing used when the volley was fired.
- Include all damage groups and floating-critical damage in the total for their actual hit location; clear the summary when volley results are cleared.

---
# bugs

## jumpjets showing up as weapons FIXED
when loading the ANH-2L, the jump jets are being shown as weapons

---

# ideas

## 1. improved mech picker
ability to pick custom mechs from /mechs/ folder, ~~or to open a stock mech from the megamek API/repository/MUL~~ (removed due to janky megamek code/data, no good consistent way to load dynamically from their sources)

## 2. long-term record of "Battles" & ability to track multiple mechs - DONE

### Battles and persistence
- Store Battles in the browser's local storage so they persist between visits in the same browser and profile. Cross-device or cross-browser synchronization is out of scope; see Idea 9 for export and import.
- When no Battle is open, start with a dialog to create a Battle or open an existing one. Remember the open Battle and restore it on the next visit. If the remembered Battle no longer exists, show the dialog instead. include an icon in the main screen to allow the user to pick another battle. since the state of a battle should always be saved-in-place, picking another battle while one is open should be able to 'context switch' without losing battle data.
- Allow users to name and rename a Battle, and to delete it permanently after confirmation. Deletion removes the Battle entirely; there is no soft delete.
- Save the Battle's identity, teams, and mech roster. Prepare each mech instance to hold future damage-tracking data using a stub or placeholder, but do not implement damage tracking as part of this idea. do not track the entire mech object, just the roster and damage.
- Do not save attack settings, volley results, or a combat log.

### Teams and mechs
- Each Battle has one or more teams. Each team has a name and a color, both unique within that Battle. Teams may be empty.
- Provide a fixed palette of 16 colorblind-safe options. Since colors alone cannot reliably distinguish 16 teams for every user, always identify teams by name as well as color. Unique colors limit a Battle to 16 teams.
- Add mechs to a team using the existing picker and bundled mech files only. Loading designs from external sources is out of scope for this idea.
- Allow multiple instances of the same chassis. Each instance has its own identity and a user-editable name or callsign, defaulting to the chassis name and a number, such as "Annihilator 1".
- Allow users to remove a mech from a team. Mechs cannot be moved between teams; to change teams, remove the mech and add a new instance to the other team.

### Attack screen
- Provide tabs at the top of the attack screen, or a suitable mobile-friendly picker, to switch between teams and mechs.
- Switching mechs starts a different mech's turn: reset the entire attack screen to its normal defaults, including weapon selections, range, modifiers, facing, and volley results. Do not retain or restore per-mech attack configurations or results.
- Users configure each volley manually as needed, starting from the app's normal default selections.

### Implementation considerations
- Give Battles, teams, and mech instances stable, distinct identifiers; a mech instance is separate from its bundled chassis definition.
- Version and validate saved Battle data so future damage-tracking changes can be migrated. Handle unavailable or invalid storage explicitly without silently discarding saved data.
- Account for bundled mech definitions changing or disappearing in a later app version without silently losing a saved roster.

## 3. disable weapons - DONE
Pressing and holding anywhere on a weapon row (or double-clicking on desktop) should give the option, with a confirmation dialog, to disable or re-enable a weapon. A disabled weapon cannot be selected for firing and is ignored by the app.
- Save disabled weapons per 'Mech instance in the Battle, including across reloads and Battle or 'Mech switches. Do not retain ordinary attack selections.
- Disabled weapons are excluded from default selection, heat, and firing. Re-enabled weapons must be selected manually or by a subsequent range reset, and remain unavailable if their range or firing rules do not permit selection.
- Allow keyboard users to focus a weapon row and press D to disable or re-enable it; do not add a separate action button. Preserve and report saved disabled entries that no longer match the bundled design.

## 4. Damage Tracking  - Done
Add a separate damage-tracking screen for BattleMech instances in the open Battle. This depends on Idea 2 (Battles); Idea 5 (applying volley damage) will use the same saved damage state but is not required for this idea.

### User experience

- Provide a way to open the damage screen from the active Battle and return to the previous screen without changing the active attack mech, its attack settings, or its results.
- Let the user choose any mech instance in the open Battle, including mechs on other teams. Identify each entry by team and callsign so duplicate chassis are unambiguous. Preserve roster entries whose bundled mech definition is missing, but do not offer damage tracking for them until their record-sheet values can be loaded.
- Show every supported location's maximum and remaining armor and internal structure, plus battle-mech-wide current/maximum totals. Show front and rear torso armor separately; torso internal structure is shared between the two facings. A location with zero remaining points stays visible.
- Use the provided `docs/design/diagrams/ArmorDiagram.svg` for both front- and rear-armor views and `docs/design/diagrams/InternalsDiagram.svg` for internal structure. Embed the SVGs inline so the UI can address individual location elements and update their fill colors based on current damage; preserve the diagram outlines and labels.
- In the rear-armor view, only the left torso, center torso, and right torso are interactive/data-bearing armor locations. Render the head, both arms, and both legs as context only with opacity no greater than 20%; they must not be selectable or appear to have rear armor values.
- Color each applicable SVG section according to that section's remaining points divided by its maximum points. Use HSL interpolation from bright green `#26FF00` at 100%, through yellow `#FFFF00` at 50%, to red `#E02020` at 5%. Continue the HSL transition from red to dark gray `#101010` at 0%; zero-health locations remain visibly dark gray rather than transparent. Clamp health percentages to 0–100%.
- Prefer a small, pure JavaScript/TypeScript color-mapping function that converts the normalized health percentage to an HSL color and fill opacity, then applies these to the targeted inline SVG location element. Calibrate the interpolation endpoints to the specified hex colors; do not rely on CSS-only gradients or use the SVG's static fill as the damage indicator. Keep the SVG stroke/outline opacity independent from fill opacity, including at zero health.
- Provide accessible labels and equivalent keyboard-operable controls for every interactive location/armor section. If a provided SVG is unavailable or cannot be embedded/accessed by location, show the responsive list of location controls ordered by first appearance on the Front/Rear column of the existing hit-location table (rolls 2 through 12), excluding the non-location "Floating Crit" result.

### Applying and correcting damage

- Tapping/clicking a location or armor section opens a dialog with a numeric, non-negative integer damage amount and an explicit Apply and Cancel action. Reject blank, fractional, negative, non-numeric, and unsafe-integer input without changing saved damage. Do not apply a change on dialog dismissal or cancellation.
- For a torso, require the user to choose front or rear armor; default to front. For all other locations, apply against that location's single armor value.
- Proposed default damage behavior: subtract the amount from the selected armor first, then apply any remainder to that location's internal structure. Clamp both values at zero, display any damage beyond the remaining armor and internal structure as unapplied, and do not transfer damage to another location. Do not roll hit locations, perform critical-hit rolls, or model location-transfer/destruction effects.
- Provide a clearly labeled way to restore a mech instance to its original armor and internal values, with confirmation. Persist each successful change immediately. Do not add a per-hit damage log as part of this idea.
- Display remaining values against their recorded maximums and update the location and BattleMech totals immediately after a change. Include rear armor in armor totals and count each location's internal structure only once.

### Data and implementation requirements

- Keep damage on the BattleMech instance, not on the shared bundled chassis definition. Store each location's maximum and current armor and internal values, with separate current/maximum rear-armor values for the center, left, and right torso. Store the source design identity/version used to initialize the record so existing damage remains stable if bundled definitions later change or disappear.
- Initialize an instance from its bundled design the first time its damage record is created. Existing Battle entries with the current `damage: null` placeholder must migrate without losing their IDs, names, team membership, or disabled-weapon data. Version and validate the saved Battle format; preserve unsupported or unavailable saved entries and report migration/storage errors rather than silently resetting the Battle.
- Extend mech loading to produce validated per-location maximum armor and internal-structure values. MTF files provide front armor, rear-torso armor, and tonnage; derive internal points using the standard biped table above. MegaMek TXT exports may contain an explicit internal/armor table, including combined R/L entries, which must be parsed without assuming asymmetric values. Reject incomplete, duplicate, negative, or contradictory location data as unavailable instead of inventing values.
- Define and test the supported location set for biped 'Mechs: Head, Center Torso, Left Torso, Right Torso, Left Arm, Right Arm, Left Leg, and Right Leg. Rear armor is supported only for Center, Left, and Right Torso. Designs with unsupported configurations or incomplete required values must show a clear unavailable reason rather than an incomplete or misleading damage sheet.
- Keep damage operations in a reusable model layer so the UI and future Idea 5 apply-damage flow use identical validation, overflow, persistence, and totals behavior. Do not store attack settings, volley results, or a combat log as a side effect of damage tracking.

### Acceptance checks

- A new damage record matches the loaded design's maximum values; repeated visits and page reloads retain current values for that BattleMech instance only.
- Two instances of the same design can have different damage. Switching selected mechs, teams, or Battles never copies or resets another instance's damage.
- Front and rear torso armor remain distinct, and damage overflowing the selected surface reaches only that torso's internal structure. Damage never makes a stored value negative; overkill is reported and ignored.
- SVG fill color reflects each location's own remaining/max armor or internal points: 100% is `#26FF00`, 50% is `#FFFF00`, 5% is `#E02020`, and 0% is `#101010`. Verify intermediate HSL interpolation through the green-yellow-red-gray spectrum and ensure unrelated SVG locations retain their own damage-derived appearance.
- In the rear-armor view, the head, arms, and legs stay at no more than 20% opacity, are grey-filled regardless of their actual damage status, and do not become interactive or show rear-armor values, regardless of their front armor or internal-structure damage.
- Armor and internal totals include all locations (and rear armor) exactly once, update after damage and restoration, and display current versus maximum values.
- A missing design, malformed saved damage, failed storage write, or concurrent Battle edit is reported without silently overwriting or discarding saved Battle data.
- Keyboard and touch users can select each location/surface, enter damage, cancel safely, and restore values with confirmation.

### Implementation notes

- Apply damage armor-first, then to the same location's internal structure; do not transfer excess damage or roll critical effects. Use the saved per-instance maxima even if the bundled source design later changes or disappears.
- Derive MTF internal values from tonnage using the table above. Treat incomplete or unsupported damage profiles as unavailable without affecting attack-roll mech loading.
- The provided diagrams are generic BattleMech silhouettes rather than design-specific record sheets; use them for all supported biped designs unless a future requirement replaces them.

## 5. Apply Damage button & picker
requires "battles" to be implemented, requires "Damage tracking" to be implemented
at the end of the Volley Results section, add an option to select the target from other mechs in the battle and then apply the damage numbers to that mech directly

## 6. support for non-mech record sheets
infantry, vehicles, aerospace, artillery, etc

## 7. Multiplayer mode
(intended to allow other players at the table to 'submit' their attack results to the GM's authoritative list)
use Supabase as a backend to allow synchronization between multiple clients, anonymous authentication
one user would be the Host, they would select teh Battle and that battle would generate a Lobby Code (6-character alpha-numeric value), store host ID as part of the lobby data
lobbies should be automatically deleted after 24 hours
other users could join that lobby by entering that code, specifying their name and team
- consider host generating separate lobby codes per team? or how would the user 'pick' their team during the connection process?
host records are authoritative, but clients can send damage updates 
- need concurrency checking to make sure host's record hasn't already been updated by another, show notification but allow option to 'merge' additional damage on same target
- host should receive a notification of incoming damage updates, should show source, target, damage, and allow them to approve, reject, or modify the damage update

## 8. GM/Client mode
requires Multiplayer
clients can only see mechs the host selects as "visible to all"
clients can only see mech damage records on mechs that are not their team as "color spectrum" without being able to see actual numbers, shifting from a strong green through yellow and into strong red before becoming an empty frame indicating that all armor in that location is gone. This should be very similar to the display for the MechWarrior games.

## 9. Battle export and import
Allow users to export Battles and import them in another browser, profile, or device. Define the file format and behavior for importing a Battle that already exists when this idea is implemented.

## 10. Additional weapon firing rules
Support firing rules not currently handled by the attack roller for weapons in bundled mech designs. The initial inventory includes anti-missile systems, Arrow IV artillery, ATM launchers, flamers, Narc, Streak SRMs, Ultra autocannons, and LB-X autocannons. Identify and include any other bundled weapons whose special rules or attack modes are not yet supported.

- Define the appropriate attack modes and user inputs, including ammunition choices where they affect range, damage, or special effects.
- Implement the applicable hit modifiers, cluster behavior, damage grouping, and non-damage effects without guessing or treating defensive equipment as an ordinary attack.
- Account for Clan, Inner Sphere, and mixed-tech equipment on a per-weapon basis.
- Keep modes or weapons unavailable until their required rules are supported; clearly explain why they cannot be fired.
- Add tests for each supported mode and its relevant edge cases.

## 13. local settings/preferences
change out the gear at the bottom, move that to a barchart icon
add settings dialog, control default values for lots of stuff like:
- range
- gunnery
- movement
- TMM

## 11. better battle UI
make color picker just colors (not numbers or names), group with name input as a simple dropdown on the end