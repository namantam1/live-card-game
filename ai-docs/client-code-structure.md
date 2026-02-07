# Client Code Structure + Component Pattern (AI Reference)

Purpose: Give a quick, reliable map of the client architecture and the expected patterns for new/updated scenes and components. This doc is optimized for AI usage when implementing or refactoring features.

## High-Level Structure (packages/client/src)

- scenes/ : Scene orchestrators (Phaser.Scene). Own lifecycle + wiring only.
- components/ : Reusable UI components and view modules.
  - components/lobby/ : Lobby-specific views (MenuView, JoinView, WaitingView).
  - components/game/ : Game-specific UI (modals, overlays, etc.).
- managers/ : Business logic and cross-cutting services (network, audio, storage).
- utils/ : Pure functions (validation, formatting, config).
- objects/ : Game objects/entities.
- modes/ : Game mode strategy layer.
- machines/ : State machines (XState or similar), when used for complex flows.

Guiding idea: Scenes orchestrate; views render; managers do business logic; utils are pure; objects represent game entities.

## Scene Organization (Orchestrator Pattern)

Scenes should:

- Instantiate managers and views.
- Connect event flows (view -> scene -> managers -> view).
- Manage view transitions.
- Handle Phaser lifecycle (create/update/shutdown).

Scenes should NOT:

- Build UI details (belongs in views).
- Contain validation logic (belongs in utils).
- Own business logic (belongs in managers).

## Component/View Pattern (Reference: MenuView.ts)

Use MenuView.ts in `packages/client/src/components/lobby/MenuView.ts` as the canonical pattern.

### Expected Shape

- Class-based view (not a Scene).
- Constructor accepts `scene` and `callbacks`.
- Creates a root `container` for all view objects.
- `createUI()` builds all UI for the view.
- Public API exposes show/hide/update methods.
- Cleanup via `destroy()`.

### Pseudocode Template

```ts
export interface MyViewCallbacks {
  onPrimaryAction: () => void;
  onSecondaryAction: () => void;
}

export class MyView {
  private scene: Phaser.Scene;
  public container: Phaser.GameObjects.Container;
  private callbacks: MyViewCallbacks;
  private isProcessing = false;

  constructor(scene: Phaser.Scene, callbacks: MyViewCallbacks) {
    this.scene = scene;
    this.callbacks = callbacks;
    this.container = this.scene.add.container(0, 0);
    this.createUI();
  }

  private createUI() {
    const { width, height } = this.scene.cameras.main;
    const centerX = width / 2;
    const centerY = height / 2;

    // Build UI elements here
    // Add all UI nodes to this.container
  }

  // Public API
  show() {
    this.setVisible(true);
  }
  hide() {
    this.setVisible(false);
  }
  setVisible(visible: boolean) {
    this.container.setVisible(visible);
  }

  setButtonsEnabled(enabled: boolean) {
    this.isProcessing = !enabled;
    // update alpha + interactive state for buttons
  }

  destroy() {
    this.container.destroy();
  }
}
```

### MenuView Specific Patterns to Reuse

- UI assembly happens in `createUI()`, not in the scene.
- Input field uses shared helper (`Common.createInputField`).
- Buttons are created via a shared component (`Button.create`).
- Buttons gate actions with `isProcessing` (avoid double submits).
- Public API includes: `show()`, `hide()`, `setVisible()`, state setters (`setConnectionStatus`, `setButtonsEnabled`), and data getters (`getPlayerName`).

## Event / Callback Flow

Preferred pattern for views:

- View emits actions via callbacks (passed in by scene).
- Scene handles orchestration, validation, async flows.
- Managers perform IO/side effects.

Avoid:

- Views calling managers directly.
- Views calling scene methods by import or global access.
- Managers manipulating view objects.

## Anti-Patterns (What to Avoid)

- Putting business logic or network calls in a view.
- Building UI directly in Scene `create()` beyond view instantiation.
- Sharing mutable state directly between views.
- Creating Phaser objects outside `createUI()` or the view constructor.
- Forgetting cleanup (destroy input + container).

## File/Folder Placement Rules of Thumb

- New scene UI = new view component in `components/<domain>/`.
- Cross-scene UI = generic component in `components/` root.
- Anything involving server, storage, or audio = manager in `managers/`.
- Validation or formatting = `utils/`.
- State transitions too complex for if/else = `machines/`.

## Quick Checklist for New Features

- Does the scene only orchestrate?
- Is the UI built inside a view component?
- Are async actions gated (disable buttons while processing)?
- Are view public methods small and focused?
- Is validation in `utils/validation.ts` (or another util)?
- Is cleanup handled (destroy input/container)?

## Why This Pattern

- Smaller, focused files.
- Clear separation of concerns.
- Easier testing of views and managers.
- Safer refactors (less coupling).

Use this as the default blueprint for any new client feature, scene, or UI view.
