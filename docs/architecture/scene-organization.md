# Scene Organization Architecture

## Overview

This document outlines the recommended architecture for organizing Phaser game scenes following industry best practices. The goal is to maintain scalable, maintainable, and testable code as the project grows.

## Design Philosophy

### Core Principles

1. **Separation of Concerns** - Each component has a single, well-defined responsibility
2. **Composition over Inheritance** - Build complex scenes from simple, reusable components
3. **DRY (Don't Repeat Yourself)** - Extract common patterns into reusable utilities
4. **Single Responsibility Principle** - Each class should have only one reason to change
5. **Open/Closed Principle** - Open for extension, closed for modification

## Architecture Pattern: MVC/MVP

We use a **Model-View-Presenter (MVP)** pattern adapted for Phaser:

- **Scene** (Presenter) - Orchestrates components, handles lifecycle, manages state transitions
- **View Components** - Render UI, handle user interactions, emit events
- **Managers** (Model) - Handle business logic (network, storage, audio, etc.)
- **Utilities** - Pure functions for validation, formatting, calculations

## Directory Structure

```
packages/client/src/
├── scenes/                    # Scene orchestrators
│   ├── BootScene.ts          # Minimal - just asset loading
│   ├── MenuScene.ts          # Minimal - navigation only
│   ├── LobbyScene.ts         # Orchestrates lobby views
│   ├── GameScene.ts          # Orchestrates game modes
│   └── UIScene.ts            # Overlay UI management
│
├── components/               # Reusable UI components
│   ├── Button.ts            # Generic button component
│   ├── NetworkIndicator.ts  # Connection status display
│   ├── ReactionAnimation.ts # Visual effects
│   ├── ReactionPanel.ts     # Reaction UI
│   │
│   ├── lobby/               # Lobby-specific views
│   │   ├── MenuView.ts      # Main menu view
│   │   ├── JoinView.ts      # Room joining view
│   │   └── WaitingView.ts   # Waiting room view
│   │
│   └── game/                # Game-specific UI (modals, etc.)
│       ├── BaseModal.ts
│       ├── BiddingUI.ts
│       └── ...
│
├── managers/                # Business logic & state
│   ├── NetworkManager.ts    # Server communication
│   ├── AudioManager.ts      # Sound management
│   ├── GameManager.ts       # Game state
│   └── StorageManager.ts    # LocalStorage wrapper
│
├── modes/                   # Game mode strategies
│   ├── GameModeBase.ts     # Abstract base
│   ├── SoloGameMode.ts     # Bot game logic
│   └── MultiplayerGameMode.ts
│
├── objects/                 # Game objects
│   ├── Card.ts
│   ├── Player.ts
│   └── ...
│
└── utils/                   # Pure utility functions
    ├── constants.ts         # Game constants
    ├── uiConfig.ts         # UI configuration
    ├── validation.ts       # Validation functions
    └── ...
```

## Scene Lifecycle

### Scene Responsibilities

Scenes should **ONLY** handle:

1. ✅ Component initialization and cleanup
2. ✅ Lifecycle management (create, update, shutdown)
3. ✅ State transitions between views
4. ✅ Event coordination between components
5. ✅ Passing dependencies to components

Scenes should **NOT** contain:

1. ❌ Direct DOM manipulation (except Phaser objects)
2. ❌ Business logic (move to managers)
3. ❌ UI creation code (move to view components)
4. ❌ Validation logic (move to utilities)
5. ❌ Long methods (break into components)

### Example Scene Structure

```typescript
export default class LobbyScene extends Phaser.Scene {
  // Dependencies (injected or created)
  private networkManager!: NetworkManager;
  private storageManager!: StorageManager;

  // View components
  private menuView!: MenuView;
  private joinView!: JoinView;
  private waitingView!: WaitingView;

  // Scene state
  private currentView: 'menu' | 'join' | 'waiting' = 'menu';

  constructor() {
    super({ key: 'LobbyScene' });
  }

  create() {
    // Initialize dependencies
    this.initializeManagers();

    // Create components
    this.createViews();

    // Setup communication
    this.setupEventHandlers();

    // Show initial view
    this.showView('menu');
  }

  private initializeManagers() {
    /* ... */
  }
  private createViews() {
    /* ... */
  }
  private setupEventHandlers() {
    /* ... */
  }
  private showView(view: string) {
    /* ... */
  }

  shutdown() {
    // Cleanup in reverse order
    this.cleanupViews();
    this.cleanupManagers();
  }
}
```

## View Components

### Component Pattern

View components are classes that:

1. Extend or compose Phaser.GameObjects.Container
2. Create and manage their own UI elements
3. Emit events for user interactions (don't call scene methods directly)
4. Accept configuration through constructor
5. Provide public methods for state updates
6. Clean up resources in destroy()

### Example View Component

```typescript
export class MenuView {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private nameInput: any;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0);
    this.createUI();
  }

  private createUI() {
    // Create all UI elements
    const title = this.scene.add.text(...);
    this.nameInput = this.createInput();
    const button = this.createButton('Create Room', () => {
      this.emit('createRoom', this.nameInput.text);
    });

    this.container.add([title, this.nameInput, button]);
  }

  // Public API
  show() {
    this.container.setVisible(true);
  }

  hide() {
    this.container.setVisible(false);
  }

  getPlayerName(): string {
    return this.nameInput.text.trim();
  }

  setPlayerName(name: string) {
    this.nameInput.setText(name);
  }

  showError(message: string) {
    // Update error text
  }

  // Event emitter pattern
  private emit(event: string, data?: any) {
    this.scene.events.emit(`menuView:${event}`, data);
  }

  destroy() {
    this.container.destroy();
  }
}
```

### Benefits of View Components

1. **Isolation** - Changes to one view don't affect others
2. **Testability** - Can test view logic independently
3. **Reusability** - Views can be reused in different scenes
4. **Clarity** - Clear boundaries between different UI states
5. **Maintainability** - Easier to locate and fix issues

## Managers

### Manager Responsibilities

Managers handle cross-cutting concerns:

- **NetworkManager** - Server communication, connection state
- **AudioManager** - Sound effects, music, volume control
- **StorageManager** - LocalStorage with type safety
- **GameManager** - Game state, rules, scoring

### Manager Pattern

```typescript
export class StorageManager {
  private prefix = 'callbreak_';

  save(key: string, value: any): void {
    try {
      localStorage.setItem(this.prefix + key, JSON.stringify(value));
    } catch (error) {
      console.error(`Failed to save ${key}:`, error);
    }
  }

  load<T>(key: string, defaultValue?: T): T | null {
    try {
      const item = localStorage.getItem(this.prefix + key);
      return item ? JSON.parse(item) : (defaultValue ?? null);
    } catch (error) {
      console.error(`Failed to load ${key}:`, error);
      return defaultValue ?? null;
    }
  }

  remove(key: string): void {
    localStorage.removeItem(this.prefix + key);
  }
}
```

## Utilities

### Utility Functions

Pure functions without side effects:

- Validation (email, name, room code)
- Formatting (dates, numbers)
- Calculations (physics, scoring)
- Type guards

```typescript
// utils/validation.ts
export const validatePlayerName = (name: string): ValidationResult => {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Name is required' };
  }
  if (name.length > 20) {
    return { valid: false, error: 'Name too long (max 20 characters)' };
  }
  const sanitized = name.replace(/[<>]/g, '');
  if (sanitized !== name) {
    return { valid: false, error: 'Name contains invalid characters' };
  }
  return { valid: true, value: sanitized };
};

export const validateRoomCode = (code: string): ValidationResult => {
  const upperCode = code.trim().toUpperCase();
  if (upperCode.length !== 4) {
    return { valid: false, error: 'Room code must be 4 characters' };
  }
  if (!/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/.test(upperCode)) {
    return { valid: false, error: 'Invalid room code format' };
  }
  return { valid: true, value: upperCode };
};
```

## Communication Patterns

### Event-Driven Architecture

Components communicate through events:

1. **View → Scene** (User interactions)

   ```typescript
   // In View
   button.on('click', () => {
     this.scene.events.emit('menuView:createRoom', playerName);
   });

   // In Scene
   this.events.on('menuView:createRoom', this.handleCreateRoom, this);
   ```

2. **Manager → Scene** (State changes)

   ```typescript
   // In Manager
   this.emit('playerJoined', playerData);

   // In Scene
   networkManager.on('playerJoined', this.updatePlayersList, this);
   ```

3. **Scene → View** (Display updates)
   ```typescript
   // In Scene
   this.waitingView.updatePlayersList(players);
   this.waitingView.showError('Room full');
   ```

### Benefits

- Loose coupling between components
- Easy to add/remove event listeners
- Clear data flow
- Easier debugging and testing

## Migration Strategy

### Step-by-Step Refactoring

1. **Identify Views** - List distinct UI states
2. **Extract Utilities** - Move pure functions first
3. **Create Managers** - Centralize business logic
4. **Build View Components** - One at a time
5. **Update Scene** - Wire components together
6. **Test** - Verify functionality
7. **Remove Dead Code** - Clean up old code

### Gradual Adoption

- Start with one scene (LobbyScene is a good candidate)
- Keep old code until new code is tested
- Use feature flags if needed
- Document changes for team

## Best Practices

### DO

✅ Keep scenes thin (orchestration only)
✅ Use composition over inheritance
✅ Emit events for communication
✅ Validate input at the boundary
✅ Handle errors gracefully
✅ Clean up resources in shutdown/destroy
✅ Use TypeScript types for safety
✅ Write self-documenting code
✅ Keep methods small (< 20 lines)

### DON'T

❌ Put all code in scene create() method
❌ Create deep inheritance hierarchies
❌ Directly access properties across components
❌ Ignore memory leaks
❌ Repeat validation logic
❌ Use magic numbers/strings
❌ Mix UI and business logic
❌ Forget to remove event listeners

## Testing

### Unit Testing Components

```typescript
describe('MenuView', () => {
  let scene: Phaser.Scene;
  let menuView: MenuView;

  beforeEach(() => {
    scene = createMockScene();
    menuView = new MenuView(scene);
  });

  it('should emit createRoom event with player name', () => {
    const spy = jest.fn();
    scene.events.on('menuView:createRoom', spy);

    menuView.setPlayerName('TestPlayer');
    menuView.triggerCreateRoom();

    expect(spy).toHaveBeenCalledWith('TestPlayer');
  });

  afterEach(() => {
    menuView.destroy();
  });
});
```

### Integration Testing

Test scene orchestration:

- View transitions work correctly
- Events propagate properly
- State updates as expected

## Performance Considerations

1. **Object Pooling** - Reuse game objects where possible
2. **Lazy Loading** - Create views only when needed
3. **Destroy Properly** - Always clean up in shutdown()
4. **Avoid Creating in Update** - Create in create(), update in update()
5. **Batch Updates** - Update UI once per frame, not per event

## Common Patterns

### Loading States

```typescript
private async handleCreateRoom() {
  this.menuView.setLoading(true);
  try {
    const room = await this.networkManager.createRoom(playerName);
    this.showView('waiting');
  } catch (error) {
    this.menuView.showError(error.message);
  } finally {
    this.menuView.setLoading(false);
  }
}
```

### Form Validation

```typescript
private validateForm(): boolean {
  const nameResult = validatePlayerName(this.menuView.getPlayerName());
  if (!nameResult.valid) {
    this.menuView.showError(nameResult.error);
    return false;
  }
  return true;
}
```

### State Machines

```typescript
private transitions = {
  menu: ['join', 'waiting'],
  join: ['menu', 'waiting'],
  waiting: ['menu'],
};

private canTransition(from: string, to: string): boolean {
  return this.transitions[from]?.includes(to) ?? false;
}
```

## Conclusion

This architecture provides:

- **Scalability** - Easy to add new features
- **Maintainability** - Easy to understand and modify
- **Testability** - Components can be tested in isolation
- **Reusability** - Components can be shared across scenes
- **Performance** - Efficient resource management

Following these patterns will help maintain code quality as the project grows and make it easier for new developers to contribute.

## References

- [Phaser 3 Examples](https://labs.phaser.io/)
- [Game Programming Patterns](https://gameprogrammingpatterns.com/)
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)
- [Clean Code by Robert C. Martin](https://www.amazon.com/Clean-Code-Handbook-Software-Craftsmanship/dp/0132350882)
