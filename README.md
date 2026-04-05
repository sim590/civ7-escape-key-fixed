# EscapeKeyFixed

A [Civilization VII](https://store.steampowered.com/app/1295660/) mod that restores the Civilization VI Escape key behavior: pressing Escape **deselects the current unit or city first**, instead of immediately opening the pause menu.

[Steam Workshop](https://steamcommunity.com/sharedfiles/filedetails/?id=3700086996)

## The Problem

In the base game, pressing Escape while a unit or city is selected skips deselection entirely and opens the pause menu. This is a regression from Civilization VI, where Escape would first deselect, and only open the menu on a second press.

Two separate bugs cause this:

1. **Unit selection:** `WorldInput` handles the `"cancel"` action (gamepad) but not `"keyboard-escape"` (keyboard). The event passes through unhandled and reaches `root-game.js`, which opens the pause menu.

2. **City production panel:** When the panel is open, the `FocusManager` dispatches the input event on a focused DOM element inside the panel. Because `InputEngineEvent` has `bubbles: true`, the event bubbles up to `window`, where `root-game.js` catches it and opens the pause menu — before the `ContextManager` handler chain is ever reached.

## The Solution

The mod uses a dual interception mechanism:

- **Window capture listener** — Intercepts `keyboard-escape` during the FocusManager's internal DOM dispatch, using `capture: true` on `window` so it fires before `root-game.js`'s bubble-phase listener. Handles the **city production** case.

- **ContextManager handler** — Registered via `ContextManager.registerEngineInputHandler()`, fires when the FocusManager is not active (no focused panel). Handles the **unit selection** case.

Both mechanisms share a `shouldIntercept()` guard that checks the event is `keyboard-escape`, has `FINISH` status, and the current interface mode is neither default nor pause menu. When intercepted, the mod calls `InterfaceMode.switchToDefault()`, which deselects units and cities.

## Installation

### Steam Workshop (recommended)

Subscribe on the [Steam Workshop page](https://steamcommunity.com/sharedfiles/filedetails/?id=3700086996). The mod will be installed automatically.

### Manual installation

1. Download or clone this repository.
2. Copy (or symlink) the folder into your Civilization VII mods directory:
   - **Windows:** `%USERPROFILE%\My Games\Sid Meier's Civilization VII\Mods\`
   - **Linux:** `~/My Games/Sid Meier's Civilization VII/Mods/`
   - **macOS:** `~/My Games/Sid Meier's Civilization VII/Mods/`
3. Enable **EscapeKeyFixed** in the game's mod menu.

Only the `escape-key-fixed.modinfo` file and the `ui/` directory are required.

## Compatibility

- UI-only mod — does **not** affect saved games.
- Compatible with other mods unless they also override Escape key handling.

## License

[GNU General Public License v3.0 or later](LICENSE)
