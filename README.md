# Call Break Phaser - Monorepo

A multiplayer card game built with Phaser 3 and Colyseus, organized as an npm workspaces monorepo.

## Project Structure

```
call-break-phaser/
├── packages/
│   ├── client/        # Phaser 3 game client
│   ├── server/        # Colyseus multiplayer server
│   └── shared/        # Shared game logic and types
├── docs/              # Documentation
├── package.json       # Root workspace configuration
└── tsconfig.json      # TypeScript project references
```

## Packages

### [@call-break/client](./packages/client)

- **Tech Stack:** Phaser 3, Vite, TypeScript
- **Description:** Browser-based game client with UI and animations
- **Port:** 5173 (dev)

### [@call-break/server](./packages/server)

- **Tech Stack:** Colyseus, Express, TypeScript
- **Description:** Multiplayer game server handling rooms and state synchronization
- **Port:** 2567

### [@call-break/shared](./packages/shared)

- **Description:** Shared game logic, types, constants, and bot AI
- **Used by:** Both client and server

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0

### Installation

```bash
# Install all dependencies
npm install
```

This will install dependencies for all packages and create workspace symlinks.

### Development

**Recommended: Start everything at once**

```bash
# Start shared (watch), server, and client together
npm run dev:all
```

This command runs 3 processes in parallel:

- Shared package in watch mode (auto-rebuilds on changes)
- Server with auto-reload (restarts when shared changes)
- Client dev server (reads shared source directly via Vite)

**Or run individually:**

```bash
# Start client only (uses shared source via Vite alias)
npm run dev

# Start server only (requires shared package built first)
npm run dev:server

# Start shared package in watch mode
npm run dev:shared
```

**Important:** If running server individually, ensure shared package is built first:

```bash
npm run build:shared  # Build once
npm run dev:server    # Then start server
```

### Building

```bash
# Build all packages
npm run build

# Build specific package
npm run build:client
npm run build:server
npm run build:shared
```

### Testing

```bash
# Run all tests
npm run test

# Run tests for specific package
npm run test:client
npm run test:server
npm run test:shared
```

### Linting & Formatting

```bash
# Lint all files
npm run lint

# Lint and auto-fix issues
npm run lint:fix

# Format all files with Prettier
npm run format

# Check formatting without changes
npm run format:check
```

**Pre-commit Hook:** Automatically runs linting and formatting on staged files before commit.

### Clean

```bash
# Remove all node_modules and dist directories
npm run clean

# Remove only dist directories
npm run clean:build
```

## Workspace Commands

### Installing a Dependency

```bash
# Install in specific package
npm install <package> --workspace=packages/client
npm install <package> --workspace=packages/server

# Install in root (for dev tools)
npm install <package> --save-dev -w
```

### Running Package Scripts

```bash
# Run script in specific workspace
npm run <script> --workspace=packages/client
```

## Architecture

This project uses **npm workspaces** to manage a monorepo containing three packages:

1. **Shared Package** - Single source of truth for game logic
   - Card operations (create, shuffle, validate)
   - Scoring logic
   - Trick winner calculation
   - Bot AI (3 difficulty levels)
   - TypeScript types and constants

2. **Client Package** - Frontend game implementation
   - Service Locator + Event Bus architecture
   - Pluggable game/mode system (BaseGame + BaseMode)
   - NetworkService (Colyseus connection, reconnection, monitoring)
   - Typed EventBus with ScopedEventBus for auto-cleanup
   - See [packages/client/README.md](./packages/client/README.md) for architecture details
   - See [packages/client/developer-guide.md](./packages/client/developer-guide.md) for full developer guide

3. **Server Package** - Backend multiplayer server
   - Uses shared game logic
   - Colyseus room management
   - State synchronization
   - Server-specific bot logic

### Why npm workspaces?

- Zero additional dependencies (native npm)
- Perfect for small monorepos (3 packages)
- Simple linear dependency graph
- Automatic dependency hoisting
- Workspace symlinks for instant updates

## Documentation

- [Client Architecture](./packages/client/README.md) - Architecture overview
- [Client Developer Guide](./packages/client/developer-guide.md) - Full developer guide (events, extending, conventions)

## Key Dependencies

- **Phaser:** 3.80.1
- **Colyseus:** 0.15.0
- **TypeScript:** 5.9.3
- **Vite:** 5.4.2

## License

MIT
