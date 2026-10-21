import { test } from "node:test";
import assert from "node:assert/strict";
import { roomFor, clipProblem, linkItem, denormalisedImages, mediaPath, MAX_CLIP_BYTES } from "../js/core/media.js";

test("per-kind limits", () => {
  const photos = Array.from({ length: 12 }, () => ({ kind: "photo" }));
  assert.match(roomFor("photo", photos), /up to 12/);
  assert.equal(roomFor("video", photos), "");
  assert.match(roomFor("link", [{ kind: "link" }, { kind: "link" }, { kind: "link" }]), /up to 3/);
});

test("clip checks", () => {
  assert.equal(clipProblem({ type: "video/mp4", size: 10e6, durationSec: 45 }), "");
  assert.match(clipProblem({ type: "video/webm", size: 1, durationSec: 1 }), /MP4 or MOV/);
  assert.match(clipProblem({ type: "video/mp4", size: MAX_CLIP_BYTES + 1, durationSec: 1 }), /50 MB/);
  assert.match(clipProblem({ type: "video/quicktime", size: 1, durationSec: 61 }), /60 seconds/);
});

test("only YouTube and Vimeo links are accepted", () => {
  const yt = linkItem("https://youtu.be/dQw4w9WgXcQ");
  assert.equal(yt.provider, "youtube");
  assert.equal(yt.url, "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  assert.equal(linkItem("https://instagram.com/p/abc"), null);
  assert.equal(linkItem("javascript:alert(1)"), null);
});

test("the facility doc gets the cover first and at most 5 visible photos", () => {
  const media = [
    { id: "a", kind: "photo", url: "https://x/a", order: 0 },
    { id: "b", kind: "photo", url: "https://x/b", order: 1 },
    { id: "h", kind: "photo", url: "https://x/h", order: 2, moderation: "hidden" },
    { id: "v", kind: "video", url: "https://x/v", order: 3 },
    ...["c", "d", "e", "f"].map((id, i) => ({ id, kind: "photo", url: `https://x/${id}`, order: 4 + i }))
  ];
  assert.deepEqual(denormalisedImages(media, "c").map((m) => m.url), ["https://x/c", "https://x/a", "https://x/b", "https://x/d", "https://x/e"]);
  assert.equal(denormalisedImages(media, "missing")[0].url, "https://x/a");
});

test("media is stored by facility", () => {
  assert.equal(mediaPath("f1", "photo"), "facility-media/f1/photos");
  assert.equal(mediaPath("f1", "video"), "facility-media/f1/videos");
});
