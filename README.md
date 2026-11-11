# BoxOfDoom
# Box of Doom

A mobile-friendly BattleTech attack roller for the Beginner Box quick-start rules.

## Battles

Create a Battle with an initial team, then use **Manage Battle and roster** to add teams and bundled 'Mechs, edit names and colors, or remove entries. A design may be added multiple times with different callsigns. Use the Battle switch button to open another saved Battle.

Battles are saved automatically in local browser storage and the last open Battle is restored on return. Storage is specific to the browser and profile and can be cleared by the browser or user; it is not synchronized or backed up. Attack settings and volley results are not saved, and switching 'Mechs resets them. Damage tracking is not implemented yet.

Team colors use a 16-color palette selected for distinguishability under simulated color-vision deficiencies, but no palette can guarantee every color is distinct for every user. Team names are always displayed alongside colors. If a bundled design is removed or cannot be parsed, its saved roster entry is preserved and marked unavailable. Save failures and changes from another tab are reported; reload before editing after another tab changes Battles.

## Run locally

```sh
npm install
npm run dev
```

The app reads MegaMek `.txt` exports and `.mtf` 'Mech files from `mechs/` and its subfolders at build time. TXT exports supply weapon heat and a technology base; MTF weapon heat comes from the bundled definitions. Ranges and supported damage profiles use Clan or Inner Sphere definitions. A mixed-tech MTF weapon requires an explicit weapon prefix or an unambiguous matching critical slot; mixed-tech TXT weapons require an explicit prefix. Ambiguous or unspecified technology is unavailable rather than guessed. Clan and Inner Sphere pulse lasers include their -2 to-hit modifier.

Weapon ranges, heat, and additional profiles are bundled in `data/weapon-ranges.txt` and `data/weapon-additional.txt` from the [MegaMek source](https://github.com/MegaMek/megamek/tree/995e0ad5a81d4cd3de2fde3395ccf0a7066d1f87/megamek/src/megamek/common/weapons). The requested MegaMek API was unavailable when these values were collected. Special-rule weapons, including ATM, Arrow IV, flamers, LB-X and Ultra autocannons, Streak SRMs, Narc, and anti-missile systems, remain visible but cannot be fired; their saved statistics do not implement their special modes. Artillery ranges are not treated as ordinary hex ranges. Range changes reset selection to supported short-range weapons; medium- and long-range weapons can be selected manually, while out-of-range weapons cannot be fired.

## Validate and build

```sh
npm test
npm run build
```

GitHub Pages deployment is configured in `.github/workflows/deploy.yml`; enable Pages for the repository with GitHub Actions as the build and deployment source.