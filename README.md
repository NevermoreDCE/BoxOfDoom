# BoxOfDoom
# Box of Doom

A mobile-friendly BattleTech attack roller for the Beginner Box quick-start rules.

## Run locally

```sh
npm install
npm run dev
```

The app reads `.txt` 'Mech exports from `mechs/` at build time. Weapon rows for the included 'Mechs are parsed from their equipment tables. Supported damage profiles include common lasers, PPCs, autocannons, LRMs, SRMs, and TAG; other weapon rows stay visible but must be deselected before firing.

## Validate and build

```sh
npm test
npm run build
```

GitHub Pages deployment is configured in `.github/workflows/deploy.yml`; enable Pages for the repository with GitHub Actions as the build and deployment source.