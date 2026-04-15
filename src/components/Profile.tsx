import { useState, useEffect } from "react";
import { Post } from "../types";
import { BookOpen, User } from "lucide-react";
import { SEO } from "./SEO";
import { db } from "../firebase/firebase";
import { collection, query, orderBy, getDocs } from "firebase/firestore";

const CATEGORY_EMOJI: Record<string, string> = {
  story: "📖", joke: "😄", motivation: "🔥",
  poetry: "🌸", shayari: "🌙", knowledge: "💡", questions: "❓",
};

export function Profile() {
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAllPosts = async () => {
      try {
        const snapshot = await getDocs(
          query(collection(db, "posts"), orderBy("createdAt", "desc"))
        );
        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          createdAt:
            d.data().createdAt?.toMillis?.() ||
            d.data().createdAt ||
            Date.now(),
        })) as Post[];
        setAllPosts(data);
      } catch (e) {
        console.error("Failed to fetch posts", e);
        setAllPosts([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAllPosts();
  }, []);

  // Category breakdown
  const categoryCounts = allPosts.reduce((acc, post) => {
    acc[post.type] = (acc[post.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6 pb-20">
      <SEO
        title="Community Stats | Readative"
        description="See what the Readative community has been sharing."
      />

      {/* Community Banner */}
      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl p-8 text-white text-center shadow-lg">
        <div className="w-20 h-20 bg-white/20 rounded-full mx-auto mb-4 flex items-center justify-center">
          <User className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-2xl font-black mb-1">Readative Community</h2>
        <p className="text-emerald-100 text-sm">
          {allPosts.length} posts shared so far
        </p>
      </div>

      {/* Category Breakdown */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-black/5">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-emerald-600" />
          Posts by Category
        </h3>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(categoryCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([category, count]) => {
                const pct = Math.round((count / allPosts.length) * 100);
                return (
                  <div key={category}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700 capitalize">
                        {CATEGORY_EMOJI[category]} {category}
                      </span>
                      <span className="text-gray-400">
                        {count} post{count !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Recent Posts Preview */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-black/5">
        <h3 className="font-bold text-gray-800 mb-4">Recent Posts</h3>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : allPosts.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-4">No posts yet.</p>
        ) : (
          <div className="space-y-3">
            {allPosts.slice(0, 5).map((post) => (
              <div
                key={post.id}
                className="p-3 bg-gray-50 rounded-xl border border-black/5"
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs">
                    {post.author[0]}
                  </div>
                  <span className="text-xs font-semibold text-gray-700">
                    {post.author}
                  </span>
                  <span className="text-xs text-gray-400 ml-auto">
                    {CATEGORY_EMOJI[post.type]} {post.type}
                  </span>
                </div>
                <p className="text-sm text-gray-600 line-clamp-2">{post.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
