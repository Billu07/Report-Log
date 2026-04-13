"use client";

import { format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, formatDistanceToNow } from "date-fns";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import { createClient, Session } from "@supabase/supabase-js";
import {
  LayoutDashboard,
  FileText,
  Settings,
  Sun,
  Moon,
  Plus,
  Image as ImageIcon,
  Loader2,
  ArrowLeft,
  Calendar,
  X,
  Users,
  LogOut,
  Lock,
  Mail,
  User as UserIcon,
  ChevronLeft,
  ChevronRight,
  LayoutList,
  CalendarDays,
  MessageSquare,
  SmilePlus,
  Camera,
  Activity,
  Send,
  Heart,
  Rocket,
  Flame,
  PartyPopper,
  Eye,
  CheckCircle2,
  MoreHorizontal,
  Trash2,
  AtSign
} from "lucide-react";
import { useUploadThing } from "../utils/uploadthing";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- TYPES ---
type ReportRecord = {
  id: string;
  report_date: string;
  author_name: string;
  author_email?: string | null;
  raw_text: string;
  formatted_report: string;
  image_url?: string | null;
  created_at?: string | null;
};

type ProfileRecord = {
  id: string;
  user_email: string;
  full_name: string;
  avatar_url?: string | null;
  cover_url?: string | null;
  bio?: string | null;
};

type ReactionRecord = {
  id: string;
  post_id?: string;
  comment_id?: string;
  author_email: string;
  emoji: string;
};

type CommentRecord = {
  id: string;
  post_id: string;
  author_email: string;
  content: string;
  created_at: string;
  author_name?: string;
  author_avatar?: string;
  reactions: ReactionRecord[];
};

type PostRecord = {
  id: string;
  author_email: string;
  content: string;
  image_url?: string | null;
  created_at: string;
  author_name?: string;
  author_avatar?: string;
  comments: CommentRecord[];
  reactions: ReactionRecord[];
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/backend";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const CEO_EMAIL = process.env.NEXT_PUBLIC_CEO_EMAIL?.toLowerCase() ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const EMOJI_OPTIONS = [
  { char: "👍", label: "Thumbs Up" },
  { char: "🚀", label: "Rocket" },
  { char: "🔥", label: "Fire" },
  { char: "🎉", label: "Party" },
  { char: "👀", label: "Eyes" },
];

// --- API FETCHERS ---
async function fetchWithAuth(url: string, options: RequestInit = {}, token: string) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      "Authorization": `Bearer ${token}`,
    },
  });
  if (response.status === 204) return null;
  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`API Error ${response.status}:`, errorBody);
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}

// --- UI COMPONENTS ---

function LoadingSpinner({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <div className={className}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
        className="h-full w-full border-2 border-primary/30 border-t-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.3)]"
      />
    </div>
  );
}

