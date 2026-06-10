# Art assets

The game currently renders **placeholder vector shapes** on canvas. Real art
can be dropped in without touching gameplay code via the sprite registry
(`src/game/sprites.ts`):

```ts
import { registerSprites } from '../game/sprites';

registerSprites({
  'tower.guardianNiko': '/assets/sprites/niko.png',
  'enemy.fudBeast': '/assets/sprites/fud-beast.png',
});
```

Once an image is registered and loaded, the renderer uses it automatically;
otherwise it falls back to the placeholder shape.

## Sprite keys

| Key                  | Drawn at (logical px) | Description                                |
| -------------------- | --------------------- | ------------------------------------------ |
| `tower.diamondPaw`   | 60×60 tile            | Diamond Paw Tower                          |
| `tower.howlCannon`   | 60×60 tile            | Howl Cannon (splash)                       |
| `tower.blueFlame`    | 60×60 tile            | Blue Flame Tower (burn)                    |
| `tower.packScout`    | 60×60 tile            | Pack Scout Tower (slow)                    |
| `tower.guardianNiko` | 60×60 tile            | Guardian NIKO hero tower                   |
| `enemy.jeet`         | 24×24                 | Jeet (fast, low HP)                        |
| `enemy.rugger`       | 32×32                 | Rugger (slow, high HP)                     |
| `enemy.bot`          | 16×16                 | Bot Swarm unit                             |
| `enemy.sniper`       | 22×22                 | Sniper (fast, evasive)                     |
| `enemy.fudBeast`     | 48×48                 | FUD Beast boss                             |
| `map.vault`          | 60×60 tile            | The Base Vault                             |

NFT skins (future): `SkinProvider.getUnlockedSkins()` in
`src/utils/integrations.ts` returns key→URL overrides that should be passed to
`registerSprites()` at startup.
