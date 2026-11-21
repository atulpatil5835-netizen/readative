import assert from "node:assert/strict";
import type { KnowledgeEntry } from "../src/types";
import {
  adaptKnowledgeFeedPageSize,
  estimateKnowledgeFeedPayloadChars,
  getInitialAdaptiveFeedPageSize,
  shouldPrefetchKnowledgeFeed,
  withFeedLoadTimeout,
} from "../src/components/KnowledgeFeed/feedLoadingStrategy";

assert.equal(getInitialAdaptiveFeedPageSize({ effectiveType: "4g" }), 5);
assert.equal(
  getInitialAdaptiveFeedPageSize({ effectiveType: "4g", downlink: 2 }),
  3,
);
assert.equal(
  getInitialAdaptiveFeedPageSize({ effectiveType: "4g", saveData: true }),
  3,
);
assert.equal(shouldPrefetchKnowledgeFeed({ effectiveType: "slow-2g" }), false);
assert.equal(shouldPrefetchKnowledgeFeed({ saveData: true }), false);
assert.equal(shouldPrefetchKnowledgeFeed({ effectiveType: "4g" }), true);

assert.equal(
  adaptKnowledgeFeedPageSize({
    currentPageSize: 3,
    durationMs: 300,
    payloadChars: 120_000,
    connection: { effectiveType: "4g" },
  }),
  5,
);
assert.equal(
  adaptKnowledgeFeedPageSize({
    currentPageSize: 7,
    durationMs: 2_000,
    payloadChars: 150_000,
    connection: { effectiveType: "4g" },
  }),
  5,
);
assert.equal(
  adaptKnowledgeFeedPageSize({
    currentPageSize: 5,
    durationMs: 300,
    payloadChars: 120_000,
    maxPageSize: 6,
    connection: { effectiveType: "4g" },
  }),
  6,
);
assert.equal(
  adaptKnowledgeFeedPageSize({
    currentPageSize: 7,
    durationMs: 300,
    payloadChars: 120_000,
    connection: { saveData: true },
  }),
  3,
);
assert.equal(
  adaptKnowledgeFeedPageSize({
    currentPageSize: 5,
    durationMs: 300,
    payloadChars: 900_000,
    connection: { effectiveType: "4g" },
  }),
  3,
);

const sampleEntry: KnowledgeEntry = {
  id: "entry-1",
  author: "Reader",
  authorId: "reader-1",
  authorEmail: "",
  title: "t",
  content: "body",
  visibility: "public",
  hashtags: [],
  likes: [],
  comments: [{ id: "comment-1", author: "Reader", text: "c", createdAt: 1 }],
  mentions: [],
  createdAt: 1,
  excerpt: "ex",
  imageDataUrl: "abc",
  images: [
    {
      dataUrl: "img",
      mimeType: "image/png",
      width: 1,
      height: 1,
      optimizedAt: 1,
    },
  ],
};
assert.equal(estimateKnowledgeFeedPayloadChars([sampleEntry]), 14);

assert.equal(await withFeedLoadTimeout(Promise.resolve("ready"), 100), "ready");
await assert.rejects(
  withFeedLoadTimeout(new Promise<never>(() => {}), 5),
  /timed out after 5 ms/,
);

console.log("Adaptive feed loading, payload sizing, and timeout checks passed.");
