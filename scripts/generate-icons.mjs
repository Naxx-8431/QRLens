/*
 * Draws the QR Lens icon — viewfinder brackets around a single dot — and writes
 * every icon the app needs. On Android it is a Material adaptive icon with a
 * monochrome layer, so launchers can theme it (Material You themed icons, the
 * Nothing icon pack) and it sits naturally next to other themed icons.
 *
 * Run everything with:  npm run icons
 *   1. node scripts/generate-icons.mjs            draws the sources into assets/ and public/
 *   2. capacitor-assets generate --android        legacy launcher PNGs + splash screens
 *   3. node scripts/generate-icons.mjs --android  writes the vector adaptive + themed icon
 */
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'

const RED = '#d71921'

/*
 * Geometry, in the 108 × 108 unit canvas Android uses for adaptive icons.
 * Launchers only show the middle 72 units, and themed-icon guidance keeps the
 * glyph within roughly 44 of them — this one is 44.6 wide including its stroke.
 */
const C = 54 // centre
const E = 20 // half-width of the bracket square
const R = 5.5 // corner radius
const ARM = 7 // straight part of each bracket arm
const STROKE = 4.6
const DOT = 6.6

const lo = C - E
const hi = C + E
const BRACKETS = [
  `M${lo},${lo + R + ARM}V${lo + R}a${R},${R} 0 0 1 ${R},${-R}H${lo + R + ARM}`,
  `M${hi - R - ARM},${lo}H${hi - R}a${R},${R} 0 0 1 ${R},${R}V${lo + R + ARM}`,
  `M${hi},${hi - R - ARM}V${hi - R}a${R},${R} 0 0 1 ${-R},${R}H${hi - R - ARM}`,
  `M${lo + R + ARM},${hi}H${lo + R}a${R},${R} 0 0 1 ${-R},${-R}V${hi - R - ARM}`,
].join('')
const DOT_PATH = `M${C - DOT},${C}a${DOT},${DOT} 0 1 0 ${DOT * 2},0a${DOT},${DOT} 0 1 0 ${-DOT * 2},0z`

const glyphSvg = (dotColor = RED) =>
  `<path d="${BRACKETS}" fill="none" stroke="#fff" stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round"/>` +
  `<path d="${DOT_PATH}" fill="${dotColor}"/>`

/**
 * A square icon. `view` is how many of the 108 canvas units are visible:
 * 72 matches what a launcher shows; larger values add padding.
 */
function iconSvg({ size, view = 72, background = '#000' }) {
  const o = (108 - view) / 2
  const bg = background ? `<rect x="${o}" y="${o}" width="${view}" height="${view}" fill="${background}"/>` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${o} ${o} ${view} ${view}">${bg}${glyphSvg()}</svg>`
}

/* ---------- Android: vector adaptive icon + themed (monochrome) layer ---------- */

function vectorDrawable(dotColor) {
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<vector xmlns:android="http://schemas.android.com/apk/res/android"',
    '    android:width="108dp"',
    '    android:height="108dp"',
    '    android:viewportWidth="108"',
    '    android:viewportHeight="108">',
    '    <path',
    `        android:pathData="${BRACKETS}"`,
    '        android:strokeColor="#FFFFFF"',
    `        android:strokeWidth="${STROKE}"`,
    '        android:strokeLineCap="round"',
    '        android:strokeLineJoin="round" />',
    '    <path',
    `        android:pathData="${DOT_PATH}"`,
    `        android:fillColor="${dotColor}" />`,
    '</vector>',
    '',
  ].join('\n')
}

function writeAndroidAdaptiveIcon() {
  const res = 'android/app/src/main/res'
  mkdirSync(`${res}/drawable`, { recursive: true })

  writeFileSync(`${res}/drawable/ic_launcher_foreground.xml`, vectorDrawable('#D71921'))
  // Launchers tint this layer with one colour, so the dot is white here.
  writeFileSync(`${res}/drawable/ic_launcher_monochrome.xml`, vectorDrawable('#FFFFFF'))
  writeFileSync(
    `${res}/values/ic_launcher_background.xml`,
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#000000</color>\n</resources>\n'
  )

  // The Capacitor template ships a v24 foreground with the same name; it would win over ours.
  const stale = `${res}/drawable-v24/ic_launcher_foreground.xml`
  if (existsSync(stale)) rmSync(stale)

  const adaptive = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">',
    '    <background android:drawable="@color/ic_launcher_background" />',
    '    <foreground android:drawable="@drawable/ic_launcher_foreground" />',
    '    <monochrome android:drawable="@drawable/ic_launcher_monochrome" />',
    '</adaptive-icon>',
    '',
  ].join('\n')
  for (const name of ['ic_launcher', 'ic_launcher_round']) {
    writeFileSync(`${res}/mipmap-anydpi-v26/${name}.xml`, adaptive)
  }
  console.log('Android adaptive + themed icon written')
}

/* ---------- sources for the web app and for capacitor-assets ---------- */

async function drawSources() {
  const png = (svg, size, file) => sharp(Buffer.from(svg)).resize(size, size).png().toFile(file)
  const black = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="#000"/></svg>`

  mkdirSync('assets', { recursive: true })
  mkdirSync('public', { recursive: true })

  // In-app mark and browser tab icon.
  writeFileSync('assets/mark.svg', iconSvg({ size: 512 }))
  writeFileSync('public/favicon.svg', iconSvg({ size: 64, view: 56, background: null }))

  await Promise.all([
    // Sources for @capacitor/assets (launcher PNGs for Android 7 and splash screens).
    png(iconSvg({ size: 1024 }), 1024, 'assets/icon-only.png'),
    png(iconSvg({ size: 1024 }), 1024, 'assets/icon.png'),
    png(iconSvg({ size: 1024, background: null }), 1024, 'assets/icon-foreground.png'),
    png(black, 1024, 'assets/icon-background.png'),
    png(iconSvg({ size: 2732, view: 400 }), 2732, 'assets/splash.png'),
    png(iconSvg({ size: 2732, view: 400 }), 2732, 'assets/splash-dark.png'),
    // Web app (PWA) icons.
    png(iconSvg({ size: 512 }), 192, 'public/icon-192.png'),
    png(iconSvg({ size: 512 }), 512, 'public/icon-512.png'),
    png(iconSvg({ size: 512, view: 96 }), 512, 'public/icon-maskable-512.png'),
    png(iconSvg({ size: 512 }), 180, 'public/apple-touch-icon.png'),
  ])
  console.log('Icons written to assets/ and public/')
}

if (process.argv.includes('--android')) writeAndroidAdaptiveIcon()
else await drawSources()
