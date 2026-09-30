// Rasterize the brand emblem (app/icon.svg) into the PNG set a PWA needs.
// Re-run whenever the logo changes: node scripts/generate-icons.js
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const svg = fs.readFileSync(path.join(__dirname, "..", "app", "icon.svg"));
const out = path.join(__dirname, "..", "public", "icons");
fs.mkdirSync(out, { recursive: true });

const CREAM = "#efe0bf";

(async () => {
  for (const size of [192, 512]) {
    await sharp(svg, { density: 300 })
      .resize(size, size)
      .png()
      .toFile(path.join(out, `icon-${size}.png`));
  }

  // Maskable: emblem at ~80% on a full-bleed cream square so Android's
  // adaptive-icon crop never clips the roundel.
  const inner412 = await sharp(svg, { density: 300 }).resize(412, 412).png().toBuffer();
  await sharp({ create: { width: 512, height: 512, channels: 4, background: CREAM } })
    .composite([{ input: inner412, gravity: "center" }])
    .png()
    .toFile(path.join(out, "maskable-512.png"));

  // Apple touch icon: opaque cream background (iOS fills transparency with black).
  const inner150 = await sharp(svg, { density: 300 }).resize(150, 150).png().toBuffer();
  await sharp({ create: { width: 180, height: 180, channels: 4, background: CREAM } })
    .composite([{ input: inner150, gravity: "center" }])
    .png()
    .toFile(path.join(out, "apple-touch-icon.png"));

  console.log("icons written to public/icons");
})();
