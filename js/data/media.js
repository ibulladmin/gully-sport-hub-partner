// ===================== Hub Partner — Photos, clips and video links =====================
//
// Media lives in facilities/{id}/media and, for uploads, under
// facility-media/{facilityId}/ in Storage. Uploads are resumable because
// partners often upload from the ground over mobile data. After any change
// the facility's `images` copy is rewritten so gullysport's cards keep working.

import { app, db } from "../firebase-init.js";
import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { assertValidImage, shrinkImage } from "../common/image.js";
import { roomFor, clipProblem, linkItem, sortMedia, denormalisedImages, mediaPath } from "../core/media.js";

const storage = getStorage(app);
const mediaCol = (facilityId) => collection(db, "facilities", facilityId, "media");

export async function listMedia(facilityId) {
  const snap = await getDocs(mediaCol(facilityId));
  return sortMedia(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
}

function upload(path, file, contentType, onProgress) {
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(ref(storage, path), file, { contentType, cacheControl: "public, max-age=604800" });
    task.on("state_changed",
      (s) => onProgress && onProgress(s.bytesTransferred / s.totalBytes),
      reject,
      async () => resolve({ path, url: await getDownloadURL(task.snapshot.ref) }));
  });
}

const fileName = (ext) => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

/** Shrinks (which also drops EXIF location) and uploads one photo. */
export async function addPhoto(facilityId, file, media, onProgress) {
  const full = roomFor("photo", media);
  if (full) throw new Error(full);
  assertValidImage(file);
  const small = await shrinkImage(file);
  const ext = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" }[small.type] || "jpg";
  const { path, url } = await upload(`${mediaPath(facilityId, "photo")}/${fileName(ext)}`, small, small.type, onProgress);
  return addItem(facilityId, { kind: "photo", path, url }, media);
}

/** Reads a clip's length in the browser before uploading it. */
export function clipDuration(file) {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { URL.revokeObjectURL(v.src); resolve(v.duration || 0); };
    v.onerror = () => resolve(0);
    v.src = URL.createObjectURL(file);
  });
}

/** Uploads a clip. processFacilityVideo (ibull-functions) adds the poster and 720p copy. */
export async function addClip(facilityId, file, media, onProgress) {
  const full = roomFor("video", media);
  if (full) throw new Error(full);
  const durationSec = await clipDuration(file);
  const problem = clipProblem({ type: file.type, size: file.size, durationSec });
  if (problem) throw new Error(problem);
  const ext = file.type === "video/quicktime" ? "mov" : "mp4";
  const { path, url } = await upload(`${mediaPath(facilityId, "video")}/${fileName(ext)}`, file, file.type, onProgress);
  return addItem(facilityId, { kind: "video", path, url, durationSec: Math.round(durationSec), posterUrl: "" }, media);
}

export async function addLink(facilityId, raw, media) {
  const full = roomFor("link", media);
  if (full) throw new Error(full);
  const item = linkItem(raw);
  if (!item) throw new Error("Paste a YouTube or Vimeo link.");
  return addItem(facilityId, item, media);
}

async function addItem(facilityId, item, media) {
  const order = media.length ? Math.max(...media.map((m) => m.order ?? 0)) + 1 : 0;
  const data = { caption: "", courtId: null, moderation: "pending", ...item, order, createdAt: serverTimestamp(), createdAtMs: Date.now() };
  const r = await addDoc(mediaCol(facilityId), data);
  return { id: r.id, ...data };
}

export function updateItem(facilityId, id, patch) {
  return updateDoc(doc(db, "facilities", facilityId, "media", id), patch);
}

/** Saves a new order (ids in display order) in one batch. */
export async function reorder(facilityId, ids) {
  const b = writeBatch(db);
  ids.forEach((id, i) => b.update(doc(db, "facilities", facilityId, "media", id), { order: i }));
  await b.commit();
}

export async function removeItem(facilityId, item) {
  await deleteDoc(doc(db, "facilities", facilityId, "media", item.id));
  if (item.path) {
    try { await deleteObject(ref(storage, item.path)); }
    catch (err) { console.warn("Could not remove file (harmless):", item.path, err.code || err.message); }
  }
}

/** Rewrites facilities/{id}.images and coverPhotoId from the media list. */
export async function syncFacilityImages(facilityId, media, coverPhotoId) {
  const photos = media.filter((m) => m.kind === "photo");
  const cover = photos.some((m) => m.id === coverPhotoId) ? coverPhotoId : photos[0]?.id || null;
  await updateDoc(doc(db, "facilities", facilityId), { images: denormalisedImages(media, cover), coverPhotoId: cover });
  return cover;
}
