# React + Tailwind + Vite Electrobun Template

A fast Electrobun desktop app template with React, Tailwind CSS, and Vite for hot module replacement (HMR).

## Getting Started

```bash
# Install dependencies
bun install

# Development without HMR (uses bundled assets)
bun run dev

# Development with HMR (recommended)
bun run dev:hmr

# Build for production
bun run build

# Build for production release
bun run build:prod
```

## How HMR Works

When you run `bun run dev:hmr`:

1. **Vite dev server** starts on `http://localhost:5173` with HMR enabled
2. **Electrobun** starts and detects the running Vite server
3. The app loads from the Vite dev server instead of bundled assets
4. Changes to React components update instantly without full page reload

When you run `bun run dev` (without HMR):

1. Electrobun starts and loads from `views://mainview/index.html`
2. You need to rebuild (`bun run build`) to see changes

## Project Structure

```
├── src/
│   ├── bun/
│   │   └── index.ts        # Main process (Electrobun/Bun)
│   └── mainview/
│       ├── App.tsx         # React app component
│       ├── main.tsx        # React entry point
│       ├── index.html      # HTML template
│       └── index.css       # Tailwind CSS
├── electrobun.config.ts    # Electrobun configuration
├── vite.config.ts          # Vite configuration
├── tailwind.config.js      # Tailwind configuration
└── package.json
```

## Development Workflow

```bash
# Run all validation (ESLint + unit tests + E2E tests)
bun run validate
```

This runs:
1. **ESLint** - Lints TypeScript/React code with strict rules
2. **Unit tests** - Bun test suite for CSV parser and replay engine
3. **E2E tests** - Playwright tests for full app behavior

**Important**: All checks must pass before committing changes. The pi agent requires `bun run validate` to pass after every code modification.

### Validation Rules
- ESLint: 0 errors (warnings allowed)
- Unit tests: All tests must pass
- E2E tests: All tests must pass

If validation fails, fix the issues before proceeding.

## Testing & Validation

```bash
# Run only unit tests
bun run test

# Run only E2E tests (requires dev server)
bun run test:e2e

# Run only linting
bun run lint
```

## Customizing

- **React components**: Edit files in `src/mainview/`
- **Tailwind theme**: Edit `tailwind.config.js`
- **Vite settings**: Edit `vite.config.ts`
- **Window settings**: Edit `src/bun/index.ts`
- **App metadata**: Edit `electrobun.config.ts`
