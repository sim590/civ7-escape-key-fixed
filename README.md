# EscapeKeyFixed

A [Civilization VII](https://store.steampowered.com/app/1295660/) mod that restores the Civilization VI Escape key behavior for unit selection: pressing Escape while a unit is selected **deselects the unit** instead of opening the pause menu.

Recent Civilization VII updates now handle Escape natively in panels and menus, so the mod no longer needs to intercept those cases. Its only job is unit deselection.

[Steam Workshop](https://steamcommunity.com/sharedfiles/filedetails/?id=3700086996)

## The Problem

In the base game, pressing Escape while a unit is selected skips deselection entirely and opens the pause menu. This is a regression from Civilization VI, where Escape would first deselect the unit, and only open the menu on a second press.

## The Solution

The mod uses two complementary mechanisms:

- **Window capture listener** — When a unit is selected, the `FocusManager` dispatches the input event on a focused element inside the unit actions panel. Because the event bubbles, `root-game.js` would open the pause menu before the `ContextManager` handlers run. The capture listener intercepts this inner dispatch first.

- **ContextManager handler** — Covers the case where no element has focus and the event reaches the engine input handlers.

Both use the same guard. Escape only deselects the unit when:

1. the event is a finished `keyboard-escape`;
2. no panel or screen is open (`ContextManager.isEmpty`), so the game's native Escape handling stays in control;
3. the current interface mode is `INTERFACEMODE_UNIT_SELECTED`;
4. `ContextManager.canOpenPauseMenu()` returns `true`.

When those conditions are met, the mod calls `InterfaceMode.switchToDefault()`, which deselects the unit, and consumes the event so `root-game.js` does not open the pause menu.

### Input handler return values

This is the part that broke with the new game version. `ContextManager` input handlers now return `InputHandlerState.Active` or `InputHandlerState.Handled`, not a boolean. Returning `true` is equivalent to `Handled` (1) and consumes the event, so the old boolean-based handler swallowed every input event that reached it, including camera keys such as WASD.

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

### v2.0.0

- Fixed: Escape now deselects the current unit again on the current game version.
- Fixed: the input handler now returns `InputHandlerState` values instead of booleans, so it no longer swallows unrelated input such as WASD.
- Removed: panel and menu handling. The game now handles Escape natively in menus and panels.
- Removed: placement-mode parent-screen navigation (also native now).

### v1.1.2

- Fixed: Mini-map sub-panels (map filters, multiplayer chat, yields, etc.) can now be reopened after closing them with Escape. Previously, the toggle state would desynchronize and the panel would open and close immediately on the next click.

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
