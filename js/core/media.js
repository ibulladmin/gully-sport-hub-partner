// ===================== Hub Partner — Photo and video limits =====================
//
// Convenience checks only, like js/common/image.js: the real limits are the
// Storage rules in ibull-functions, which refuse anything these let through
// by mistake. These give the partner a readable message instead of a 403.

import { parseVideo } from "../common/video.js";

export const MIN_PHOTOS = 3;
export const MAX_PHOTOS = 12;
export const MAX_CLIPS = 3;
export const MAX_LINKS = 3;
export const MAX_CLIP_BYTES = 50 * 1024 * 1024;
export const MAX_CLIP_SECONDS = 60;
export const CLIP_TYPES = ["video/mp4", "video/quicktime"];
// The facility doc keeps a copy of the first few photos for pages that don't
// read the media subcollection yet (gullysport's facilities.html).
export const DENORMALISED_PHOTOS = 5;

export function countByKind(media) {
  const c = { photo: 0, video: 0, link: 0 };
  for (const m of media || []) if (c[m.kind] != null) c[m.kind]++;
  return c;
}

/** Problems with adding one more item of `kind`, given what the facility has. */
export function roomFor(kind, media) {
  const c = countByKind(media);
  if (kind === "photo" && c.photo >= MAX_PHOTOS) return `A facility can have up to ${MAX_PHOTOS} photos.`;
  if (kind === "video" && c.video >= MAX_CLIPS) return `A facility can have up to ${MAX_CLIPS} video clips.`;
  if (kind === "link" && c.link >= MAX_LINKS) return `A facility can have up to ${MAX_LINKS} video links.`;
  return "";
}

/** "" when the clip is fine, otherwise what's wrong with it. */
export function clipProblem({ type, size, durationSec }) {
  if (!CLIP_TYPES.includes(type)) return "Videos must be MP4 or MOV.";
  if (size > MAX_CLIP_BYTES) return "Videos can be up to 50 MB. Trim it or record at a lower quality.";
  if (durationSec > MAX_CLIP_SECONDS + 0.5) return `Videos can be up to ${MAX_CLIP_SECONDS} seconds long.`;
  return "";
}

/** A YouTube or Vimeo link as a media item, or null if it can't be embedded. */
export function linkItem(raw) {
  const v = parseVideo(raw);
  if (!v || (v.provider !== "youtube" && v.provider !== "vimeo")) return null;
  return { kind: "link", url: v.watchUrl, posterUrl: v.thumbUrl || "", provider: v.provider, videoId: v.id };
}

/** Media in display order: by `order`, then oldest first. */
export function sortMedia(media) {
  return [...(media || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.createdAtMs ?? 0) - (b.createdAtMs ?? 0));
}

/**
 * The `images` array written to the facility doc: up to 5 visible photos, the
 * cover first. Shape matches what gullysport's facility cards read today.
 */
export function denormalisedImages(media, coverPhotoId) {
  const photos = sortMedia(media).filter((m) => m.kind === "photo" && m.url && m.moderation !== "hidden");
  const cover = photos.find((m) => m.id === coverPhotoId);
  const ordered = cover ? [cover, ...photos.filter((m) => m !== cover)] : photos;
  return ordered.slice(0, DENORMALISED_PHOTOS).map((m) => ({ url: m.url, path: m.path || "" }));
}

/** Storage folder for a facility's media, keyed by facility so staff can upload too. */
export function mediaPath(facilityId, kind) {
  return `facility-media/${facilityId}/${kind === "video" ? "videos" : "photos"}`;
}
