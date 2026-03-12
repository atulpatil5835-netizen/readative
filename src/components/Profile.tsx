import { useState, useEffect } from "react";
import { UserProfile, Post } from "../types";
import { Download, Award, BookOpen, CheckCircle, Globe, User, Heart, MessageCircle, PenTool } from "lucide-react";
import { SEO } from "./SEO";
import { db } from "../firebase/firebase";
import { collection, query, orderBy, getDocs, doc, setDoc, getDoc } from "firebase/firestore";

interface ProfileProps {
  user: UserProfile | null;
  onLanguageChange?: (lang: string) => void;
}

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "hi", name: "Hindi" },
  { code: "mr", name: "Marathi" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "zh", name: "Chinese" },
  { code: "ja", name: "Japanese" },
  { code: "ar", name: "Arabic" },
];

const CATEGORY_EMOJI: Record<string, string> = {
  story: "📖", joke: "😄", motivation: "🔥",
  poetry: "🌸", shayari: "🌙", knowledge: "💡", questions: "❓",
};

type ProfileTab = "posts" | "liked" | "comments";

export function Profile({ user, onLanguageChange }: ProfileProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>("posts");
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState(user?.preferredLanguage || "English");
  const [savedMsg, setSavedMsg] = useState(false);

  useEffect(() => {
    fetchAllPosts();
    if (user) loadSavedLanguage();
  }, [user]);

  const loadSavedLanguage = async () => {
    if (!user) return;
    try {
      const snap = await getDoc(doc(db, "userProfiles", user.id));
      if (snap.exists() && snap.data().preferredLanguage) {
        const lang = snap.data().preferredLanguage;
        setSelectedLanguage(lang);
        onLanguageChange?.(lang);
      }
    } catch (e) {
      console.error("Failed to load language:", e);
    }
  };

  const fetchAllPosts = async () => {
    try {
      const snapshot = await getDocs(query(collection(db, "posts"), orderBy("createdAt", "desc")));
      const data = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toMillis?.() || d.data().createdAt || Date.now(),
      })) as Post[];
      setAllPosts(data);
    } catch (e) {
      console.error("Failed to fetch posts", e);
      setAllPosts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLanguageChange = async (langName: string) => {
    if (!user) return;
    setIsUpdating(true);
    setSelectedLanguage(langName);
    try {
      // Save to Firestore
      await setDoc(doc(db, "userProfiles", user.id), {
        preferredLanguage: langName,
        updatedAt: Date.now(),
      }, { merge: true });

      // Tell App.tsx so PostCard gets updated user.preferredLanguage immediately
      onLanguageChange?.(langName);

      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2000);
    } catch (e) {
      console.error("Failed to save language:", e);
      setSelectedLanguage(user.preferredLanguage || "English");
    } finally {
      setIsUpdating(false);
    }
  };

  if (!user) {
    return (
      <div className="text-center py-20 bg-white rounded-3xl border border-black/5 shadow-sm">
        <SEO title="Guest Profile" description="Login to Readative to access your full profile." />
        <div className="w-24 h-24 bg-gray-100 rounded-full mx-auto mb-6 flex items-center justify-center">
          <User className="w-10 h-10 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Guest User</h2>
        <p className="text-gray-500 mb-8">Login to track your reading progress, take exams, and customize your profile.</p>
      </div>
    );
  }

  const myPosts = allPosts.filter((p) => p.authorId === user.id || p.author === user.name);
  const likedPosts = allPosts.filter((p) => p.likes?.includes(user.id));
  const myComments = allPosts.flatMap((p) =>
    (p.comments || [])
      .filter((c) => !c.isAI && (c.authorId === user.id || c.author === user.name))
      .map((c) => ({ ...c, post: p }))
  );

  const tabs = [
    { key: "posts" as ProfileTab, label: "My Posts", icon: <PenTool className="w-4 h-4" />, count: myPosts.length },
    { key: "liked" as ProfileTab, label: "Liked", icon: <Heart className="w-4 h-4" />, count: likedPosts.length },
    { key: "comments" as ProfileTab, label: "Comments", icon: <MessageCircle className="w-4 h-4" />, count: myComments.length },
  ];

  return (
    <div className="space-y-6">
      <SEO title={`${user.name}'s Profile`} description={`${user.name}'s reading profile on Readative.`} type="profile" />

      {/* Profile Header */}
      <div className="bg-white rounded-3xl p-8 border border-black/5 shadow-sm text-center">
        <div className="relative inline-block mb-6">
          <div className="w-32 h-32 rounded-full border-4 border-emerald-50 overflow-hidden mx-auto">
            <img src={user.photo} alt={user.name} className="w-full h-full object-cover" />
          </div>
          <div className="absolute bottom-0 right-0 bg-emerald-600 text-white p-2 rounded-full border-4 border-white">
            <Award className="w-5 h-5" />
          </div>
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-1">{user.name}</h2>
        <p className="text-emerald-600 font-medium mb-6">Avid Reader & Writer</p>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-emerald-50 p-4 rounded-2xl">
            <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">Reading</p>
            <p className="text-2xl font-black text-emerald-900">{user.readingScore}</p>
          </div>
          <div className="bg-emerald-50 p-4 rounded-2xl">
            <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">Exam</p>
            <p className="text-2xl font-black text-emerald-900">{user.examScore}</p>
          </div>
          <div className="bg-emerald-50 p-4 rounded-2xl">
            <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">Posts</p>
            <p className="text-2xl font-black text-emerald-900">{myPosts.length}</p>
          </div>
        </div>

        {/* Language Settings */}
        <div className="mt-8 pt-6 border-t border-gray-100">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Globe className="w-4 h-4 text-gray-400" />
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Translation Language</h3>
            {savedMsg && (
              <span className="text-xs text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full">
                ✓ Saved!
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mb-4">Select language → click 🌐 translate on any post</p>
          <div className="flex flex-wrap justify-center gap-2">
            {LANGUAGES.map((lang) => (
              <button key={lang.code} onClick={() => handleLanguageChange(lang.name)}
                disabled={isUpdating}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                  selectedLanguage === lang.name
                    ? "bg-emerald-600 text-white shadow-md scale-105"
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                }`}>
                {lang.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-black/5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-gray-900 text-sm">Posts Read</h3>
          </div>
          <p className="text-3xl font-black text-emerald-900">{user.readPosts.length}</p>
          <div className="w-full bg-gray-100 h-1.5 rounded-full mt-3 overflow-hidden">
            <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${Math.min(user.readPosts.length * 5, 100)}%` }} />
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-black/5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-gray-900 text-sm">PDF Report</h3>
          </div>
          <button onClick={() => alert("PDF download coming soon!")}
            className="w-full bg-emerald-900 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-black transition-all flex items-center justify-center gap-2">
            <Download className="w-4 h-4" /> Download
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-3xl border border-black/5 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100">
          {tabs.map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-bold transition-all ${
                activeTab === tab.key
                  ? "text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50/50"
                  : "text-gray-400 hover:text-gray-600"
              }`}>
              {tab.icon}
              <span>{tab.label}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                activeTab === tab.key ? "bg-emerald-100 text-emerald-600" : "bg-gray-100 text-gray-400"
              }`}>{tab.count}</span>
            </button>
          ))}
        </div>

        <div className="p-4">
          {isLoading ? (
            <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>
          ) : activeTab === "posts" ? (
            myPosts.length === 0 ? (
              <div className="text-center py-12"><PenTool className="w-10 h-10 text-gray-200 mx-auto mb-3" /><p className="text-gray-400 text-sm">You haven't posted anything yet.</p></div>
            ) : (
              <div className="space-y-3">
                {myPosts.map((post) => (
                  <div key={post.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold bg-white border border-gray-200 text-gray-500 px-2 py-0.5 rounded-full capitalize">{CATEGORY_EMOJI[post.type]} {post.type}</span>
                      <span className="text-xs text-gray-400">{new Date(post.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm text-gray-700 line-clamp-3 leading-relaxed">{post.content}</p>
                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-200">
                      <span className="flex items-center gap-1 text-xs text-gray-400"><Heart className="w-3.5 h-3.5" /> {post.likes?.length || 0}</span>
                      <span className="flex items-center gap-1 text-xs text-gray-400"><MessageCircle className="w-3.5 h-3.5" /> {post.comments?.length || 0}</span>
                      {post.hashtags?.slice(0, 3).map((tag) => <span key={tag} className="text-xs text-emerald-500">#{tag}</span>)}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : activeTab === "liked" ? (
            likedPosts.length === 0 ? (
              <div className="text-center py-12"><Heart className="w-10 h-10 text-gray-200 mx-auto mb-3" /><p className="text-gray-400 text-sm">You haven't liked any posts yet.</p></div>
            ) : (
              <div className="space-y-3">
                {likedPosts.map((post) => (
                  <div key={post.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-700">{post.author[0]}</div>
                        <span className="text-xs font-bold text-gray-600">{post.author}</span>
                      </div>
                      <span className="text-xs font-bold bg-white border border-gray-200 text-gray-500 px-2 py-0.5 rounded-full capitalize">{CATEGORY_EMOJI[post.type]} {post.type}</span>
                    </div>
                    <p className="text-sm text-gray-700 line-clamp-3 leading-relaxed">{post.content}</p>
                    <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-200">
                      <span className="flex items-center gap-1 text-xs text-red-400 font-medium"><Heart className="w-3.5 h-3.5 fill-current" /> {post.likes?.length || 0} likes</span>
                      <span className="flex items-center gap-1 text-xs text-gray-400"><MessageCircle className="w-3.5 h-3.5" /> {post.comments?.length || 0}</span>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            myComments.length === 0 ? (
              <div className="text-center py-12"><MessageCircle className="w-10 h-10 text-gray-200 mx-auto mb-3" /><p className="text-gray-400 text-sm">You haven't commented yet.</p></div>
            ) : (
              <div className="space-y-3">
                {myComments.map((item) => (
                  <div key={item.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-gray-400">On</span>
                      <span className="text-xs font-bold text-gray-600">{item.post.author}'s {item.post.type}</span>
                      <span className="ml-auto text-xs text-gray-400">{new Date(item.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-xs text-gray-400 italic line-clamp-1 mb-2 pl-2 border-l-2 border-gray-200">"{item.post.content.substring(0, 80)}..."</p>
                    <div className="flex gap-2 items-start">
                      <MessageCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-gray-700">{item.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>

      <div className="text-center py-6">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Need Help?</p>
        <a href="mailto:reader@readative.com" className="text-sm font-medium text-emerald-600 hover:underline">reader@readative.com</a>
      </div>
    </div>
  );
}
