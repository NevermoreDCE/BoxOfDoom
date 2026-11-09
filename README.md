# BoxOfDoom
# Box of Doom

A mobile-friendly BattleTech attack roller for the Beginner Box quick-start rules.

## Run locally

```sh
npm install
npm run dev
```

The app reads `.txt` 'Mech exports from `mechs/` at build time. Weapon rows for the included 'Mechs are parsed from their equipment tables. Supported damage profiles include common lasers, PPCs, autocannons, LRMs, SRMs, and TAG; weapons without a supported damage profile or bundled range data stay visible but cannot be selected.

Weapon ranges are bundled from `data/weapon-ranges.txt`, using the Inner Sphere weapon definitions in the [MegaMek source](https://github.com/MegaMek/megamek/tree/995e0ad5a81d4cd3de2fde3395ccf0a7066d1f87/megamek/src/megamek/common/weapons). The requested MegaMek API was unavailable when these values were collected. Range changes reset the selection to supported short-range weapons; medium- and long-range weapons can be selected manually, while out-of-range weapons cannot be fired.

## Validate and build

```sh
npm test
npm run build
```

GitHub Pages deployment is configured in `.github/workflows/deploy.yml`; enable Pages for the repository with GitHub Actions as the build and deployment source.