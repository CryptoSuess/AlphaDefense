/**
 * Sprite registry.
 *
 * The renderer asks for sprites by key (e.g. 'tower.guardianNiko'). If an
 * image has been registered and loaded it is drawn; otherwise the renderer
 * falls back to its placeholder vector shapes. This means real art (or NFT
 * skins) can be dropped in later without touching gameplay or render code:
 *
 *   registerSprite('tower.guardianNiko', '/assets/sprites/niko.png');
 *
 * See src/assets/README.md for the full key list.
 */
const sprites = new Map<string, HTMLImageElement>();

export function registerSprite(key: string, url: string): void {
  const img = new Image();
  img.src = url;
  img.onload = () => sprites.set(key, img);
}

export function registerSprites(map: Record<string, string>): void {
  for (const [key, url] of Object.entries(map)) registerSprite(key, url);
}

/** Returns the loaded image for a key, or null to use the placeholder shape. */
export function getSprite(key: string): HTMLImageElement | null {
  return sprites.get(key) ?? null;
}
