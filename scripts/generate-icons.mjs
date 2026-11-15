// Renders the PWA icons from an SVG. Run: npm run icons
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const mark = (pad) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs><radialGradient id="g" cx="70%" cy="20%" r="80%"><stop offset="0" stop-color="#132a55"/><stop offset="1" stop-color="#050608"/></radialGradient></defs>
  <rect width="512" height="512" fill="url(#g)"/>
  <g transform="translate(${pad} ${pad}) scale(${(512 - pad * 2) / 512})">
    <path d="M112 320 L208 224 L272 272 L384 144" fill="none" stroke="#1f75ff" stroke-width="40" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M320 144 H384 V208" fill="none" stroke="#1f75ff" stroke-width="40" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="96" y="360" width="320" height="40" rx="20" fill="#eef2f8"/>
  </g>
</svg>`;

mkdirSync("public/icons", { recursive: true });
const jobs = [
  ["public/icons/icon-192.png", 192, 24],
  ["public/icons/icon-512.png", 512, 24],
  ["public/icons/icon-maskable-512.png", 512, 90],
  ["public/icons/apple-touch-icon.png", 180, 40],
];
for (const [file, size, pad] of jobs) {
  await sharp(Buffer.from(mark(pad))).resize(size, size).png().toFile(file);
  console.log("wrote", file);
}

// Native iOS assets (only if the Capacitor iOS project exists).
import { existsSync } from "node:fs";
if (existsSync("ios/App/App/Assets.xcassets")) {
  // App Store icon: 1024x1024, no transparency.
  await sharp(Buffer.from(mark(60))).resize(1024, 1024).flatten({ background: "#050608" }).removeAlpha().png().toFile("ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png");
  // Launch screen: logo centred on the app's black background. scaleAspectFill crops edges, so keep the mark small.
  const splash = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2732 2732"><rect width="2732" height="2732" fill="#050608"/><g transform="translate(1066 1066) scale(1.171875)">${mark(60).replace(/^[\s\S]*?<rect width="512" height="512" fill="url\(#g\)"\/>/, "").replace(/<\/svg>\s*$/, "")}</g></svg>`;
  for (const f of ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"]) {
    await sharp(Buffer.from(splash)).png().toFile(`ios/App/App/Assets.xcassets/Splash.imageset/${f}`);
  }
  console.log("wrote iOS app icon and splash");
}
