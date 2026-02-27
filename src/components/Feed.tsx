import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { PostCard } from "./PostCard";
import { Post, UserProfile } from "../types";
import { geminiService } from "../services/gemini";
import { Send, Sparkles, Plus } from "lucide-react";
import { SEO } from "./SEO";

interface FeedProps {
  user: UserProfile | null;
  refreshProfile: () => void;
}

export function Feed({ user, refreshProfile }: FeedProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPost, setNewPost] = useState("");
  const [postType, setPostType] = useState<'joke' | 'motivation' | 'story'>('story');
  const [isPosting, setIsPosting] = useState(false);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    const res = await fetch("/api/posts");
    const data = await res.json();
    setPosts(data);
  };

  const handlePost = async () => {
    if (!newPost.trim()) return;
    setIsPosting(true);
    
    try {
      const hashtags = await geminiService.generateHashtags(newPost);
      const postData = {
        id: Math.random().toString(36).substr(2, 9),
        author: user?.name || "Reader",
        content: newPost,
        type: postType,
        hashtags,
        createdAt: Date.now()
      };

      await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(postData)
      });

      setNewPost("");
      fetchPosts();

      // Generate AI Auto-Reply
      const autoReply = await geminiService.generateAutoReply(newPost, postData.author);
      if (autoReply) {
        await fetch(`/api/posts/${postData.id}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: Math.random().toString(36).substr(2, 9),
            author: "Readative Bot",
            text: autoReply,
            createdAt: Date.now() + 1000 // Add slight delay
          })
        });
        fetchPosts(); // Refresh to show comment
      }
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
        description="Discover stories, jokes, and motivation from the Readative community. Read, write, and grow together."
        keywords={["stories", "jokes", "motivation", "writing community"]}
      />
      {/* Create Post */}
      {user && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-black/5">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
              <img src={user?.photo} alt="Avatar" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1">
              <textarea
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                placeholder="Share a joke, story, or motivation..."
                className="w-full bg-transparent border-none focus:ring-0 text-lg resize-none min-h-[100px]"
              />
              <div className="flex items-center justify-between mt-4 border-t border-black/5 pt-4">
                <div className="flex gap-2">
                  {(['story', 'joke', 'motivation'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setPostType(type)}
                      className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-all ${
                        postType === type ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handlePost}
                  disabled={isPosting || !newPost.trim()}
                  className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-emerald-700 disabled:opacity-50 transition-all"
                >
                  {isPosting ? <Sparkles className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Post
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Posts List */}
      <div className="space-y-6">
        <AnimatePresence mode="popLayout">
          {posts.map((post) => (
            <PostCard 
              key={post.id} 
              post={post} 
              user={user} 
              refreshProfile={refreshProfile}
              onUpdate={fetchPosts}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
