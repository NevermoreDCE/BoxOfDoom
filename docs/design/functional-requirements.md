

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
ability to pick custom mechs from /mechs/ folder, or to open a stock mech from the megamek API/repository/MUL

## 2. long-term record of "Battles" & ability to track multiple mechs

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

## 3. disable weapons
Pressing and holding anywhere on a weapon row (or double-clicking on desktop) should give the option, with a confirmation dialog, to disable or re-enable a weapon. A disabled weapon cannot be selected for firing and is ignored by the app.
- Save disabled weapons per 'Mech instance in the Battle, including across reloads and Battle or 'Mech switches. Do not retain ordinary attack selections.
- Disabled weapons are excluded from default selection, heat, and firing. Re-enabled weapons must be selected manually or by a subsequent range reset, and remain unavailable if their range or firing rules do not permit selection.
- Allow keyboard users to focus a weapon row and press D to disable or re-enable it; do not add a separate action button. Preserve and report saved disabled entries that no longer match the bundled design.

## 4. Damage Tracking
separate screen for tracking damage to mech
pick a mech from the current battle
shows all damage locations, total and current armor & internals, tap location and enter a number to apply damage to that location
if a publicly licensed free-to-use image is available, prefer to use an image of the mech layout similar to what is seen on normal printed rosters (make each section of the mech 'tapable/clickable' and display numeric armor/internals); if no publicly-licensed image is available then just use a list of buttons in the order of the hit chart.

## 5. Apply Damage button & picker
requires "battles" to be implemented, requires "Damage tracking" to be implemented
at the end of the Volley Results section, add an option to select the target from other mechs in the battle and then apply the damage numbers to that mech directly

## 6. support for non-mech record sheets
infantry, vehicles, aerospace, artillery, etc

## 7. Multiplayer mode
(intended to allow other players at the table to 'submit' their attack results to the GM's authoritative list)
use Firebase as a backend to allow synchronization between multiple clients, anonymous authentication
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
