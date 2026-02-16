# @call-break/client

Phaser 3 game client for Call Break (and future card games). Built with Vite and TypeScript.

## Architecture

The client uses a **Service Locator + Event Bus** pattern to decouple components:

```
                    ServiceLocator
                   (global registry)
                         |
          +--------------+--------------+
          |              |              |
       EventBus    NetworkService   AudioManager
       (pub/sub)   (Colyseus)      (sounds)
          |
   +------+------+------+
   |      |      |      |
 Scenes  Modes  Games  Components
```

### Layers

| Layer          | Directory         | Responsibility                                                          |
| -------------- | ----------------- | ----------------------------------------------------------------------- |
| **Core**       | `src/core/`       | ServiceLocator, GameRegistry, ModeRegistry, GameInstance                |
| **Services**   | `src/services/`   | EventBus (typed pub/sub), NetworkService (Colyseus)                     |
| **Games**      | `src/games/`      | Game rules, scoring, AI, rendering config (extends `BaseGame`)          |
| **Modes**      | `src/modes/`      | How game is played: Solo vs AI, Multiplayer online (extends `BaseMode`) |
| **Scenes**     | `src/scenes/`     | Phaser scenes: Boot, Menu, Lobby, Game, UI                              |
| **Components** | `src/components/` | UI: modals, panels, overlays, lobby views, shared widgets               |
| **Objects**    | `src/objects/`    | Game entities: Card, Hand, Player, TrickArea                            |

### Data Flow

```
Server (Colyseus)
    |
NetworkService ----publishes----> EventBus
                                     |
                           +---------+---------+
                           |         |         |
                        Scenes    Modes    Components
                           |
                      GameInstance
                       /        \
                   BaseGame   BaseMode
                (rules/config) (how to play)
```

- **NetworkService** receives all Colyseus state changes and messages, publishes them to **EventBus**
- **Scenes** subscribe via **ScopedEventBus** (auto-cleanup on scene shutdown)
- **GameInstance** coordinates a game + mode pair for the current session
- **Games** define rules and rendering config (no Phaser dependency)
- **Modes** define solo/multiplayer behavior (game-agnostic)

### Scene Flow

```
BootScene -> MenuScene -> LobbyScene -> GameScene <-> UIScene
                |                          ^
            (Solo: directly to GameScene)
```

## Development

```bash
# From monorepo root
npm run dev        # Start client dev server (port 5173)
npm run dev:all    # Start client + server + shared watch
```

## Extending

- **Add a new game**: Create class extending `BaseGame` in `src/games/`, register in `main.ts`. See [developer-guide.md](./developer-guide.md#how-to-add-a-new-card-game).
- **Add a new mode**: Create class extending `BaseMode` in `src/modes/`, register in `main.ts`. See [developer-guide.md](./developer-guide.md#how-to-add-a-new-game-mode).
- **Add a new event**: Add to typed event map in `EventBus.ts`. See [developer-guide.md](./developer-guide.md#how-to-add-a-new-event).

Full details in [developer-guide.md](./developer-guide.md).
