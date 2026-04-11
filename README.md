# EscapeKeyFixed

A [Civilization VII](https://store.steampowered.com/app/1295660/) mod that restores the Civilization VI Escape key behavior: pressing Escape **deselects the current unit or city first** and **closes open panels** (e.g., leader attributes), instead of immediately opening the pause menu. In placement modes (e.g., building placement), Escape returns to the **parent screen** (e.g., city production) instead of going straight to the map.

[Steam Workshop](https://steamcommunity.com/sharedfiles/filedetails/?id=3700086996)

## The Problem

In the base game, pressing Escape while a unit or city is selected skips deselection entirely and opens the pause menu. This is a regression from Civilization VI, where Escape would first deselect, and only open the menu on a second press. Additionally, pressing Escape in placement modes (e.g., placing a building) jumps straight to the map instead of returning to the parent screen (e.g., city production).

Three separate bugs cause this:

1. **Unit selection:** `WorldInput` handles the `"cancel"` action (gamepad) but not `"keyboard-escape"` (keyboard). The event passes through unhandled and reaches `root-game.js`, which opens the pause menu.

2. **City production panel:** When the panel is open, the `FocusManager` dispatches the input event on a focused DOM element inside the panel. Because `InputEngineEvent` has `bubbles: true`, the event bubbles up to `window`, where `root-game.js` catches it and opens the pause menu — before the `ContextManager` handler chain is ever reached.

3. **Panels in default mode** (e.g., leader attributes): The panel handles Escape via a `window` bubble listener, but `root-game.js` was registered first and fires before the panel's listener. Both the pause menu and the panel close simultaneously.

## The Solution

The mod uses a dual interception mechanism:

- **Window capture listener** — Intercepts `keyboard-escape` during the FocusManager's internal DOM dispatch, using `capture: true` on `window` so it fires before `root-game.js`'s bubble-phase listener. Handles the **city production** and **panel close** cases.

- **ContextManager handler** — Registered via `ContextManager.registerEngineInputHandler()`, fires when the FocusManager is not active (no focused panel). Handles the **unit selection** case.

Both mechanisms delegate to `cancelOrDefault()`, which first calls `InterfaceMode.handleInput()` to reuse each mode's native cancel logic (e.g., building placement → city production, unit placement → unit selected). If the mode handler does not consume the event, it falls back to `InterfaceMode.switchToDefault()` to deselect units and cities.

### Safety guards

- **Pause menu check** — The mod checks `ContextManager.canOpenPauseMenu()` before acting. When it returns `false` (age transitions, cinematics, diplomacy, endgame screen, etc.), native handlers are left in control. Without this, intercepting Escape during an age transition would freeze the game.

- **Infinite call cycle prevention** — Some interface modes (e.g., commander promotion) re-dispatch a copy of the input event on a DOM element. This would cause an infinite loop with the capture listener. A shared `isProcessing` flag breaks the cycle, allowing the re-dispatched event to reach the panel's own handler.

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

## Changelog

### v1.1.1

- Fixed: Escape no longer freezes the game during age transitions, cinematics, diplomacy, or the endgame screen.
- Fixed: Escape now works correctly in the commander promotion panel (was silently broken by an infinite call cycle).

### v1.1.0

- Smart cancel in placement modes: Escape returns to the parent screen (e.g., building placement → city production) instead of going straight to the map.

### v1.0.2

- Fixed: PopupSequencer screens (e.g., unlock notifications) are now closed properly via `askForClose()`, preventing orphaned display requests.

### v1.0.1

- Fixed: Panels open in default mode (e.g., leader attributes) are now closed before the pause menu can open.

### v1.0.0

- Initial release. Escape deselects the current unit or city before opening the pause menu.
