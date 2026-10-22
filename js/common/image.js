// web-common v1.1.0 (ibull-functions 771de24). DO NOT EDIT HERE —
// change ibull-functions/web-common, tag a release, then re-run tools/vendor.mjs.
// ===================== web-common — Images from users =====================
// The checks every upload goes through, and a shrink step that runs first so a
// 6 MB phone photo becomes a few hundred KB (and loses its EXIF location).
//
// SVG is refused: it is an XML document that can carry <script>, and served
// from our own origin it would run with our privileges.

export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB

export function describeImageLimits() {
  return "PNG, JPEG or WebP, up to 2 MB. SVG is not accepted — it can contain scripts.";
}

/** Throws a human-readable Error if the file fails the shared constraints. */
export function assertValidImage(file) {
  if (!file) throw new Error("No file selected.");
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error(
      `"${file.name}" is a ${file.type || "unknown"} file. ${describeImageLimits()}`
    );
  }
  if (file.size > MAX_IMAGE_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    throw new Error(`"${file.name}" is ${mb} MB. The limit is 2 MB — please resize it.`);
  }
}


/**
 * Shrink a photo in the browser before upload (GS-F02).
 *
 * Phone cameras produce 3–8 MB images; the Storage rules cap uploads at 2 MB.
 * Rather than reject the owner's photo, redraw it at most `maxDim` px on the
 * long side as JPEG. Typically ends up 200–600 KB. Also strips EXIF (location!)
 * because the canvas re-encode carries no metadata.
 *
 * Non-images and unsupported types are returned unchanged so assertValidImage()
 * still gives the usual error.
 */
export async function shrinkImage(file, maxDim = 1600, quality = 0.82) {
  if (!file || !/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)) return file;
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file; // browser can't decode it (e.g. HEIC on some desktops) — let validation explain
  }
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);
  bitmap.close && bitmap.close();
  const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", quality));
  if (!blob) return file;
  const name = (file.name || "photo").replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg" });
}
