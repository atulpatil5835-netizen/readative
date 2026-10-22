import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { Cpu, Hash, ImagePlus, LoaderCircle, Plus, RefreshCw, X } from "lucide-react";
import { db } from "../firebase/firebaseDb";
import type { KnowledgeEntry, KnowledgeImageAsset } from "../types";
import type { KnowledgeIdentity } from "../utils/knowledgeIdentity";
import { auth } from "../firebase/firebaseAuth";
import { optimizeKnowledgeImageFile } from "../utils/knowledgeImageOptimizer";
import { normalizeKnowledgeEntry } from "./KnowledgeFeed/feedHelpers";
import { KnowledgeCard } from "./KnowledgeCard/KnowledgeCard";
import { SEO } from "./SEO";
import { canViewKnowledgeEntry } from "../utils/knowledgePrivacy";
import { parseManualHashtags } from "../utils/knowledgeEntryHelpers";
import { navigateToRoute } from "../utils/routes";
import { fetchSinglePostRelatedKnowledge, fetchSinglePostRelatedSmartTalk } from "./KnowledgeFeed/feedHelpers";
import { KnowledgeJourney, type KnowledgeJourneyQuestion } from "./KnowledgeFeed/KnowledgeJourney";

const NEWS_CACHE_TTL = 10 * 60 * 1000;
// Keep this route's initial read footprint aligned with Home on Firebase Spark.
const NEWS_QUERY_LIMIT = 100;
const NEWS_EDITOR_EMAIL = "atulpatil5835@gmail.com";
const NEWS_TIME_ZONE = "Asia/Kolkata";
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
let newsCache: { loadedAt: number; entries: KnowledgeEntry[] } | null = null;
function isTechNews(entry: KnowledgeEntry) {
  return entry.authorEmail.trim().toLowerCase() === NEWS_EDITOR_EMAIL && entry.contentKind === "news";
}

function getNewsDateParts(timestamp: number) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: NEWS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return { year: values.year || "", month: values.month || "", day: values.day || "" };
}

interface TechNewsProps {
  currentIdentity: KnowledgeIdentity | null;
  onIdentityRequired: () => void;
  onOpenProfile: (authorId: string, username?: string) => void;
  selectedTag?: string | null;
  focusedEntryId?: string | null;
}

