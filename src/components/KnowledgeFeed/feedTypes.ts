import { type ComponentType } from "react";
import { type QueryDocumentSnapshot, type DocumentData } from "firebase/firestore";
import { type KnowledgeEntry } from "../../types";
import { type SeoCategoryDefinition } from "../../utils/seoTaxonomy";

export type PendingAction =
  | { type: "helpful" | "misleading" | "comment" | "save"; entryId: string }
  | null;

export interface SelectedImage {
  fileName: string;
  dataUrl: string;
  mimeType: string;
  width: number;
  height: number;
  optimizedAt: number;
}

export interface MentionState {
  query: string;
  start: number;
}

export interface FeedMessage {
  tone: "success" | "warning";
  title: string;
  body: string;
}

export type FeedPageLoadResult = "blocked" | "done" | "error" | "loaded";

export interface LoadNextEntriesPageOptions {
  showLoadingState?: boolean;
  surfaceErrors?: boolean;
}

export interface CachedKnowledgeFeed {
  entries: KnowledgeEntry[];
  visibleLikedEntryIds: string[];
  hasMoreServerEntries: boolean;
  cachedAt: number;
}

export interface TopicFeedState {
  entries: KnowledgeEntry[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasLoaded: boolean;
  hasMore: boolean;
  cursor: QueryDocumentSnapshot<DocumentData> | null;
  error: string | null;
}

export interface IndependentKnowledgeFeedPage {
  entries: KnowledgeEntry[];
  cursor: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

export interface BrowserIdleCallbacks {
  requestIdleCallback?: (
    callback: IdleRequestCallback,
    options?: IdleRequestOptions,
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
}

export interface PendingFeedStorageWrite {
  idleCallbackId: number | null;
  timeoutId: number | null;
}

export type FeedTopicId = "all" | "trending" | string;

export interface FeedTopicFilter {
  id: FeedTopicId;
  label: string;
  icon: ComponentType<{ className?: string }>;
  keywords: string[];
  category?: SeoCategoryDefinition;
}
