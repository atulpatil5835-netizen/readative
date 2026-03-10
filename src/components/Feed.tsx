import { useState, useEffect, useCallback } from "react";
import { AnimatePresence } from "motion/react";
import { PostCard } from "./PostCard";
import { Post, UserProfile, PostCategory } from "../types";
import { geminiService } from "../services/gemini";
import { Send, Sparkles } from "lucide-react";
import { SEO } from "./SEO";
import {
  collection, addDoc, onSnapshot, query,
  orderBy, where, serverTimestamp
} from "firebase/firestore";
import { db } from "../firebase/firebase";

interface FeedProps {
  user: UserProfile | null;
  refreshProfile: () => void;
}

const CATEGORIES: PostCategory[] = ['story', 'joke', 'motivation', 'poetry', 'shayari', 'knowledge', 'questions'];
const CATEGORY_EMOJI: Record<PostCategory, string> = {
  story: '📖', joke: '😄', motivation: '🔥',
  poetry: '🌸', shayari: '🌙', knowledge: '💡', questions: '❓',
};

export function Feed({ user, refreshProfile }: FeedProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPost, setNewPost] = useState("");
  const [postType, setPostType] = useState<PostCategory>('story');
  const [activeFilter, setActiveFilter] = useState<PostCategory | 'all'>('all');
  const [isPosting, setIsPosting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Realtime listener — no polling needed with Firestore!
  useEffect(() => {
    setIsLoading(true);
    const postsRef = collection(db, "posts");

    const q = activeFilter === 'all'
      ? query(postsRef, orderBy("createdAt", "desc"))
      : query(postsRef, where("type", "==", activeFilter), orderBy("createdAt", "desc"));

    // onSnapshot gives realtime updates automatically
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Firestore timestamp to number
        createdAt: doc.data().createdAt?.toMillis?.() || doc.data().createdAt || Date.now(),
      })) as Post[];
      setPosts(data);
      setIsLoading(false);
    }, (error) => {
      console.error("Firestore error:", error);
      setIsLoading(false);
    });

    return () => unsubscribe(); // cleanup on unmount
  }, [activeFilter]);

  const handlePost = async () => {
    if (!newPost.trim() || !user) return;
    setIsPosting(true);
    try {
      const hashtags = await geminiService.generateHashtags(newPost);
      await addDoc(collection(db, "posts"), {
        author: user.name,
        authorId: user.id,
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

  return (
    <div className="space-y-6">
      <SEO
        title="Home Feed"
        description="Discover stories, jokes, and motivation from the Readative community."
        keywords={["stories", "jokes", "motivation", "poetry", "shayari"]}
      />

      {user && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-black/5">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
              <img src={user.photo} alt="Avatar" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1">
              <textarea
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                placeholder={`Share a ${postType}...`}
                className="w-full bg-transparent border-none focus:ring-0 text-lg resize-none min-h-[100px] outline-none"
              />
              <div className="flex items-center justify-between mt-4 border-t border-black/5 pt-4">
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((type) => (
                    <button key={type} onClick={() => setPostType(type)}
                      className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-all ${
                        postType === type ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}>
                      {CATEGORY_EMOJI[type]} {type}
                    </button>
                  ))}
                </div>
                <button onClick={handlePost} disabled={isPosting || !newPost.trim()}
                  className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-emerald-700 disabled:opacity-50 transition-all ml-2">
                  {isPosting ? <Sparkles className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Post
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <button onClick={() => setActiveFilter('all')}
          className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
            activeFilter === 'all' ? "bg-emerald-600 text-white" : "bg-white text-gray-500 border border-gray-200 hover:border-emerald-300"
          }`}>
          ✨ All
        </button>
        {CATEGORIES.map((cat) => (
          <button key={cat} onClick={() => setActiveFilter(cat)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
              activeFilter === cat ? "bg-emerald-600 text-white" : "bg-white text-gray-500 border border-gray-200 hover:border-emerald-300"
            }`}>
            {CATEGORY_EMOJI[cat]} {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Loading posts...</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">
          No {activeFilter !== 'all' ? activeFilter : ''} posts yet. Be the first to share!
        </div>
      ) : (
        <div className="space-y-6">
          <AnimatePresence mode="popLayout">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} user={user}
                refreshProfile={refreshProfile}
                onUpdate={() => {}} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
