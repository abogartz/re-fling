# re-fling

Replay web requests from a CSV file at your own pace. Load a CSV with `url` and `datetime` columns, tweak the speed and duration, and watch the requests fire with a live RPS chart and request log.

## What it does

- **Load a CSV** — auto-detects `url` and `datetime` columns, or remap them manually if your headers differ.
- **Filter** — exclude requests whose URL matches regex patterns.
- **Control pacing** — set a speed multiplier and an optional duration override.
- **Replay in real time** — fires the requests with timing based on your CSV, and shows progress, a per-second RPS chart, and a log of everything that happened.

## Getting started

```bash
bun install       # install dependencies
bun run dev:hmr   # run with hot module reload (recommended)
bun run start     # build and run without HMR
```

## Project layout

```
src/
├── bun/            # desktop shell (Electrobun main process + logging)
├── csv/            # CSV parser
├── features/       # column mapping, CSV loader, duration, filters, logs
├── mainview/       # the React app (App.tsx, chart, entry point)
├── replay/         # the replay engine (scheduling, pacing, fetch)
├── services/       # CSV → log formatter
├── store/          # global app state (Zustand)
└── utils/          # scheduling math, filters, timeseries helpers
```

## Testing

```bash
bun run test        # unit tests (CSV parser, engine, utils, UI)
bun run test:e2e    # Playwright end-to-end tests
bun run lint        # ESLint
bun run validate    # lint + unit + e2e, all in one
```

Run `bun run validate` and make sure everything passes before committing.