function CleanReport({ text, onViewImage }: { text: string, onViewImage: (url: string) => void }) {
  const lines = text.split("\n");
  return (
    <div className="flex flex-col gap-5 text-[color:var(--foreground)] font-sans antialiased">
      {lines.map((line, i) => {
        if (!line.trim()) return null;
        
        // Image Handling (Sleek Folder Wizard)
        const imageMatch = line.match(/!\[.*?\]\((.*?)\)/);
        if (imageMatch) {
          return (
            <div key={i} className="my-6">
              <button 
                onClick={() => onViewImage(imageMatch[1])}
                className="inline-flex items-center gap-3 px-5 py-3 rounded-2xl border border-[color:var(--border)] bg-primary/5 text-primary hover:bg-primary hover:text-white transition-all group shadow-sm hover:shadow-primary/10"
              >
                <div className="relative">
                  {/* High-end Retro Folder SVG */}
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="transition-transform group-hover:scale-110">
                    <path d="M2 7C2 5.89543 2.89543 5 4 5H9L11 7H20C21.1046 7 22 7.89543 22 9V18C22 19.1046 21.1046 20 20 20H4C2.89543 20 2 19.1046 2 18V7Z" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                    <path d="M2 10H22" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                    <path d="M5 8V6C5 5.44772 5.44772 5 6 5H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">View Attachment</span>
              </button>
            </div>
          );
        }

        // Professional Typography Logic
        const isHeader = line.startsWith("#") || line.match(/^\d\.\s/);
        const isSubHeader = line.match(/^\s*-\s\w+:/);
        const isBullet = line.trim().startsWith("-") || line.trim().startsWith("*");
        
        let content = line.replace(/^[#\-*]+\s*/, "").replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1");

        if (isHeader) {
          return <h3 key={i} className="mt-8 mb-2 font-heading text-lg font-bold text-primary tracking-tight border-b border-primary/10 pb-2">{content}</h3>;
        }

        if (isSubHeader) {
          const [label, ...rest] = content.split(":");
          return (
            <div key={i} className="mt-3 flex items-start gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-primary mt-1 min-w-[100px] shrink-0">{label.trim()}</span>
              <span className="text-sm font-medium text-[color:var(--foreground)] opacity-90 leading-relaxed">{rest.join(":").trim()}</span>
            </div>
          );
        }

        if (isBullet) {
          return (
            <div key={i} className="relative pl-6 text-sm font-medium leading-relaxed text-[color:var(--muted-foreground)] before:absolute before:left-0 before:top-2.5 before:h-[5px] before:w-[5px] before:rounded-full before:bg-primary/30">
              {content}
            </div>
          );
        }

        return <p key={i} className="text-sm font-medium leading-relaxed text-[color:var(--muted-foreground)] opacity-90">{content}</p>;
      })}
    </div>
  );
}

// --- AUTH SCREEN ---
function AuthScreen({ onAuthSuccess }: { onAuthSuccess: (session: Session) => void }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setMessage(null);
    try {
      if (isResetMode) {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}`,
        });
        if (resetError) throw resetError;
        setMessage("Check your email for the reset link.");
        return;
      }

      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email, password, options: { data: { full_name: fullName } }
        });
        if (signUpError) throw signUpError;
        
        if (data.session) {
          onAuthSuccess(data.session);
        } else {
          setError("Account created! You can now sign in.");
          setIsSignUp(false);
        }
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        if (data.session) onAuthSuccess(data.session);
      }
    } catch (err: any) { setError(err.message); } 
    finally { setIsLoading(false); }
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[color:var(--background)] p-4 text-[color:var(--foreground)]">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="card-elevated w-full max-w-md p-8 sm:p-12">
        <div className="mb-10 text-center flex flex-col items-center">
          <img src="/logo.png" alt="Company Logo" className="h-16 w-16 object-contain mb-6" />
          <h1 className="font-heading text-3xl font-extrabold tracking-tight text-primary">Autolinium</h1>
          <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/5 border border-primary/10 text-[10px] font-black uppercase tracking-[0.2em] text-primary/60">
            {isResetMode ? "Security Recovery" : isSignUp ? "Identity Registration" : "Authorized Access Only"}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {isSignUp && !isResetMode && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[color:var(--muted-foreground)]">Full Name</label>
              <div className="relative">
                <UserIcon size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--muted-foreground)]" />
                <input required type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="input-field pl-11" placeholder="Sheikh Hasina" />
              </div>
            </motion.div>
          )}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[color:var(--muted-foreground)]">Email Address</label>
            <div className="relative">
              <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--muted-foreground)]" />
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field pl-11" placeholder="you@company.com" />
            </div>
          </div>
          {!isResetMode && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-[color:var(--muted-foreground)]">Password</label>
                {!isSignUp && (
                  <button type="button" onClick={() => { setIsResetMode(true); setError(null); }} className="text-[10px] font-bold text-primary hover:underline">Forgot password?</button>
                )}
              </div>
              <div className="relative">
                <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--muted-foreground)]" />
                <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input-field pl-11" placeholder="••••••••" />
              </div>
            </div>
          )}
          {error && <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive">{error}</div>}
          {message && <div className="rounded-xl bg-primary/10 border border-primary/20 p-4 text-sm text-primary font-bold">{message}</div>}
          <button type="submit" disabled={isLoading} className="button-primary mt-4 w-full h-12 text-base">
            {isLoading ? <LoadingSpinner className="h-5 w-5 border-t-white border-white/20" /> : isResetMode ? "Send Recovery Link" : isSignUp ? "Create Account" : "Sign In"}
          </button>
        </form>
        <div className="mt-8 text-center text-sm text-[color:var(--muted-foreground)]">
          {isResetMode ? (
            <button onClick={() => { setIsResetMode(false); setError(null); setMessage(null); }} className="font-bold text-primary hover:underline italic">Back to Sign In</button>
          ) : (
            <>
              {isSignUp ? "Already have an account? " : "Need an account? "}
              <button onClick={() => { setIsSignUp(!isSignUp); setError(null); setMessage(null); }} className="font-bold text-primary hover:underline">
                {isSignUp ? "Sign In" : "Sign Up"}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// --- DASHBOARD APP ---

type ProjectUpdateState = {
  id: string;
  projectName: string;
  workNotes: string;
  nextSteps?: string;
  blockers?: string;
  selectedImage: File | null;
  uploadedImageUrl: string | null;
};

export default function Dashboard() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [profiles, setAllProfiles] = useState<ProfileRecord[]>([]);
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState<"dashboard" | "reports" | "feed" | "profile" | "settings">("dashboard");
  const [reportsViewMode, setReportsViewMode] = useState<"list" | "calendar">("list");
  const [visibleMonth, setVisibleMonth] = useState<Date>(new Date());

  const [replyTo, setReplyingTo] = useState<string | null>(null);

  const [selectedReport, setSelectedReport] = useState<ReportRecord | null>(null);
  const [selectedAuthor, setSelectedAuthor] = useState<string | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [viewingProfile, setViewingProfile] = useState<ProfileRecord | null>(null);
  
  // Compose Report State
  const [reportDate, setReportDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [updates, setUpdates] = useState<ProjectUpdateState[]>([
    { id: "1", projectName: "", workNotes: "", nextSteps: "", blockers: "", selectedImage: null, uploadedImageUrl: null }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Compose Post State
  const [postContent, setPostContent] = useState("");
  const [postImage, setPostImage] = useState<File | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [mentionSearch, setMentionSearch] = useState<string | null>(null);
  
  // Profile State
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  const { startUpload } = useUploadThing("imageUploader");

  // Load Session
  useEffect(() => {
    setMounted(true);
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  // Load Data
  useEffect(() => {
    // IMMEDIATE RESET: Clear all user-specific state when session changes
    setReports([]);
    setPosts([]);
    setProfile(null);
    setAllProfiles([]);
    setSelectedReport(null);
    setSelectedAuthor(null);
    
    if (!session) { 
      setIsLoading(false); 
      return; 
    }
    let isCancelled = false;
    async function loadAll() {
      setIsLoading(true);
      try {
        const [repData, postData, profData, allProfs] = await Promise.all([
          fetchWithAuth(`${API_BASE_URL}/reports`, { cache: "no-store" }, session!.access_token),
          fetchWithAuth(`${API_BASE_URL}/posts`, { cache: "no-store" }, session!.access_token),
          fetchWithAuth(`${API_BASE_URL}/profiles/me`, {}, session!.access_token),
          fetchWithAuth(`${API_BASE_URL}/profiles/all`, {}, session!.access_token).catch(() => [])
        ]);
        if (!isCancelled) {
          setReports(repData.map((r: any, i: number) => ({ ...r, id: r.id || `temp-${i}`, author_name: r.author_name || "Unknown" })));
          setPosts(postData);
          setProfile(profData);
          setAllProfiles(allProfs);
        }
      } catch (err) { console.error(err); } 
      finally { if (!isCancelled) setIsLoading(false); }
    }
    void loadAll();
    return () => { isCancelled = true; };
  }, [session]);

  const isCEO = session?.user?.email?.toLowerCase() === CEO_EMAIL;
  
  useEffect(() => {
    if (session && !isCEO && activeTab === "dashboard") {
      setActiveTab("reports");
    }
  }, [session, isCEO, activeTab]);

  function handleMonthChange(direction: "previous" | "next") {
    setVisibleMonth((current) => direction === "previous" ? subMonths(current, 1) : addMonths(current, 1));
  }

  function handleReply(authorName: string, postId: string) {
    setReplyingTo(authorName);
    const input = document.getElementById(`comment-input-${postId}`) as HTMLInputElement;
    if (input) {
      input.value = `@${authorName} `;
      input.focus();
    }
  }

  // --- ACTIONS ---
  async function handleReportSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    setIsSubmitting(true);
    try {
      const finalUpdates = [...updates];
      for (let i = 0; i < finalUpdates.length; i++) {
        if (finalUpdates[i].selectedImage) {
          const uploadRes = await startUpload([finalUpdates[i].selectedImage!]);
          if (uploadRes && uploadRes.length > 0) finalUpdates[i].uploadedImageUrl = uploadRes[0].url;
        }
      }
      const payload = {
        report_date: reportDate,
        updates: finalUpdates.map(u => ({ 
          project_name: u.projectName.trim(), 
          work_notes: u.workNotes.trim(), 
          next_steps: u.nextSteps?.trim(),
          blockers: u.blockers?.trim(),
          image_url: u.uploadedImageUrl 
        }))
      };
      await fetchWithAuth(`${API_BASE_URL}/submit-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }, session.access_token);
      const data = await fetchWithAuth(`${API_BASE_URL}/reports`, { cache: "no-store" }, session.access_token);
      setReports(data.map((r: any, i: number) => ({ ...r, id: r.id || `temp-${i}`, author_name: r.author_name || "Unknown" })));
      setUpdates([{ id: Math.random().toString(), projectName: "", workNotes: "", selectedImage: null, uploadedImageUrl: null }]);
      setIsComposing(false);
    } catch (err) { console.error(err); } finally { setIsSubmitting(false); }
  }

  async function handlePostSubmit(e: FormEvent) {
    e.preventDefault();
    if (!session || !postContent.trim()) return;
    setIsPosting(true);
    try {
      let finalImageUrl: string | null = null;
      if (postImage) {
        const uploadRes = await startUpload([postImage]);
        if (uploadRes && uploadRes.length > 0) finalImageUrl = uploadRes[0].url;
      }
      await fetchWithAuth(`${API_BASE_URL}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: postContent.trim(), image_url: finalImageUrl }),
      }, session.access_token);
      const newPosts = await fetchWithAuth(`${API_BASE_URL}/posts`, { cache: "no-store" }, session.access_token);
      setPosts(newPosts);
      setPostContent("");
      setPostImage(null);
    } catch (err) { console.error(err); } finally { setIsPosting(false); }
  }

  async function handleDeletePost(postId: string) {
    if (!session || !confirm("Delete this post?")) return;
    try {
      await fetchWithAuth(`${API_BASE_URL}/posts/${postId}`, { method: "DELETE" }, session.access_token);
      setPosts(prev => prev.filter(p => p.id !== postId));
    } catch (err) { console.error(err); }
  }

  async function handleCommentSubmit(postId: string, content: string) {
    if (!session || !content.trim()) return;
    try {
      await fetchWithAuth(`${API_BASE_URL}/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim() }),
      }, session.access_token);
      const newPosts = await fetchWithAuth(`${API_BASE_URL}/posts`, { cache: "no-store" }, session.access_token);
      setPosts(newPosts);
      setReplyingTo(null);
    } catch (err) { console.error(err); }
  }

  async function handleDeleteComment(postId: string, commentId: string) {
    if (!session || !confirm("Delete this comment?")) return;
    try {
      await fetchWithAuth(`${API_BASE_URL}/comments/${commentId}`, { method: "DELETE" }, session.access_token);
      const newPosts = await fetchWithAuth(`${API_BASE_URL}/posts`, { cache: "no-store" }, session.access_token);
      setPosts(newPosts);
    } catch (err) { console.error(err); }
  }

  async function handleReaction(id: string, emoji: string, type: "post" | "comment") {
    if (!session) return;
    
    // OPTIMISTIC UPDATE
    const userEmail = session.user.email;
    const oldPosts = [...posts];
    
    setPosts(prevPosts => prevPosts.map(post => {
      if (type === "post" && post.id === id) {
        const hasReacted = post.reactions.some(r => r.emoji === emoji && r.author_email === userEmail);
        const newReactions = hasReacted 
          ? post.reactions.filter(r => !(r.emoji === emoji && r.author_email === userEmail))
          : [...post.reactions, { id: "temp", author_email: userEmail!, emoji }];
        return { ...post, reactions: newReactions };
      }
      
      if (type === "comment") {
        return {
          ...post,
          comments: post.comments.map(comment => {
            if (comment.id === id) {
              const hasReacted = comment.reactions?.some(r => r.emoji === emoji && r.author_email === userEmail);
              const newReactions = hasReacted 
                ? comment.reactions.filter(r => !(r.emoji === emoji && r.author_email === userEmail))
                : [...(comment.reactions || []), { id: "temp", author_email: userEmail!, emoji }];
              return { ...comment, reactions: newReactions };
            }
            return comment;
          })
        };
      }
      return post;
    }));

    try {
      const url = type === "post" ? `${API_BASE_URL}/posts/${id}/reactions` : `${API_BASE_URL}/comments/${id}/reactions`;
      await fetchWithAuth(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      }, session.access_token);
      
      // Silent background sync to get real IDs and ensure consistency
      const newPosts = await fetchWithAuth(`${API_BASE_URL}/posts`, { cache: "no-store" }, session.access_token);
      setPosts(newPosts);
    } catch (err) { 
      console.error(err);
      setPosts(oldPosts); // Revert on error
    }
  }

  async function handleProfileImageUpload(file: File, type: "avatar" | "cover") {
    if (!session) return;
    setIsUpdatingProfile(true);
    try {
      const uploadRes = await startUpload([file]);
      if (uploadRes && uploadRes.length > 0) {
        const url = uploadRes[0].url;
        const newProf = await fetchWithAuth(`${API_BASE_URL}/profiles/me`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(type === "avatar" ? { avatar_url: url } : { cover_url: url })
        }, session.access_token);
        setProfile(newProf);
        const newPosts = await fetchWithAuth(`${API_BASE_URL}/posts`, { cache: "no-store" }, session.access_token);
        setPosts(newPosts);
      }
    } catch (err) { console.error(err); } finally { setIsUpdatingProfile(false); }
  }

  async function handleProfileUpdate(e: FormEvent, bio: string, name: string) {
    e.preventDefault();
    if (!session) return;
    setIsUpdatingProfile(true);
    try {
      const newProf = await fetchWithAuth(`${API_BASE_URL}/profiles/me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bio, full_name: name })
      }, session.access_token);
      setProfile(newProf);
      const newPosts = await fetchWithAuth(`${API_BASE_URL}/posts`, { cache: "no-store" }, session.access_token);
      setPosts(newPosts);
    } catch (err) { console.error(err); } finally { setIsUpdatingProfile(false); }
  }

  function insertMention(postId: string | null, name: string) {
    if (postId === null) {
      const current = postContent;
      const lastIndex = current.lastIndexOf("@");
      setPostContent(current.substring(0, lastIndex) + `@${name} `);
      setMentionSearch(null);
    } else {
      const input = document.getElementById(`comment-input-${postId}`) as HTMLInputElement;
      if (input) {
        const current = input.value;
        const lastIndex = current.lastIndexOf("@");
        input.value = current.substring(0, lastIndex) + `@${name} `;
        input.focus();
        setMentionSearch(null);
      }
    }
  }

  if (!mounted) return null;

  if (!session) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return (
        <div className="flex h-screen items-center justify-center bg-[color:var(--background)] p-6 text-center text-[color:var(--foreground)]">
          <div className="card-elevated p-8 max-w-lg">
            <h2 className="font-heading text-2xl font-bold text-destructive mb-4">Configuration Error</h2>
            <p className="text-[color:var(--muted-foreground)] font-medium">Missing environment variables. Please check your configuration.</p>
          </div>
        </div>
      );
    }
    return <AuthScreen onAuthSuccess={setSession} />;
  }

  const uniqueAuthors = Array.from(new Set(reports.map(r => r.author_name).filter(Boolean)));
  const displayedReports = selectedAuthor ? reports.filter(r => r.author_name === selectedAuthor) : reports;
  const myReports = reports.filter(r => r.author_name === (profile?.full_name || session.user.user_metadata.full_name || session.user.email));
  const reportsToShow = isCEO ? displayedReports : myReports;

  const userAvatar = profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.full_name || session.user.email || "U")}&background=random`;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[color:var(--background)] text-[color:var(--foreground)] selection:bg-primary/20">
      
      {/* Premium Dynamic Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-grid opacity-20" />
        <div className="absolute inset-0 bg-mesh opacity-40 animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute inset-0 bg-grain opacity-5" />
        
        <AnimatePresence>
          {activeTab === "feed" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-0 overflow-hidden"
            >
              {/* High-end Aurora Mesh */}
              <div className="absolute inset-0 bg-primary/5" />
              <div className="absolute top-[-10%] left-[-10%] w-[70%] h-[70%] bg-primary/10 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '15s' }} />
              <div className="absolute bottom-[-10%] right-[-10%] w-[70%] h-[70%] bg-primary/10 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '12s', animationDelay: '2s' }} />
              <div className="absolute top-[20%] right-[10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '18s', animationDelay: '4s' }} />
              
              {/* Subtle dynamic noise/grain overlay for texture */}
              <div className="absolute inset-0 bg-grain opacity-[0.03]" />
              
              {/* Modern floating elements */}
              <div className="absolute top-1/4 left-1/3 w-px h-64 bg-gradient-to-b from-transparent via-primary/20 to-transparent rotate-45 blur-sm" />
              <div className="absolute bottom-1/4 right-1/3 w-px h-64 bg-gradient-to-b from-transparent via-primary/20 to-transparent -rotate-45 blur-sm" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* SIDEBAR */}
      <aside className="flex w-72 flex-col border-r border-[color:var(--border)] bg-[color:var(--card)] p-6 shadow-sm z-20">
        <div className="mb-10 px-2 flex items-center gap-4 group">
          <img src="/logo.png" alt="Logo" className="h-10 w-10 object-contain group-hover:scale-110 transition-transform duration-500" />
          <div>
            <h1 className="font-heading text-xl font-bold tracking-tight text-primary">Autolinium</h1>
            <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-[color:var(--muted-foreground)] opacity-60">Operations</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {isCEO && (
            <button onClick={() => { setActiveTab("dashboard"); setSelectedReport(null); setSelectedAuthor(null); setIsComposing(false); }} className={`sidebar-nav-item h-11 ${activeTab === "dashboard" ? "active" : ""}`}>
              <LayoutDashboard size={18} /> CEO Dashboard
            </button>
          )}
          <button onClick={() => { setActiveTab("reports"); setSelectedReport(null); setSelectedAuthor(null); setIsComposing(false); }} className={`sidebar-nav-item h-11 ${activeTab === "reports" && !selectedAuthor ? "active" : ""}`}>
            <FileText size={18} /> {isCEO ? "Execution Logs" : "My Briefings"}
          </button>
          <button onClick={() => { setActiveTab("feed"); setSelectedReport(null); setIsComposing(false); }} className={`sidebar-nav-item h-11 ${activeTab === "feed" ? "active" : ""}`}>
            <Activity size={18} /> Company Feed
          </button>
          <button onClick={() => { setActiveTab("profile"); setSelectedReport(null); setIsComposing(false); }} className={`sidebar-nav-item h-11 ${activeTab === "profile" ? "active" : ""}`}>
            <UserIcon size={18} /> Profile
          </button>
          <button onClick={() => { setActiveTab("settings"); setSelectedReport(null); setIsComposing(false); }} className={`sidebar-nav-item h-11 ${activeTab === "settings" ? "active" : ""}`}>
            <Settings size={18} /> Settings
          </button>
        </nav>

        <div className="mt-auto flex flex-col gap-4 border-t border-[color:var(--border)] pt-6">
          <button onClick={() => setActiveTab("profile")} className="flex items-center gap-3 px-3 py-3 text-left hover:bg-[color:var(--muted)] rounded-xl transition-all group">
            <div className="h-10 w-10 overflow-hidden rounded-full bg-primary/10 shrink-0 border border-primary/20 group-hover:ring-2 ring-primary/20 transition-all">
              <img src={userAvatar} alt="" className="h-full w-full object-cover" />
            </div>
            <div className="flex flex-col truncate">
              <span className="truncate text-sm font-bold">{profile?.full_name || session.user.email}</span>
              <span className="truncate text-[10px] font-semibold text-[color:var(--muted-foreground)] opacity-70">{session.user.email}</span>
            </div>
          </button>
          
          <div className="flex items-center justify-between rounded-xl border border-[color:var(--border)] bg-[color:var(--input)] p-1.5">
            <button onClick={() => setTheme("light")} className={`flex flex-1 items-center justify-center rounded-lg py-2 transition-all ${theme === "light" ? "bg-[color:var(--card)] shadow-sm text-primary" : "text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"}`}><Sun size={16} /></button>
            <button onClick={() => setTheme("dark")} className={`flex flex-1 items-center justify-center rounded-lg py-2 transition-all ${theme === "dark" ? "bg-[color:var(--card)] shadow-sm text-primary" : "text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"}`}><Moon size={16} /></button>
          </div>
          <button onClick={() => supabase.auth.signOut()} className="sidebar-nav-item h-11 mt-2 text-destructive hover:bg-destructive/5 hover:text-destructive border-transparent"><LogOut size={18} /> Sign Out</button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto custom-scrollbar relative z-10">
        <header className="sticky top-0 z-10 flex h-20 items-center justify-between border-b border-[color:var(--border)] bg-[color:var(--background)]/80 px-10 backdrop-blur-xl">
          <div className="flex items-center gap-4">
            {selectedReport && (
              <button onClick={() => setSelectedReport(null)} className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-[color:var(--muted)] transition-colors">
                <ArrowLeft size={20} />
              </button>
            )}
            <h2 className="font-heading text-2xl font-bold tracking-tight text-[color:var(--foreground)]">
              {selectedReport ? "Briefing Details" : isComposing ? "Log Briefing" : activeTab === "reports" && selectedAuthor ? `${selectedAuthor}'s Execution` : activeTab === "dashboard" ? "Team Overview" : activeTab === "feed" ? "Company Feed" : activeTab}
            </h2>
          </div>
          
          {!isComposing && !selectedReport && activeTab !== "profile" && activeTab !== "feed" && activeTab !== "settings" && (
            <button onClick={() => setIsComposing(true)} className="button-primary h-11 px-6 rounded-xl font-bold tracking-tight shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5"><Plus size={18} /> Create Report</button>
          )}
        </header>

        <div className="container mx-auto max-w-6xl py-10 px-10 relative z-10">
          <AnimatePresence mode="wait">
            {isLoading && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex h-[60vh] items-center justify-center">
                <LoadingSpinner className="h-10 w-10" />
              </motion.div>
            )}

            {/* FEED VIEW */}
            {!isLoading && activeTab === "feed" && !isComposing && !selectedReport && (
              <motion.div key="feed" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-10 max-w-2xl mx-auto">
                <div className="card-elevated p-8 rounded-[2rem] border-primary/10 bg-gradient-to-br from-[color:var(--card)]/80 to-[color:var(--muted)]/10 shadow-xl shadow-black/5 backdrop-blur-xl">
                  <div className="flex gap-5">
                    <img src={userAvatar} className="h-12 w-12 rounded-2xl border border-[color:var(--border)] object-cover shrink-0 ring-4 ring-primary/5" alt="" />
                    <form onSubmit={handlePostSubmit} className="flex-1 flex flex-col gap-5">
                      <div className="relative">
                        <textarea
                          value={postContent}
                          onChange={(e) => {
                            setPostContent(e.target.value);
                            if (e.target.value.endsWith("@")) setMentionSearch("post");
                            else if (!e.target.value.includes("@")) setMentionSearch(null);
                          }}
                          placeholder="Share an update or tag a teammate with @..."
                          className="w-full resize-none bg-transparent outline-none text-lg font-medium text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)] min-h-[80px]"
                        />
                        {mentionSearch === "post" && (
                          <div className="absolute top-full left-0 z-50 mt-2 w-64 bg-[color:var(--card)]/90 backdrop-blur-2xl border border-[color:var(--border)] rounded-2xl shadow-2xl overflow-hidden p-2 flex flex-col gap-1">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--muted-foreground)] p-2">Select Teammate</p>
                            {profiles.map(p => (
                              <button key={p.id} type="button" onClick={() => insertMention(null, p.full_name)} className="flex items-center gap-3 p-2 hover:bg-primary/5 hover:text-primary rounded-xl transition-colors text-sm font-semibold">
                                <img src={p.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.full_name)}&background=random`} className="h-8 w-8 rounded-full border border-primary/10" alt=""/>
                                <span>{p.full_name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      {postImage && (
                        <div className="relative rounded-2xl overflow-hidden border border-[color:var(--border)] w-fit group">
                          <button type="button" onClick={() => setPostImage(null)} className="absolute top-2 right-2 z-10 bg-black/60 backdrop-blur-md text-white rounded-full p-1.5 hover:bg-black/80 transition-colors"><X size={14}/></button>
                          <img src={URL.createObjectURL(postImage)} className="h-40 object-cover" alt="Preview" />
                        </div>
                      )}

                      <div className="flex items-center justify-between border-t border-[color:var(--border)] pt-5">
                        <label className="cursor-pointer text-primary hover:text-primary/80 transition-all flex items-center gap-2.5 text-sm font-bold group">
                          <div className="h-9 w-9 flex items-center justify-center rounded-xl bg-primary/5 group-hover:bg-primary/10"><Camera size={18} /></div>
                          Attach Media
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => setPostImage(e.target.files?.[0] ?? null)} />
                        </label>
                        <button type="submit" disabled={isPosting || (!postContent.trim() && !postImage)} className="button-primary h-10 px-6 rounded-xl font-bold tracking-tight">
                          {isPosting ? <LoadingSpinner className="h-4 w-4 border-t-white border-white/20" /> : "Post Briefing"}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>

                <div className="flex flex-col gap-10">
                  {posts.length === 0 ? (
                    <div className="text-center py-20 px-8 rounded-[2rem] border border-dashed border-[color:var(--border)] text-[color:var(--muted-foreground)] font-medium italic backdrop-blur-sm">No transmissions found in the current sector.</div>
                  ) : (
                    posts.map(post => {
                      const postAvatar = post.author_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.author_name || "U")}&background=random`;
                      const isMyPost = post.author_email === session.user.email;
                      
                      return (
                        <div key={post.id} className="card-elevated flex flex-col overflow-hidden rounded-[2rem] border-primary/5 hover:border-primary/20 transition-all duration-500 shadow-xl shadow-black/5 bg-[color:var(--card)]/60 backdrop-blur-xl group/card relative">
                          {/* Post Header */}
                          <div className="flex items-center justify-between p-6">
                            <div className="flex items-center gap-4">
                              <button 
                                onClick={() => {
                                  const p = profiles.find(p => p.user_email === post.author_email);
                                  if (p) setViewingProfile(p);
                                }}
                                className="relative group/avatar"
                              >
                                <img src={postAvatar} className="h-12 w-12 rounded-2xl border border-[color:var(--border)] object-cover shrink-0 ring-4 ring-primary/5 transition-transform group-hover/avatar:scale-105" alt="" />
                                <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-green-500 border-2 border-[color:var(--card)]" />
                              </button>
                              <div className="flex flex-col text-left">
                                <button 
                                  onClick={() => {
                                    const p = profiles.find(p => p.user_email === post.author_email);
                                    if (p) setViewingProfile(p);
                                  }}
                                  className="font-bold text-base text-[color:var(--foreground)] tracking-tight hover:text-primary transition-colors"
                                >
                                  {post.author_name}
                                </button>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--muted-foreground)] opacity-60">
                                  {formatDistanceToNow(parseISO(post.created_at), { addSuffix: true })}
                                </span>
                              </div>
                            </div>
                            
                            <div className="relative group/menu">
                              <button className="h-10 w-10 flex items-center justify-center rounded-xl hover:bg-primary/10 text-[color:var(--muted-foreground)] hover:text-primary transition-all">
                                <MoreHorizontal size={20} />
                              </button>
                              
                              <div className="absolute right-0 top-full w-48 opacity-0 pointer-events-none group-hover/menu:opacity-100 group-hover/menu:pointer-events-auto transition-all translate-y-2 group-hover/menu:translate-y-0 z-50 pt-2">
                                <div className="absolute top-0 left-0 right-0 h-2" /> {/* Invisible Bridge */}
                                <div className="bg-[color:var(--card)]/90 backdrop-blur-2xl border border-[color:var(--border)] rounded-2xl shadow-2xl py-2">
                                  {isMyPost && (
                                    <button onClick={() => handleDeletePost(post.id)} className="w-full flex items-center gap-3 px-4 py-2 text-sm font-bold text-destructive hover:bg-destructive/10 transition-colors">
                                      <Trash2 size={16} /> Delete Post
                                    </button>
                                  )}
                                  <button className="w-full flex items-center gap-3 px-4 py-2 text-sm font-bold text-[color:var(--foreground)] hover:bg-primary/5 transition-colors text-left">
                                    <AtSign size={16} /> Copy Link
                                  </button>
                                  <button className="w-full flex items-center gap-3 px-4 py-2 text-sm font-bold text-[color:var(--foreground)] hover:bg-primary/5 transition-colors text-left">
                                    <Lock size={16} /> Report
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Post Content */}
                          <div className="px-6 pb-6 whitespace-pre-wrap text-[color:var(--foreground)] leading-relaxed text-lg font-medium opacity-90">
                            {post.content.split(/(@[\w\s]+)/g).map((part, i) => 
                              part.startsWith("@") ? <span key={i} className="text-primary font-bold cursor-pointer hover:underline">{part}</span> : part
                            )}
                          </div>
                          
                          {/* Post Image */}
                          {post.image_url && (
                            <div className="px-4 pb-4">
                              <div className="overflow-hidden rounded-2xl border border-[color:var(--border)] group/img relative">
                                <img src={post.image_url} className="w-full max-h-[500px] object-cover transition-transform duration-700 group-hover/img:scale-105" alt="" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity" />
                              </div>
                            </div>
                          )}
                          
                          {/* Post Actions */}
                          <div className="px-6 py-4 border-t border-[color:var(--border)] bg-black/5 flex items-center justify-between">
                            <div className="flex flex-wrap gap-2">
                              {EMOJI_OPTIONS.map(({ char }) => {
                                const count = post.reactions.filter(r => r.emoji === char).length;
                                const isReacted = post.reactions.some(r => r.emoji === char && r.author_email === session.user.email);
                                if (count === 0 && !isReacted) return null;
                                return (
                                  <button 
                                    key={char} onClick={() => handleReaction(post.id, char, "post")}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${isReacted ? "bg-primary/10 border-primary/20 text-primary" : "bg-[color:var(--card)] border-[color:var(--border)] text-[color:var(--foreground)]"}`}
                                  >
                                    <span>{char}</span> 
                                    <span>{count}</span>
                                  </button>
                                )
                              })}
                              
                              <div className="relative group/react">
                                <button className="h-9 w-9 flex items-center justify-center rounded-full bg-primary/5 text-primary hover:bg-primary hover:text-white transition-all"><SmilePlus size={18} /></button>
                                <div className="absolute bottom-full left-0 opacity-0 pointer-events-none group-hover/react:opacity-100 group-hover/react:pointer-events-auto transition-all translate-y-2 group-hover/react:translate-y-0 z-50 pb-3">
                                  <div className="bg-[color:var(--card)]/90 backdrop-blur-2xl border border-[color:var(--border)] rounded-full shadow-2xl flex gap-1 p-2">
                                    {EMOJI_OPTIONS.map(({ char }) => (
                                      <button key={char} onClick={() => handleReaction(post.id, char, "post")} className="h-10 w-10 flex items-center justify-center text-xl rounded-full hover:bg-primary/10 transition-colors">{char}</button>
                                    ))}
                                  </div>
                                  <div className="absolute bottom-0 left-0 right-0 h-3" /> {/* Invisible Bridge */}
                                </div>
                              </div>
                            </div>
                            
                            <button className="flex items-center gap-2.5 px-4 py-2 rounded-full hover:bg-primary/5 text-[color:var(--muted-foreground)] hover:text-primary transition-all text-xs font-bold uppercase tracking-widest">
                              <MessageSquare size={16} /> {post.comments.length} Comments
                            </button>
                          </div>
                          
                          {/* Comments Section */}
                          <div className="p-6 bg-black/5 flex flex-col gap-6">
                            {post.comments.length > 0 && (
                              <div className="flex flex-col gap-5">
                                {post.comments.map(comment => {
                                  const commentAvatar = comment.author_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.author_name || "U")}&background=random`;
                                  const isMyComment = comment.author_email === session.user.email;
                                  return (
                                    <div key={comment.id} className="flex gap-4 group/comment">
                                      <img src={commentAvatar} className="h-10 w-10 rounded-2xl border border-[color:var(--border)] object-cover shrink-0 ring-2 ring-primary/5" alt="" />
                                      <div className="flex flex-col gap-1 flex-1">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-3">
                                            <span className="font-bold text-sm tracking-tight">{comment.author_name}</span>
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--muted-foreground)] opacity-40">{formatDistanceToNow(parseISO(comment.created_at), { addSuffix: true })}</span>
                                          </div>
                                          {isMyComment && <button onClick={() => handleDeleteComment(post.id, comment.id)} className="h-6 w-6 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-destructive opacity-0 group-hover/comment:opacity-100 transition-all"><Trash2 size={12}/></button>}
                                        </div>
                                        <div className="bg-[color:var(--card)] border border-[color:var(--border)] rounded-[1.5rem] rounded-tl-none px-5 py-3 text-base font-medium text-[color:var(--foreground)] opacity-90 shadow-sm">
                                          {comment.content.split(/(@[\w\s]+)/g).map((part, i) => part.startsWith("@") ? <span key={i} className="text-primary font-bold">{part}</span> : part)}
                                        </div>
                                        <div className="flex items-center gap-3 ml-2 mt-1">
                                          <button onClick={() => handleReply(comment.author_name || "", post.id)} className="text-[10px] font-bold uppercase tracking-widest text-primary opacity-0 group-hover/comment:opacity-100 transition-opacity">Reply</button>
                                          {/* Comment Reactions */}
                                          <div className="flex gap-1.5">
                                            {EMOJI_OPTIONS.slice(0,3).map(({char}) => {
                                              const count = comment.reactions?.filter(r => r.emoji === char).length || 0;
                                              const isReacted = comment.reactions?.some(r => r.emoji === char && r.author_email === session.user.email);
                                              return (
                                                <button key={char} onClick={() => handleReaction(comment.id, char, "comment")} className={`flex items-center gap-1 px-1.5 py-0.5 rounded-lg border text-[10px] transition-all ${isReacted ? "bg-primary/10 border-primary/20 text-primary" : "bg-transparent border-transparent text-[color:var(--muted-foreground)] hover:bg-[color:var(--muted)]"} ${count === 0 && !isReacted ? "opacity-0 group-hover/comment:opacity-100" : "opacity-100"}`}>
                                                  <span>{char}</span> {count > 0 && <span>{count}</span>}
                                                </button>
                                              )
                                            })}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                            <div className="flex gap-4 items-center relative">
                              <img src={userAvatar} className="h-10 w-10 rounded-2xl border border-[color:var(--border)] object-cover shrink-0 ring-2 ring-primary/5" alt="" />
                              <div className="flex-1 relative">
                                <form onSubmit={(e) => { e.preventDefault(); const input = e.currentTarget.elements.namedItem('comment') as HTMLInputElement; handleCommentSubmit(post.id, input.value); input.value = ''; }} className="relative flex items-center">
                                  <input id={`comment-input-${post.id}`} name="comment" type="text" placeholder="Add a comment... type @ to mention" className="w-full h-12 bg-[color:var(--card)] border border-[color:var(--border)] rounded-2xl px-6 pr-12 text-sm font-semibold outline-none focus:border-primary/30 focus:ring-4 ring-primary/5 transition-all" onChange={(e) => {
                                    if(e.target.value.endsWith("@")) setMentionSearch(post.id);
                                    else if (!e.target.value.includes("@")) setMentionSearch(null);
                                  }} />
                                  <button type="submit" className="absolute right-3 h-8 w-8 flex items-center justify-center rounded-xl bg-primary/5 text-primary hover:bg-primary hover:text-white transition-all"><Send size={16} /></button>
                                </form>
                                {mentionSearch === post.id && (
                                  <div className="absolute bottom-full left-0 z-50 mb-2 w-64 bg-[color:var(--card)] border border-[color:var(--border)] rounded-2xl shadow-2xl overflow-hidden p-2 flex flex-col gap-1">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--muted-foreground)] p-2 border-b border-[color:var(--border)] mb-1">Mention Member</p>
                                    {profiles.map(p => (
                                      <button key={p.id} type="button" onClick={() => insertMention(post.id, p.full_name)} className="flex items-center gap-3 p-2 hover:bg-primary/5 hover:text-primary rounded-xl transition-colors text-sm font-semibold">
                                        <img src={p.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.full_name)}&background=random`} className="h-8 w-8 rounded-full border border-primary/10" alt=""/>
                                        <span>{p.full_name}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </motion.div>
            )}

            {/* PROFILE VIEW */}
            {!isLoading && activeTab === "profile" && profile && (
              <motion.div key="profile" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-12 max-w-4xl mx-auto">
                <div className="card-elevated overflow-hidden relative rounded-[3rem] border-primary/5 shadow-2xl">
                  <div className="aspect-[3.5/1] w-full bg-[color:var(--muted)] relative group overflow-hidden border-b border-[color:var(--border)]">
                    {profile.cover_url ? (
                      <img src={profile.cover_url} className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105" alt="Cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-tr from-primary/20 via-primary/5 to-transparent" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                    <label className="absolute bottom-6 right-8 h-10 px-4 bg-black/60 backdrop-blur-xl border border-white/10 text-white rounded-xl cursor-pointer opacity-0 group-hover:opacity-100 transition-all flex items-center gap-2.5 font-bold text-xs hover:bg-black/80"><Camera size={16} /> Update Cover <input type="file" accept="image/*" className="hidden" onChange={(e) => { if(e.target.files?.[0]) handleProfileImageUpload(e.target.files[0], "cover"); }} /></label>
                  </div>
                  <div className="px-10 md:px-16 pb-12 relative">
                    <div className="flex justify-between items-start">
                      <div className="relative -mt-16 md:-mt-20 group inline-block">
                        <div className="h-32 w-32 md:h-40 md:w-40 rounded-[2.5rem] border-[6px] border-[color:var(--card)] bg-[color:var(--card)] overflow-hidden shadow-2xl relative ring-1 ring-primary/5">
                          <img src={userAvatar} className="w-full h-full object-cover" alt="Avatar" />
                        </div>
                        <label className="absolute inset-0 flex items-center justify-center bg-black/50 text-white rounded-[2.5rem] cursor-pointer opacity-0 group-hover:opacity-100 transition-all border-4 border-transparent group-hover:border-primary/20"><Camera size={28} /> <input type="file" accept="image/*" className="hidden" onChange={(e) => { if(e.target.files?.[0]) handleProfileImageUpload(e.target.files[0], "avatar"); }} /></label>
                      </div>
                      <div className="pt-8 flex items-center gap-4">{isUpdatingProfile && <div className="flex items-center gap-2.5 px-4 py-2 bg-primary/5 rounded-xl border border-primary/10 text-primary text-xs font-bold uppercase tracking-widest"><LoadingSpinner className="h-3 w-3" /> Syncing</div>}</div>
                    </div>
                    <form onSubmit={(e) => handleProfileUpdate(e, (e.currentTarget.elements.namedItem('bio') as HTMLTextAreaElement).value, (e.currentTarget.elements.namedItem('name') as HTMLInputElement).value)} className="mt-8 flex flex-col gap-8">
                      <div><input name="name" defaultValue={profile.full_name} className="font-heading text-5xl font-extrabold bg-transparent outline-none border-b-2 border-transparent focus:border-primary/30 text-[color:var(--foreground)] w-full transition-all tracking-tight" /> <div className="flex items-center gap-2 mt-2 font-bold text-sm text-primary opacity-80 uppercase tracking-[0.2em]">{session.user.email}</div></div>
                      <div><label className="text-[10px] font-bold uppercase tracking-[0.3em] text-[color:var(--muted-foreground)] mb-3 block opacity-60">Bio / Role</label><textarea name="bio" defaultValue={profile.bio || ""} placeholder="Describe your role..." className="w-full max-w-3xl resize-none bg-[color:var(--input)] border border-[color:var(--border)] rounded-[1.5rem] p-5 text-lg font-medium focus:border-primary/30 focus:ring-4 ring-primary/5 outline-none min-h-[120px] transition-all leading-relaxed shadow-inner" /></div>
                      <div className="flex justify-end pt-4"><button type="submit" disabled={isUpdatingProfile} className="button-primary h-12 px-8 rounded-2xl font-bold text-base shadow-xl shadow-primary/20">Save Profile</button></div>
                    </form>
                  </div>
                </div>
                <div className="px-4">
                  <h3 className="font-heading text-2xl font-bold mb-8 tracking-tight flex items-center gap-3"><Activity size={24} className="text-primary"/> Recent Briefings</h3>
                  <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                    {myReports.length === 0 ? <div className="col-span-full py-20 border border-dashed border-[color:var(--border)] rounded-[2rem] text-center text-[color:var(--muted-foreground)] font-medium">No reports recorded yet.</div> : myReports.slice(0,6).map(report => (
                       <button key={report.id} onClick={() => setSelectedReport(report)} className="card-elevated group flex cursor-pointer flex-col p-8 text-left hover:border-primary/30 rounded-[2rem] bg-gradient-to-br from-[color:var(--card)] to-transparent">
                        <div className="mb-4 flex justify-between items-center"><span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary bg-primary/5 px-3 py-1 rounded-full">{format(parseISO(report.report_date), "MMM d, yyyy")}</span> <div className="h-8 w-8 rounded-lg bg-[color:var(--muted)] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"><ArrowLeft size={16} className="rotate-180" /></div></div>
                        <h3 className="line-clamp-2 font-heading text-xl font-bold tracking-tight mb-2">{report.formatted_report.split("\n")[0].replace(/[*#\-]/g, "")}</h3>
                        <p className="line-clamp-2 text-sm font-medium text-[color:var(--muted-foreground)] opacity-70">Review the details for this report.</p>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* DASHBOARD: TEAM */}
            {!isLoading && !isComposing && !selectedReport && activeTab === "dashboard" && (
              <motion.div key="dashboard" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-10">
                <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {uniqueAuthors.map(author => {
                    const authorReports = reports.filter(r => r.author_name === author);
                    return (
                      <button key={author} onClick={() => { setSelectedAuthor(author); setActiveTab("reports"); setReportsViewMode("list"); }} className="card-elevated flex cursor-pointer flex-col items-center justify-center p-10 text-center transition-all duration-500 hover:-translate-y-2 rounded-[2.5rem] border-primary/5 group relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="mb-6 relative">
                          <div className="h-28 w-28 overflow-hidden rounded-[2rem] border-[4px] border-[color:var(--background)] shadow-xl relative z-10">
                            <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(author)}&background=random&size=128&bold=true`} alt={author} className="h-full w-full object-cover" />
                          </div>
                          <div className="absolute -bottom-2 -right-2 h-10 w-10 bg-primary text-white rounded-xl flex items-center justify-center shadow-lg z-20 font-bold border-4 border-[color:var(--card)]">{authorReports.length}</div>
                        </div>
                        <h4 className="font-heading text-xl font-extrabold tracking-tight relative z-10">{author}</h4>
                        <div className="mt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--muted-foreground)] opacity-60 relative z-10">Team Member</div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* REPORTS VIEW */}
            {!isLoading && !isComposing && !selectedReport && activeTab === "reports" && (
               <motion.div key="list" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-10">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    {selectedAuthor && <button onClick={() => setActiveTab("dashboard")} className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary hover:translate-x-1 transition-transform"><ArrowLeft size={14} /> Back to Team</button>}
                    <h3 className="font-heading text-3xl font-extrabold tracking-tight">{selectedAuthor ? `${selectedAuthor}'s Briefings` : isCEO ? "Team Briefings" : "My Daily Briefings"}</h3>
                  </div>
                  <div className="flex rounded-xl border border-[color:var(--border)] bg-[color:var(--input)] p-1.5 self-start">
                    <button onClick={() => setReportsViewMode("list")} className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-xs font-bold uppercase tracking-widest transition-all ${reportsViewMode === "list" ? "bg-[color:var(--card)] shadow-lg text-primary" : "text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"}`}><LayoutList size={14} strokeWidth={3} /> List</button>
                    <button onClick={() => setReportsViewMode("calendar")} className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-xs font-bold uppercase tracking-widest transition-all ${reportsViewMode === "calendar" ? "bg-[color:var(--card)] shadow-lg text-primary" : "text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"}`}><CalendarDays size={14} strokeWidth={3} /> Calendar</button>
                  </div>
                </div>
                {reportsViewMode === "list" ? (
                  <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
                    {reportsToShow.map((report) => {
                      const authorProfile = profiles.find(p => p.user_email === report.author_email);
                      const reportAvatar = authorProfile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(report.author_name)}&background=random&size=32&bold=true`;
                      
                      return (
                        <div key={report.id} className="card-elevated flex flex-col p-8 hover:shadow-2xl hover:border-primary/20 rounded-[2rem] transition-all duration-500 bg-gradient-to-br from-[color:var(--card)] to-transparent group">
                          <div className="mb-5 flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary bg-primary/5 px-3 py-1.5 rounded-full">{format(parseISO(report.report_date), "MMM d, yyyy")}</span> <div className="h-8 w-8 rounded-xl bg-[color:var(--muted)] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"><ArrowLeft size={16} className="rotate-180" /></div></div>
                          <button onClick={() => setSelectedReport(report)} className="text-left">
                            <h3 className="mb-4 line-clamp-2 font-heading text-xl font-bold tracking-tight leading-tight group-hover:text-primary transition-colors">{report.formatted_report.split("\n")[0].replace(/[*#\-]/g, "")}</h3>
                          </button>
                          {!selectedAuthor && isCEO && (
                            <div className="mb-5 flex items-center gap-3">
                              <button 
                                onClick={() => {
                                  const p = profiles.find(p => p.user_email === report.author_email);
                                  if (p) setViewingProfile(p);
                                }}
                                className="h-6 w-6 rounded-lg overflow-hidden hover:ring-2 ring-primary/20 transition-all"
                              >
                                <img src={reportAvatar} alt="" className="h-full w-full object-cover" />
                              </button>
                              <span className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--muted-foreground)]">{report.author_name}</span>
                            </div>
                          )}
                          <p className="mt-auto line-clamp-3 text-sm font-medium text-[color:var(--muted-foreground)] opacity-70 leading-relaxed italic border-l-2 border-[color:var(--border)] pl-4">"{JSON.parse(report.raw_text || "[]")[0]?.work_notes || report.raw_text}"</p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="card-elevated p-10 rounded-[3rem] border-primary/5 bg-[color:var(--card)]/80 backdrop-blur-xl shadow-2xl">
                     <div className="mb-10 flex items-center justify-between">
                       <h2 className="font-heading text-3xl font-extrabold tracking-tight">{format(visibleMonth, "MMMM yyyy")}</h2> 
                       <div className="flex gap-3">
                         <button onClick={() => handleMonthChange("previous")} className="h-12 w-12 flex items-center justify-center rounded-2xl bg-primary/5 text-primary hover:bg-primary hover:text-white transition-all shadow-sm"><ChevronLeft size={24} /></button> 
                         <button onClick={() => handleMonthChange("next")} className="h-12 w-12 flex items-center justify-center rounded-2xl bg-primary/5 text-primary hover:bg-primary hover:text-white transition-all shadow-sm"><ChevronRight size={24} /></button>
                       </div>
                     </div>
                     <div className="mb-4 grid grid-cols-7 gap-4 text-center text-[10px] font-black uppercase tracking-[0.3em] text-primary opacity-40">
                       {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((dayName) => <div key={dayName} className="py-2">{dayName}</div>)}
                     </div>
                    <div className="grid grid-cols-7 gap-4">
                      {eachDayOfInterval({ start: startOfWeek(startOfMonth(visibleMonth), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(visibleMonth), { weekStartsOn: 1 }) }).map((day) => {
                        const dayReports = reportsToShow.filter((r) => isSameDay(parseISO(r.report_date), day));
                        const current = isSameMonth(day, visibleMonth);
                        const isToday = isSameDay(day, new Date());
                        return (
                           <div key={day.toISOString()} className={`flex min-h-[120px] flex-col p-4 rounded-[1.5rem] border-2 transition-all duration-500 ${!current ? "opacity-10 border-transparent" : isToday ? "border-primary/20 bg-primary/5" : "border-[color:var(--border)] bg-black/5"} ${dayReports.length > 0 ? "hover:border-primary/40 hover:bg-primary/5 hover:-translate-y-1 shadow-sm" : ""}`}>
                             <span className={`text-sm font-black tracking-tighter ${dayReports.length > 0 ? "text-primary" : "text-[color:var(--muted-foreground)] opacity-40"} ${isToday ? "scale-125 origin-left" : ""}`}>{format(day, "d")}</span>
                             <div className="mt-3 flex flex-col gap-2">
                               {dayReports.map((r, idx) => (
                                 <button key={idx} onClick={() => setSelectedReport(r)} className="w-full truncate rounded-xl bg-[color:var(--card)] px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[color:var(--foreground)] shadow-sm hover:ring-2 ring-primary/30 transition-all border border-[color:var(--border)]">{selectedAuthor ? r.formatted_report.substring(0,12) : r.author_name}</button>
                               ))}
                             </div>
                           </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* COMPOSE REPORT */}
             {!isLoading && isComposing && (
               <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                 <motion.div 
                   key="compose" 
                   initial={{ opacity: 0, scale: 0.95 }} 
                   animate={{ opacity: 1, scale: 1 }} 
                   exit={{ opacity: 0, scale: 0.95 }} 
                   className="bg-[color:var(--card)] border border-[color:var(--border)] w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                 >
                  <header className="flex items-center justify-between px-6 py-4 border-b border-[color:var(--border)] bg-[color:var(--muted)]/30">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <Plus size={18} strokeWidth={2.5} />
                      </div>
                      <h3 className="text-base font-bold text-[color:var(--foreground)]">New Briefing</h3>
                    </div>
                    <button onClick={() => setIsComposing(false)} className="text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition-colors">
                      <X size={20} />
                    </button>
                  </header>

                  <form onSubmit={handleReportSubmit} className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 custom-scrollbar">
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold text-[color:var(--muted-foreground)] uppercase tracking-wider">Report Date</label>
                      <input required type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--input)] text-sm font-medium focus:ring-2 ring-primary/20 outline-none transition-all" />
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-[color:var(--border)] pb-2">
                        <h4 className="text-xs font-bold text-[color:var(--muted-foreground)] uppercase tracking-wider">Project Updates</h4>
                      </div>

                      {updates.map((update, idx) => (
                        <div key={update.id} className="p-4 rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]/20 relative group">
                          {updates.length > 1 && (
                            <button 
                              type="button" 
                              onClick={() => setUpdates(prev => prev.filter(u => u.id !== update.id))} 
                              className="absolute right-3 top-3 text-[color:var(--muted-foreground)] hover:text-destructive transition-colors"
                            >
                              <X size={16} />
                            </button>
                          )}
                          
                          <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[11px] font-bold text-[color:var(--muted-foreground)] opacity-70">Project Name</label>
                              <input required type="text" value={update.projectName} onChange={(e) => { const newU = [...updates]; newU[idx].projectName = e.target.value; setUpdates(newU); }} placeholder="e.g. Q2 Roadmap Planning" className="w-full h-10 px-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] text-sm font-medium outline-none focus:border-primary/50 transition-all" />
                            </div>

                            <div className="flex flex-col gap-1.5">
                              <label className="text-[11px] font-bold text-[color:var(--muted-foreground)] opacity-70">Work Notes (Achievements)</label>
                              <textarea required minLength={5} value={update.workNotes} onChange={(e) => { const newU = [...updates]; newU[idx].workNotes = e.target.value; setUpdates(newU); }} placeholder="What was achieved?" className="w-full min-h-[80px] p-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] text-sm font-medium outline-none focus:border-primary/50 transition-all resize-none" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div className="flex flex-col gap-1.5">
                                <label className="text-[11px] font-bold text-[color:var(--muted-foreground)] opacity-70">Next Steps (Optional)</label>
                                <input type="text" value={update.nextSteps} onChange={(e) => { const newU = [...updates]; newU[idx].nextSteps = e.target.value; setUpdates(newU); }} placeholder="Planned actions..." className="w-full h-10 px-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] text-sm font-medium outline-none focus:border-primary/50 transition-all" />
                              </div>
                              <div className="flex flex-col gap-1.5">
                                <label className="text-[11px] font-bold text-[color:var(--muted-foreground)] opacity-70">Blockers (Optional)</label>
                                <input type="text" value={update.blockers} onChange={(e) => { const newU = [...updates]; newU[idx].blockers = e.target.value; setUpdates(newU); }} placeholder="Any impediments?" className="w-full h-10 px-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] text-sm font-medium outline-none focus:border-primary/50 transition-all" />
                              </div>
                            </div>

                            <div className="flex flex-col gap-1.5">
                              <label className="text-[11px] font-bold text-[color:var(--muted-foreground)] opacity-70">Attachment (Optional)</label>
                              <label className="flex items-center justify-between px-3 h-10 rounded-lg border border-dashed border-[color:var(--border)] bg-white/5 hover:bg-white/10 cursor-pointer transition-all">
                                <span className="text-xs text-[color:var(--muted-foreground)] truncate">{update.selectedImage ? update.selectedImage.name : "Choose file..."}</span>
                                <ImageIcon size={14} className="text-[color:var(--muted-foreground)]" />
                                <input type="file" accept="image/*" onChange={(e) => { const newU = [...updates]; newU[idx].selectedImage = e.target.files?.[0] ?? null; setUpdates(newU); }} className="hidden" />
                              </label>
                            </div>
                          </div>
                        </div>
                      ))}

                      <button 
                        type="button" 
                        onClick={() => setUpdates(prev => [...prev, { id: Math.random().toString(), projectName: "", workNotes: "", selectedImage: null, uploadedImageUrl: null }])} 
                        className="w-full py-2 flex items-center justify-center gap-2 text-xs font-bold text-primary hover:bg-primary/5 border border-dashed border-primary/20 rounded-lg transition-all"
                      >
                        <Plus size={14} strokeWidth={3} /> Add Project
                      </button>
                    </div>
                  </form>

                  <footer className="px-6 py-4 border-t border-[color:var(--border)] bg-[color:var(--muted)]/30 flex items-center justify-end gap-3">
                    <button type="button" onClick={() => setIsComposing(false)} className="px-4 py-2 text-sm font-bold text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition-colors">Cancel</button>
                    <button type="submit" onClick={() => (document.querySelector('form') as HTMLFormElement).requestSubmit()} disabled={isSubmitting || updates.some(u => !u.projectName || !u.workNotes)} className="button-primary px-5 py-2 h-9 rounded-lg text-xs font-bold uppercase tracking-wider">
                      {isSubmitting ? <LoadingSpinner className="h-4 w-4 border-t-white border-white/20" /> : "Save Briefing"}
                    </button>
                  </footer>
                 </motion.div>
               </div>
             )}

            {/* REPORT DETAIL VIEW */}
            {!isLoading && selectedReport && !isComposing && (() => {
              const authorProfile = profiles.find(p => p.user_email === selectedReport.author_email);
              const reportAvatar = authorProfile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedReport.author_name)}&background=random&size=48&bold=true`;
              
              return (
                <motion.div key="detail" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mx-auto flex max-w-4xl flex-col gap-10">
                  <div className="card-elevated p-12 md:p-16 rounded-[3.5rem] border-primary/5 shadow-2xl bg-gradient-to-br from-[color:var(--card)] to-transparent">
                    <div className="mb-12 border-b border-[color:var(--border)] pb-12 flex flex-col md:flex-row md:items-end justify-between gap-8">
                      <div>
                        <div className="flex items-center gap-3 mb-6">
                          <button 
                            onClick={() => {
                              if (authorProfile) setViewingProfile(authorProfile);
                            }}
                            className="h-10 w-10 rounded-2xl overflow-hidden shadow-lg shadow-primary/10 ring-2 ring-primary/5 hover:scale-105 transition-transform"
                          >
                            <img src={reportAvatar} alt="" className="h-full w-full object-cover" /> 
                          </button>
                          <div className="text-left">
                            <button 
                              onClick={() => {
                                if (authorProfile) setViewingProfile(authorProfile);
                              }}
                              className="font-black text-sm tracking-tight hover:text-primary transition-colors"
                            >
                              {selectedReport.author_name}
                            </button>
                            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary opacity-60">Team Member</div>
                          </div>
                        </div>
                        <h1 className="font-heading text-5xl font-black tracking-tighter leading-none mb-4">Daily Briefing</h1>
                        <div className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.3em] text-[color:var(--muted-foreground)] opacity-60"><Calendar size={14} className="text-primary" /> {format(parseISO(selectedReport.report_date), "EEEE, MMMM do, yyyy")}</div>
                      </div>
                      <div className="flex h-16 w-16 items-center justify-center group-hover:scale-110 transition-transform duration-500 p-2"><img src="/logo.png" alt="Logo" className="h-full w-full object-contain" /></div>
                    </div>
                    <div className="mb-16"><CleanReport text={selectedReport.formatted_report} onViewImage={setViewingImage} /></div>
                    <div className="rounded-[2.5rem] border-2 border-primary/5 bg-primary/5 p-10 shadow-inner">
                      <h4 className="mb-8 flex items-center gap-3 font-heading text-sm font-black uppercase tracking-[0.3em] text-primary/60"><FileText size={18} /> Raw Work Notes</h4>
                      <div className="space-y-10">{(() => { try { const parsed = JSON.parse(selectedReport.raw_text); return parsed.map((p: any, i: number) => ( <div key={i} className="flex flex-col gap-3 relative pl-6 before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-primary/10 before:rounded-full"><span className="text-xs font-black uppercase tracking-[0.2em] text-primary">{p.project_name}</span> <span className="whitespace-pre-wrap text-base font-medium text-[color:var(--muted-foreground)] leading-relaxed">{p.work_notes}</span></div> )); } catch { return <span className="whitespace-pre-wrap text-base font-medium text-[color:var(--muted-foreground)] leading-relaxed italic">"{selectedReport.raw_text}"</span>; } })()}</div>
                    </div>
                  </div>
                </motion.div>
              );
            })()}

            {/* PUBLIC PROFILE MODAL */}
            <AnimatePresence>
              {viewingProfile && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 md:p-12 bg-black/60 backdrop-blur-sm">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.98, y: 20 }} 
                    animate={{ opacity: 1, scale: 1, y: 0 }} 
                    exit={{ opacity: 0, scale: 0.98, y: 20 }}
                    className="relative w-full max-w-4xl bg-[color:var(--card)] rounded-[3rem] border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <header className="absolute top-6 right-8 z-50">
                      <button 
                        onClick={() => setViewingProfile(null)}
                        className="h-10 w-10 flex items-center justify-center rounded-xl bg-black/40 backdrop-blur-md text-white border border-white/10 hover:bg-black/60 transition-all"
                      >
                        <X size={20} />
                      </button>
                    </header>

                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                      <div className="relative h-48 md:h-64 bg-[color:var(--muted)]">
                        {viewingProfile.cover_url ? (
                          <img src={viewingProfile.cover_url} className="w-full h-full object-cover" alt="" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-tr from-primary/20 via-primary/5 to-transparent" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                      </div>

                      <div className="px-10 md:px-16 pb-12 relative">
                        <div className="relative -mt-16 md:-mt-20 mb-8">
                          <div className="h-32 w-32 md:h-40 md:w-40 rounded-[2.5rem] border-[6px] border-[color:var(--card)] bg-[color:var(--card)] overflow-hidden shadow-2xl relative">
                            <img src={viewingProfile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(viewingProfile.full_name)}&background=random&size=128&bold=true`} className="w-full h-full object-cover" alt="" />
                          </div>
                        </div>

                        <div className="flex flex-col gap-6">
                          <div>
                            <h2 className="font-heading text-4xl font-extrabold tracking-tight">{viewingProfile.full_name}</h2>
                            <div className="text-sm font-bold text-primary opacity-80 uppercase tracking-[0.2em] mt-1">{viewingProfile.user_email}</div>
                          </div>

                          {viewingProfile.bio && (
                            <div className="bg-black/5 rounded-[1.5rem] p-6 border border-[color:var(--border)] max-w-3xl">
                              <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-[color:var(--muted-foreground)] mb-3 block opacity-60">Teammate Bio</label>
                              <p className="text-lg font-medium leading-relaxed opacity-90 italic">"{viewingProfile.bio}"</p>
                            </div>
                          )}

                          <div className="mt-8">
                            <h3 className="font-heading text-xl font-bold mb-6 tracking-tight flex items-center gap-3">
                              <Activity size={20} className="text-primary"/> Recent Posts
                            </h3>
                            <div className="flex flex-col gap-6">
                              {posts.filter(p => p.author_email === viewingProfile.user_email).length === 0 ? (
                                <div className="py-10 border border-dashed border-[color:var(--border)] rounded-[2rem] text-center text-[color:var(--muted-foreground)] text-sm italic">No transmissions shared yet.</div>
                              ) : (
                                posts.filter(p => p.author_email === viewingProfile.user_email).slice(0, 5).map(post => (
                                  <div key={post.id} className="bg-[color:var(--card)] border border-[color:var(--border)] rounded-[2rem] p-6 shadow-sm">
                                    <p className="text-sm font-medium leading-relaxed opacity-90 mb-4">{post.content}</p>
                                    <div className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--muted-foreground)] opacity-40">
                                      {formatDistanceToNow(parseISO(post.created_at), { addSuffix: true })}
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                  <div className="absolute inset-0 -z-10" onClick={() => setViewingProfile(null)} />
                </div>
              )}
            </AnimatePresence>

            {/* SLEEK GALLERY MODAL */}
            <AnimatePresence>
              {viewingImage && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 md:p-12 bg-black/80 backdrop-blur-md">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.98 }} 
                    animate={{ opacity: 1, scale: 1 }} 
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="relative w-full max-w-5xl bg-[color:var(--card)] rounded-[2rem] border border-white/10 shadow-2xl overflow-hidden flex flex-col"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Modal Header */}
                    <div className="flex items-center justify-between px-8 py-4 border-b border-[color:var(--border)] bg-[color:var(--muted)]/10">
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[color:var(--muted-foreground)]">System Attachment</span>
                      </div>
                      <button 
                        onClick={() => setViewingImage(null)}
                        className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-destructive/10 hover:text-destructive transition-all text-[color:var(--muted-foreground)]"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    {/* Image Canvas with Padding */}
                    <div className="p-8 bg-black/20 flex items-center justify-center min-h-[400px] max-h-[75vh]">
                      <div className="relative w-full h-full flex items-center justify-center">
                        <img 
                          src={viewingImage} 
                          alt="Attachment" 
                          className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                        />
                      </div>
                    </div>
                  </motion.div>
                  {/* Click outside to close */}
                  <div className="absolute inset-0 -z-10" onClick={() => setViewingImage(null)} />
                </div>
              )}
            </AnimatePresence>

            {/* SETTINGS VIEW */}
            {!isLoading && activeTab === "settings" && !isComposing && !selectedReport && (
               <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card-elevated max-w-2xl p-12 rounded-[2.5rem] border-primary/5">
                <h3 className="mb-10 font-heading text-3xl font-black tracking-tight text-primary">System Configuration</h3>
                <div className="space-y-8">
                  <div className="rounded-2xl border border-[color:var(--border)] p-6 bg-black/5"><h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-3">User Identity</h4> <div className="flex items-center gap-4"><img src={userAvatar} className="h-12 w-12 rounded-2xl border border-primary/10 object-cover" alt="" /> <div><div className="font-bold text-lg">{profile?.full_name}</div> <div className="text-xs font-medium text-[color:var(--muted-foreground)]">{session.user.email}</div></div></div></div>
                  <div className="rounded-2xl border border-[color:var(--border)] p-6 bg-black/5"><h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-3">API Link</h4> <p className="font-mono text-xs text-[color:var(--muted-foreground)] tracking-tight overflow-x-auto whitespace-nowrap">{API_BASE_URL}</p></div>
                  <div className="pt-4"><button onClick={() => supabase.auth.signOut()} className="flex items-center gap-3 px-6 h-12 rounded-xl bg-destructive/5 text-destructive font-black uppercase tracking-[0.2em] text-[10px] border border-destructive/10 hover:bg-destructive hover:text-white transition-all w-fit">Sign Out</button></div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
