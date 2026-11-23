# QRLens

**QRLens** is a fast, private **QR code and barcode scanner and generator**, built with **React** and **Capacitor**. One codebase runs as an **Android app** and as an **installable web app**.

Version 2 is a full redesign: pure dark, dot-matrix type and frosted glass, inspired by Nothing OS.

Everything — decoding, link checks, history — happens on your device. Nothing you scan is uploaded.

**[Download the latest APK](https://github.com/Naxx-8431/QRLens/releases/latest)**

---

## Features

### Scanning
- Live camera scanning with flash, zoom and camera switch (where the device supports them)
- QR, Aztec, Data Matrix, PDF417, EAN-13/8, UPC-A/E, Code 128/39/93, Codabar and ITF
- Scan from a saved image; on the web you can also drop or paste one
- Batch mode: keep scanning, results collect in history
- On-screen outline of the detected code, optional vibrate and beep

### Smart results
- Links, Wi-Fi, contacts (vCard / MECARD), email, SMS, phone numbers, locations, calendar events, 2FA keys, UPI and crypto payments, product codes and ISBNs each get their own view and actions
- On-device link check: flags HTTP, shortened links, raw IP addresses, look-alike domains, disguised destinations and direct downloads before you open anything
- Copy, share, save a contact, add to calendar, open in maps, search the web

### QR code generation
- Nine code types: text, link, Wi-Fi, contact, email, message, phone, location and event
- Live preview as you type
- Dot patterns, corner styles, colours, error-correction level and a centre logo
- Export as PNG (512–2048 px) or SVG, share, or copy to the clipboard

### History
- Every scanned and created code, searchable
- Stars, filters and CSV export
- Stored only on the device; can be switched off

### Design
- Pure dark interface with a single red accent
- Dot-matrix headings and monospaced labels
- Frosted-glass navigation pill, scanner controls and result sheets
- Material themed (monochrome) launcher icon, so it matches themed icon packs

### Android and web
- Android app built with Capacitor: camera permission handling, native file saving and share sheet, back button closes sheets
- Web app: installable (PWA), works offline, responsive from phone to desktop

---

## Tech Stack

- **React 19** and **Vite**
- **JavaScript (ES2020+)** and plain **CSS**
- **Capacitor 8** — Camera, Filesystem, Share
- **barcode-detector / zxing-wasm** — barcode decoding (ZXing compiled to WebAssembly, bundled with the app); the browser's built-in detector is used when available
- **qrcode** — QR matrix generation; the styled rendering is done in the app
- **Doto**, **Space Grotesk** and **Space Mono** — open-source fonts, bundled

---

## Architecture Highlights

- Logic is separate from UI: parsing, link checks, QR rendering, the scanner engine and storage live in `src/lib` and have no React in them
- One platform module (`src/lib/platform.js`) hides the differences between the Android app and a browser
- Settings and history are small `localStorage`-backed stores
- No network requests at runtime: fonts, icons and the decoding engine all ship with the app

---

## Project Structure

```text
src/
├── lib/            parsing, link check, QR rendering, scanner engine, storage, platform bridge
├── components/     sheet, result details, icons, shared controls
├── screens/        Scan, Create, History, Settings
├── styles/
│   └── app.css     the whole design system
├── App.jsx
└── main.jsx

assets/             icon and splash sources
public/             web app manifest, service worker, web icons
scripts/
└── generate-icons.mjs

android/            Capacitor Android project
```

---

## Getting Started

```bash
npm install
npm run dev        # web, http://localhost:5173
npm run build      # production web build in dist/
npm run lint
```

The camera needs a secure context: `localhost` works, any other host must be served over HTTPS.

### Android

```bash
npm run android    # build the web app and sync it into android/
cd android
./gradlew assembleDebug
```

The APK is written to `android/app/build/outputs/apk/debug/`. You can also run `npx cap open android` and build from Android Studio.

### Icons

The icon is drawn in code. To change it, edit `scripts/generate-icons.mjs` and run:

```bash
npm run icons
```

This rewrites `assets/`, the web icons in `public/`, and the Android launcher icons and splash screens.
