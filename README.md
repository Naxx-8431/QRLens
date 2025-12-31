# 📱 QRLens

**QRLens** is a modern, lightweight **QR Code Generator & Scanner** application built using **React** and **Capacitor**, designed to work seamlessly on the **web and Android**.  
The app focuses on clean UI, smooth UX, and reliable QR generation and scanning.

---

## ✨ Features

### 🔹 QR Code Generation
- Generate QR codes from text or URLs
- Optimized QR size and margins for better readability
- Progress-based QR generation animation

### 🔹 QR Code Scanning
- Scan QR codes using the device camera
- Scan QR codes from images
- Supports URLs and plain text QR data

### 🔹 QR Actions
- 📥 Download generated QR as an image
- 🔗 Share QR using native Android share sheet
- 📋 Copy scanned QR content

### 🔹 User Experience
- 🌗 Light / Dark theme support
- 📱 Mobile-first responsive layout
- Bottom-sheet style scan result popup
- Clean and minimal UI

### 🔹 Android Support
- Built with Capacitor
- Camera permission handling
- Native filesystem and share support

---

## 🛠 Tech Stack

- **React**
- **JavaScript (ES6+)**
- **CSS**
- **qrcode**
- **html5-qrcode**
- **Capacitor**
  - Camera
  - Filesystem
  - Share

---

## 🧠 Architecture Highlights

- Centralized app state using App Modes
- Clean separation of UI and logic
- Component-based architecture
- Scalable design for future features

---

## 📂 Project Structure

```text
src/
├── components/
│   ├── QRCanvas.jsx
│   ├── QRScanner.jsx
│   ├── QRImageScanner.jsx
│   ├── QRActions.jsx
│   ├── ProgressBar.jsx
│   └── TextInput.jsx
├── assets/
│   └── icon.png
├── App.jsx
├── App.css
└── main.jsx

android/
├── app/
├── gradle/
└── build.gradle
