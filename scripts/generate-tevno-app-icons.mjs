import sharp from "sharp";
import { fileURLToPath } from "node:url";

// Rasterize the original white vector without altering the kit. The symbol's
// painted bounds fit within Android's central 66/108 safe circle at this scale.
const source = fileURLToPath(new URL("../public/branding/tevno-symbol-white.svg", import.meta.url));
const destination = fileURLToPath(new URL("../mobile/assets/branding/", import.meta.url));
const foreground = await sharp(source).resize(640, 640)
  .extend({ top: 192, bottom: 192, left: 192, right: 192, background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png().toBuffer();
await sharp(foreground).toFile(`${destination}adaptive-foreground.png`);
await sharp(foreground).flatten({ background: "#09090B" }).png().toFile(`${destination}app-icon-solid.png`);
