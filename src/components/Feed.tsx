import { useState, useEffect } from "react";
import { AnimatePresence } from "motion/react";
import { PostCard } from "./PostCard";
import { Post, PostCategory } from "../types";
import { geminiService } from "../services/gemini";
import { Send, Sparkles, PenSquare } from "lucide-react";
import { SEO } from "./SEO";
import {
  collection, addDoc, onSnapshot, query,
  orderBy, serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import { PostAuth, UsernamePrompt } from "./Auth";

// ── Types ──────────────────────────────────────────────────────────────────

/** A verified poster session (email+OTP). Stored in sessionStorage so it
 *  survives page refreshes but clears when the tab is closed. */
interface PosterSession {
  email: string;
  displayName: string;
  /** Unique ID derived from email so likes/comments can be attributed */
  authorId: string;
}

export type UsernameAction =
  | { type: "like"; postId: string }
  | { type: "comment"; postId: string };

// ── Constants ──────────────────────────────────────────────────────────────

const CATEGORIES: PostCategory[] = [
  "story", "joke", "motivation", "poetry", "shayari", "knowledge", "questions",
];
const CATEGORY_EMOJI: Record<PostCategory, string> = {
  story: "📖", joke: "😄", motivation: "🔥",
  poetry: "🌸", shayari: "🌙", knowledge: "💡", questions: "❓",
};

function emailToId(email: string) {
  return email.toLowerCase().replace(/[^a-z0-9]/g, "_");
}

// ── Component ──────────────────────────────────────────────────────────────

export function Feed() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPost, setNewPost] = useState("");
  const [postType, setPostType] = useState<PostCategory>("story");
  const [activeFilter, setActiveFilter] = useState<PostCategory | "all">("all");
  const [isPosting, setIsPosting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Poster session (email+OTP verified)
  const [posterSession, setPosterSession] = useState<PosterSession | null>(() => {
    try {
      const saved = sessionStorage.getItem("posterSession");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Modals
  const [showPostAuth, setShowPostAuth] = useState(false);
  const [usernameAction, setUsernameAction] = useState<UsernameAction | null>(null);

  // ── Firestore listener ─────────────────────────────────────────────────

  useEffect(() => {
    setIsLoading(true);
    const postsRef = collection(db, "posts");
    const q = query(postsRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const allData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt:
            doc.data().createdAt?.toMillis?.() ||
            doc.data().createdAt ||
            Date.now(),
        })) as Post[];

        const filtered =
          activeFilter === "all"
            ? allData
            : allData.filter((p) => p.type === activeFilter);

        setPosts(filtered);
        setIsLoading(false);
      },
      (error) => {
        console.error("Firestore error:", error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [activeFilter]);

  // ── Handlers ───────────────────────────────────────────────────────────

  const handlePostAuthVerified = (email: string, displayName: string) => {
    const session: PosterSession = {
      email,
      displayName,
      authorId: emailToId(email),
    };
    setPosterSession(session);
    sessionStorage.setItem("posterSession", JSON.stringify(session));
    setShowPostAuth(false);
  };

  const handlePostClick = () => {
    if (!posterSession) {
      setShowPostAuth(true);
      return;
    }
    submitPost(posterSession);
  };

  const submitPost = async (session: PosterSession) => {
    if (!newPost.trim()) return;
    setIsPosting(true);
    try {
      const hashtags = await geminiService.generateHashtags(newPost);
      await addDoc(collection(db, "posts"), {
        author: session.displayName,
        authorId: session.authorId,
        authorEmail: session.email,
        content: newPost,
        type: postType,
        hashtags,
        likes: [],
        comments: [],
        createdAt: serverTimestamp(),
        aiCommentPosted: false,
      });
      setNewPost("");
    } catch (error) {
      console.error("Error posting:", error);
    } finally {
      setIsPosting(false);
    }
  };

  /** Called by PostCard when a guest tries to like or comment */
  const handleGuestAction = (action: UsernameAction) => {
    setUsernameAction(action);
  };

  /** Called when UsernamePrompt confirms */
  const handleUsernameConfirm = (username: string) => {
    if (!usernameAction) return;
    window.dispatchEvent(
      new CustomEvent("guest-action", {
        detail: { ...usernameAction, username },
      })
    );
    setUsernameAction(null);
  };

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <SEO
        title="Home Feed"
        description="Discover stories, jokes, and motivation from the Readative community."
        keywords={["stories", "jokes", "motivation", "poetry", "shayari"]}
      />

      {/* ── Compose Box ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-black/5">
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
            {posterSession ? (
              <span className="text-emerald-700 font-bold text-sm">
                {posterSession.displayName.charAt(0).toUpperCase()}
              </span>
            ) : (
              <PenSquare className="w-5 h-5 text-emerald-600" />
            )}
          </div>

          <div className="flex-1">
            {posterSession ? (
              <p className="text-xs text-gray-400 mb-1">
                Posting as{" "}
                <span className="font-semibold text-gray-600">
                  @{posterSession.displayName}
                </span>
                {" · "}
                <button
                  onClick={() => {
                    setPosterSession(null);
                    sessionStorage.removeItem("posterSession");
                  }}
                  className="text-red-400 hover:underline"
                >
                  switch
                </button>
              </p>
            ) : (
              <p className="text-xs text-gray-400 mb-1">
                Verify your email to post
              </p>
            )}

            <textarea
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              placeholder={`Share a ${postType}...`}
              className="w-full bg-transparent border-none focus:ring-0 text-lg resize-none min-h-[100px] outline-none text-gray-800 placeholder-gray-300"
            />

            <div className="flex items-center justify-between mt-4 border-t border-black/5 pt-4">
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((type) => (
                  <button
                    key={type}
                    onClick={() => setPostType(type)}
                    className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-all ${
                      postType === type
                        ? "bg-emerald-600 text-white"
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                  >
                    {CATEGORY_EMOJI[type]} {type}
                  </button>
                ))}
              </div>

              <button
                onClick={handlePostClick}
                disabled={isPosting || !newPost.trim()}
                className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-emerald-700 disabled:opacity-50 transition-all ml-2"
              >
                {isPosting ? (
                  <Sparkles className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Post
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Category Filter ──────────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <button
          onClick={() => setActiveFilter("all")}
          className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
            activeFilter === "all"
              ? "bg-emerald-600 text-white"
              : "bg-white text-gray-500 border border-gray-200 hover:border-emerald-300"
          }`}
        >
          ✨ All
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveFilter(cat)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
              activeFilter === cat
                ? "bg-emerald-600 text-white"
                : "bg-white text-gray-500 border border-gray-200 hover:border-emerald-300"
            }`}
          >
            {CATEGORY_EMOJI[cat]} {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Posts ────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex flex-col items-center py-16 gap-3">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Loading posts...</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">
          No {activeFilter !== "all" ? activeFilter : ""} posts yet. Be the first to share!
        </div>
      ) : (
        <div className="space-y-6">
          <AnimatePresence mode="popLayout">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onGuestAction={handleGuestAction}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ── Modals ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showPostAuth && (
          <PostAuth
            onVerified={(email, displayName) => {
              handlePostAuthVerified(email, displayName);
              if (newPost.trim()) {
                const session: PosterSession = {
                  email,
                  displayName,
                  authorId: emailToId(email),
                };
                submitPost(session);
              }
            }}
            onClose={() => setShowPostAuth(false)}
          />
        )}

        {usernameAction && (
          <UsernamePrompt
            action={usernameAction.type}
            onConfirm={handleUsernameConfirm}
            onClose={() => setUsernameAction(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
