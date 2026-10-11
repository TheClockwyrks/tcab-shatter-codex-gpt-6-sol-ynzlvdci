# Shatter

Shatter is a browser rock shooter set around a gravity well. Fly by momentum, break armored rocks into smaller fragments, and clear each wave while a saucer hunts you. The star bends bullets and rocks, but your ship and its guided torpedo fly free of the pull.

## Run locally

```sh
npm ci
npm run dev
```

Open the address printed by Vite. To build a static site:

```sh
npm run build
```

The complete site is emitted to `dist/` and can be served from any static host. Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run format` to check the source.

## Controls

| Key | Action |
| --- | --- |
| Arrow keys or WASD | Turn left/right and thrust up; up/down move menu selection |
| Space | Fire; confirm a menu choice |
| F | Launch a homing torpedo when charged |
| Enter | Confirm a menu choice |
| Escape or P | Pause/resume; Escape also leaves menus |
| M | Mute/unmute |
| Backquote | Toggle the debug overlay |

Menus also respond to mouse and touch. The torpedo recharges over ten seconds. Its narrow forward cone acquires the nearest target, and one hit destroys a rock regardless of armor.
