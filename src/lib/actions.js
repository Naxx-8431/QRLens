import { svgToBlob, svgToPngBlob } from "./qr";
import {
  copyImage,
  copyText,
  isShareCancel,
  saveBlob,
  shareBlob,
  shareText,
  timestampName,
} from "./platform";
import { toast } from "./store";

/* User-facing actions: each one reports its own outcome with a toast. */

const fail = (message) => toast(message, { tone: "error" });

export async function copyWithToast(text, message = "Copied") {
  if (await copyText(text)) toast(message);
  else fail("Could not copy");
}

export async function shareTextWithFallback(text) {
  try {
    if (await shareText(text)) return;
    // No share sheet in this browser: copying is the next best thing.
    await copyWithToast(text, "Sharing unavailable — copied");
  } catch (err) {
    if (!isShareCancel(err)) fail("Could not share");
  }
}

export async function saveFile(blob, filename) {
  try {
    toast(await saveBlob(blob, filename));
  } catch {
    fail("Could not save the file");
  }
}

export async function shareFile(blob, filename) {
  try {
    if (await shareBlob(blob, filename)) return;
    await saveBlob(blob, filename);
    toast("Sharing unavailable — downloaded");
  } catch (err) {
    if (!isShareCancel(err)) fail("Could not share");
  }
}

export async function saveQrPng(svg, size = 1024) {
  try {
    await saveFile(await svgToPngBlob(svg, size), timestampName("QR", "png"));
  } catch {
    fail("Could not render the image");
  }
}

export async function saveQrSvg(svg) {
  await saveFile(svgToBlob(svg), timestampName("QR", "svg"));
}

export async function shareQrPng(svg, size = 1024) {
  try {
    await shareFile(await svgToPngBlob(svg, size), timestampName("QR", "png"));
  } catch {
    fail("Could not render the image");
  }
}

export async function copyQrPng(svg, size = 1024) {
  try {
    if (await copyImage(await svgToPngBlob(svg, size))) toast("Image copied");
    else fail("This device cannot copy images");
  } catch {
    fail("Could not render the image");
  }
}