export function TechNews({ currentIdentity, onIdentityRequired, onOpenProfile, selectedTag = null, focusedEntryId = null }: TechNewsProps) {
  const [entries, setEntries] = useState<KnowledgeEntry[]>(newsCache?.entries || []);
  const [isLoading, setIsLoading] = useState(!newsCache || Date.now() - newsCache.loadedAt > NEWS_CACHE_TTL);
  const [error, setError] = useState<string | null>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [headline, setHeadline] = useState("");
  const [content, setContent] = useState("");
  const [hashtags, setHashtags] = useState("technology, ai, innovation");
  const [image, setImage] = useState<KnowledgeImageAsset | null>(null);
  const [isOptimizingImage, setIsOptimizingImage] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [signedInEmail, setSignedInEmail] = useState(auth.currentUser?.email?.trim().toLowerCase() || "");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedDay, setSelectedDay] = useState("");
  const [relatedEntries, setRelatedEntries] = useState<KnowledgeEntry[]>([]);
  const [relatedQuestions, setRelatedQuestions] = useState<KnowledgeJourneyQuestion[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isNewsEditor = signedInEmail === NEWS_EDITOR_EMAIL;

  const loadNews = async (force = false) => {
    if (!force && newsCache && Date.now() - newsCache.loadedAt < NEWS_CACHE_TTL) {
      setEntries(newsCache.entries);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const snapshot = await getDocs(query(
        collection(db, "knowledge"),
        where("authorEmail", "==", NEWS_EDITOR_EMAIL),
        where("contentKind", "==", "news"),
        limit(NEWS_QUERY_LIMIT),
      ));
      const nextEntries = snapshot.docs
        .map((item) => normalizeKnowledgeEntry(item.id, item.data()))
        .filter((entry): entry is KnowledgeEntry => Boolean(entry && canViewKnowledgeEntry(entry, currentIdentity?.authorId) && isTechNews(entry)))
        .sort((left, right) => right.createdAt - left.createdAt)
        .slice(0, NEWS_QUERY_LIMIT);
      newsCache = { loadedAt: Date.now(), entries: nextEntries };
      setEntries(nextEntries);
    } catch (loadError) {
      console.error("Tech News load failed:", loadError);
      setError("Tech News is temporarily unavailable. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => setSignedInEmail(user?.email?.trim().toLowerCase() || ""));
    void loadNews();
    return unsubscribe;
  }, [currentIdentity?.authorId]);
  const filteredEntries = useMemo(() => entries
    .filter((entry) => canViewKnowledgeEntry(entry, currentIdentity?.authorId))
    .filter((entry) => !selectedTag || entry.hashtags.some((tag) => tag.toLowerCase() === selectedTag.toLowerCase()))
    .filter((entry) => {
      const date = getNewsDateParts(entry.createdAt);
      return (!selectedYear || date.year === selectedYear) && (!selectedMonth || date.month === selectedMonth) && (!selectedDay || date.day === selectedDay);
    }), [entries, currentIdentity?.authorId, selectedTag, selectedYear, selectedMonth, selectedDay]);
  const years = useMemo(() => Array.from(new Set(entries.map((entry) => getNewsDateParts(entry.createdAt).year))).filter(Boolean).sort((a, b) => b.localeCompare(a)), [entries]);
  const months = useMemo(() => Array.from(new Set(entries.map((entry) => getNewsDateParts(entry.createdAt)).filter((date) => !selectedYear || date.year === selectedYear).map((date) => date.month))).filter(Boolean).sort((a, b) => b.localeCompare(a)), [entries, selectedYear]);
  const days = useMemo(() => Array.from(new Set(entries.map((entry) => getNewsDateParts(entry.createdAt)).filter((date) => (!selectedYear || date.year === selectedYear) && (!selectedMonth || date.month === selectedMonth)).map((date) => date.day))).filter(Boolean).sort((a, b) => b.localeCompare(a)), [entries, selectedYear, selectedMonth]);
  const groupedEntries = useMemo(() => {
    const groups = new Map<string, KnowledgeEntry[]>();
    for (const entry of filteredEntries) {
      const date = getNewsDateParts(entry.createdAt);
      const key = `${date.year}-${date.month}-${date.day}`;
      groups.set(key, [...(groups.get(key) || []), entry]);
    }
    return Array.from(groups.entries()).sort(([left], [right]) => right.localeCompare(left));
  }, [filteredEntries]);
  const focusedNewsEntry = focusedEntryId
    ? entries.find((entry) => entry.id === focusedEntryId && canViewKnowledgeEntry(entry, currentIdentity?.authorId)) || null
    : null;

  useEffect(() => {
    let cancelled = false;
    setRelatedEntries([]);
    setRelatedQuestions([]);
    if (!focusedNewsEntry) return;
    void Promise.all([
      fetchSinglePostRelatedKnowledge(focusedNewsEntry),
      fetchSinglePostRelatedSmartTalk(focusedNewsEntry),
    ]).then(([posts, questions]) => {
      if (!cancelled) {
        setRelatedEntries(posts);
        setRelatedQuestions(questions);
      }
    }).catch((loadError) => console.warn("Tech News related content failed:", loadError));
    return () => { cancelled = true; };
  }, [focusedNewsEntry?.id]);
  const handleImageSelected = async (file?: File) => {
    if (!file) return;
    setIsOptimizingImage(true);
    setPublishError(null);
    try {
      const optimized = await optimizeKnowledgeImageFile(file, {
        targetRatio: 16 / 9,
        maxDimension: 900,
        maxInlineChars: 90_000,
      });
      setImage(optimized);
    } catch (imageError) {
      setPublishError(imageError instanceof Error ? imageError.message : "Could not optimize this image.");
    } finally {
      setIsOptimizingImage(false);
    }
  };

  const handlePublishNews = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const user = auth.currentUser;
    if (!isNewsEditor || !user || !image) return;
    setIsPublishing(true);
    setPublishError(null);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/posts?action=tech-news", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: headline, content, image, hashtags: parseManualHashtags(hashtags) }),
      });
      const result = await response.json() as { entry?: KnowledgeEntry; error?: string };
      if (!response.ok || !result.entry) {
        throw new Error(result.error || "Could not publish this news item.");
      }
      const nextEntries = [result.entry, ...entries.filter((entry) => entry.id !== result.entry?.id)]
        .slice(0, NEWS_QUERY_LIMIT);
      newsCache = { loadedAt: Date.now(), entries: nextEntries };
      setEntries(nextEntries);
      setHeadline("");
      setContent("");
      setHashtags("");
      setImage(null);
      setIsComposerOpen(false);
    } catch (publishFailure) {
      setPublishError(publishFailure instanceof Error ? publishFailure.message : "Could not publish this news item.");
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <>
      <SEO title={focusedNewsEntry ? `${focusedNewsEntry.title} | Readative Tech News` : selectedTag ? `#${selectedTag} Tech News | Readative` : "Technology News, AI & Innovation | Readative"} description={focusedNewsEntry ? focusedNewsEntry.content.slice(0, 160) : selectedTag ? `Read Readative technology news tagged #${selectedTag}.` : "Read concise technology news, AI developments, product updates, and practical context from Readative's editorial desk."} keywords={["technology news", "tech news", "AI news", "technology updates", "Readative Tech News", ...(selectedTag ? [selectedTag] : [])]} url={focusedNewsEntry ? `/tech-news/article/${encodeURIComponent(focusedNewsEntry.id)}` : selectedTag ? `/tech-news/tag/${encodeURIComponent(selectedTag)}` : "/tech-news"} />
      <main className={focusedEntryId ? "mx-auto w-full max-w-[1600px] px-3 pb-24 pt-20 sm:px-5 md:px-8 md:pb-16 md:pt-24" : "mx-auto max-w-5xl px-4 pb-16 pt-24 md:px-6 md:pt-28"}>
        {focusedEntryId ? (
          focusedNewsEntry ? (
            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:gap-10">
              <article className="min-w-0">
                <button type="button" onClick={() => navigateToRoute("explore")} className="mb-3 inline-flex items-center gap-2 text-sm font-bold text-emerald-800 hover:text-emerald-950">← Back to Tech News</button>
                <KnowledgeCard entry={focusedNewsEntry} presentation="news-article" focused currentIdentity={currentIdentity} onIdentityRequired={onIdentityRequired} onOpenProfile={onOpenProfile} onOpenEntry={() => undefined} />
                <div className="mt-5 xl:hidden">
                  <KnowledgeJourney entry={focusedNewsEntry} entries={relatedEntries} questions={relatedQuestions} className="rounded-2xl" />
                </div>
              </article>
              <aside aria-label="Related posts and SmartTalk" className="hidden xl:block">
                <div className="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <h2 className="mb-3 text-sm font-black uppercase tracking-wide text-slate-700">Related posts & SmartTalk</h2>
                  <KnowledgeJourney entry={focusedNewsEntry} entries={relatedEntries} questions={relatedQuestions} className="mt-0 border-0 bg-transparent p-0 shadow-none" variant="rail" />
                </div>
              </aside>
            </div>
          ) : isLoading ? (
            <div className="mx-auto h-96 max-w-3xl animate-pulse rounded-3xl bg-slate-100" />
          ) : (
            <div role="alert" className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-600">This Tech News article is unavailable. <button type="button" onClick={() => navigateToRoute("explore")} className="font-bold text-emerald-800 underline">Back to Tech News</button></div>
          )
        ) : <>
        <div className="flex items-center justify-between gap-4">
          <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight text-slate-950 md:text-3xl"><Cpu className="h-6 w-6 text-emerald-700" /> {selectedTag ? `Tech News #${selectedTag}` : "Tech News"}</h1>
          <div className="flex items-center gap-2">
            {isNewsEditor && <button type="button" onClick={() => { setPublishError(null); setIsComposerOpen(true); }} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-800"><Plus className="h-4 w-4" /> Add News</button>}
            <button type="button" onClick={() => void loadNews(true)} disabled={isLoading} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50" aria-label="Refresh Tech News"><RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} /></button>
          </div>
        </div>

        {isComposerOpen && isNewsEditor && <div className="fixed inset-0 z-[75] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isPublishing) setIsComposerOpen(false); }}>
          <form onSubmit={(event) => void handlePublishNews(event)} className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-[2rem] bg-white p-5 shadow-2xl sm:rounded-[2rem] md:p-8">
            <div className="flex items-center justify-between gap-4"><h2 className="text-xl font-black text-slate-950">Add Tech News</h2><button type="button" onClick={() => setIsComposerOpen(false)} disabled={isPublishing} className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500" aria-label="Close news editor"><X className="h-5 w-5" /></button></div>
            <label className="mt-6 block text-sm font-bold text-slate-700">Headline<input required maxLength={160} value={headline} onChange={(event) => setHeadline(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-base font-semibold text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" /></label>
            <label className="mt-4 block text-sm font-bold text-slate-700">Main news content<textarea required minLength={40} maxLength={20000} rows={8} value={content} onChange={(event) => setContent(event.target.value)} className="mt-2 w-full resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm leading-6 text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" /></label>
            <label className="mt-4 block text-sm font-bold text-slate-700"><span className="inline-flex items-center gap-1.5"><Hash className="h-4 w-4" /> Hashtags</span><input maxLength={180} value={hashtags} onChange={(event) => setHashtags(event.target.value)} placeholder="technology, ai, startups" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" /><span className="mt-1 block text-xs font-normal text-slate-500">Comma or space separated, up to 8. Helps readers find related stories.</span></label>
            <div className="mt-4"><input ref={fileInputRef} type="file" accept="image/*" className="sr-only" onChange={(event) => void handleImageSelected(event.target.files?.[0])} /><button type="button" onClick={() => fileInputRef.current?.click()} disabled={isOptimizingImage} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:border-emerald-300"><ImagePlus className="h-4 w-4" /> {isOptimizingImage ? "Optimizing image…" : image ? "Change image" : "Choose image"}</button><p className="mt-2 text-xs text-slate-500">Image is resized and compressed before publishing.</p>{image && <img src={image.dataUrl} alt="News preview" className="mt-3 h-36 w-full rounded-xl object-cover" />}</div>
            {publishError && <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{publishError}</p>}
            <button type="submit" disabled={!headline.trim() || content.trim().length < 40 || !image || isOptimizingImage || isPublishing} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 font-black text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">{isPublishing && <LoaderCircle className="h-4 w-4 animate-spin" />} Publish news</button>
          </form>
        </div>}

        {error && <div role="alert" className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error} <button type="button" className="ml-2 underline" onClick={() => void loadNews(true)}>Retry</button></div>}
        {isLoading && entries.length === 0 && <div className="mt-8 grid gap-5 md:grid-cols-2">{[0,1,2,3].map((item) => <div key={item} className="h-96 animate-pulse rounded-3xl bg-slate-100" />)}</div>}
        {!isLoading && !error && filteredEntries.length === 0 && <div className="mt-8 rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center"><Cpu className="mx-auto h-8 w-8 text-emerald-700" /><h2 className="mt-3 text-xl font-black text-slate-900">No news yet</h2></div>}
        <div className="mt-6 grid items-start gap-5 md:grid-cols-2">
          {entries.length > 0 && <div className="mb-5 flex flex-wrap gap-3 md:col-span-2" aria-label="Filter news by date">
            <select aria-label="Filter by year" value={selectedYear} onChange={(event) => { setSelectedYear(event.target.value); setSelectedMonth(""); setSelectedDay(""); }} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"><option value="">All years</option>{years.map((year) => <option key={year} value={year}>{year}</option>)}</select>
            <select aria-label="Filter by month" value={selectedMonth} onChange={(event) => { setSelectedMonth(event.target.value); setSelectedDay(""); }} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"><option value="">All months</option>{months.map((month) => <option key={month} value={month}>{MONTH_NAMES[Number(month) - 1]}</option>)}</select>
            <select aria-label="Filter by day" value={selectedDay} onChange={(event) => setSelectedDay(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"><option value="">All days</option>{days.map((day) => <option key={day} value={day}>{Number(day)}</option>)}</select>
          </div>}
          {groupedEntries.map(([dateKey, dateEntries]) => <section key={dateKey} className="md:col-span-2"><h2 className="mb-3 text-lg font-black text-slate-800">{new Intl.DateTimeFormat("en-IN", { timeZone: NEWS_TIME_ZONE, dateStyle: "full" }).format(new Date(`${dateKey}T12:00:00+05:30`))}</h2><div className="grid items-start gap-5 md:grid-cols-2">{dateEntries.map((entry) => <div key={entry.id} className="min-w-0 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_12px_34px_rgba(15,23,42,0.06)]"><KnowledgeCard entry={entry} presentation="news" currentIdentity={currentIdentity} onIdentityRequired={onIdentityRequired} onOpenProfile={onOpenProfile} onSelectHashtag={(tag) => navigateToRoute("knowledge", { selectedHashtag: tag, techNewsTag: true })} onOpenEntry={(entryId) => navigateToRoute("explore", { focusedEntryId: entryId, seoTitle: entry.title })} /></div>)}</div></section>)}
        </div>
        </>}
      </main>
    </>
  );
}

