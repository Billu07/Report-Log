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
  Activity
} from "lucide-react";
import { useUploadThing } from "../utils/uploadthing";

// --- TYPES ---
type ReportRecord = {
  id: string;
  report_date: string;
  author_name: string;
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
  post_id: string;
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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const CEO_EMAIL = process.env.NEXT_PUBLIC_CEO_EMAIL?.toLowerCase() ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- API FETCHERS ---
async function requestReports(token: string): Promise<ReportRecord[]> {
  const response = await fetch(`${API_BASE_URL}/reports`, {
    headers: { "Authorization": `Bearer ${token}` }, cache: "no-store",
  });
  if (!response.ok) throw new Error(`Failed to fetch reports`);
  return response.json();
}

async function createReport(payload: any, token: string): Promise<{ provider: string; report: ReportRecord }> {
  const response = await fetch(`${API_BASE_URL}/submit-report`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("Submission failed");
  return response.json();
}

async function requestProfile(token: string): Promise<ProfileRecord> {
  const response = await fetch(`${API_BASE_URL}/profiles/me`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  if (!response.ok) throw new Error("Failed to fetch profile");
  return response.json();
}

async function updateProfile(payload: Partial<ProfileRecord>, token: string): Promise<ProfileRecord> {
  const response = await fetch(`${API_BASE_URL}/profiles/me`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error("Failed to update profile");
  return response.json();
}

async function requestPosts(token: string): Promise<PostRecord[]> {
  const response = await fetch(`${API_BASE_URL}/posts`, {
    headers: { "Authorization": `Bearer ${token}` }, cache: "no-store",
  });
  if (!response.ok) throw new Error(`Failed to fetch posts`);
  return response.json();
}

async function createPost(payload: { content: string; image_url?: string | null }, token: string): Promise<PostRecord> {
  const response = await fetch(`${API_BASE_URL}/posts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("Post failed");
  return response.json();
}

async function createComment(postId: string, content: string, token: string): Promise<CommentRecord> {
  const response = await fetch(`${API_BASE_URL}/posts/${postId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ content }),
  });
  if (!response.ok) throw new Error("Comment failed");
  return response.json();
}

async function toggleReaction(postId: string, emoji: string, token: string): Promise<ReactionRecord> {
  const response = await fetch(`${API_BASE_URL}/posts/${postId}/reactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ emoji }),
  });
  if (!response.ok) throw new Error("Reaction failed");
  return response.json();
}

// --- HELPER COMPONENT ---
function CleanReport({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="flex flex-col gap-4 text-[color:var(--foreground)]">
      {lines.map((line, i) => {
        if (!line.trim()) return null;
        const imageMatch = line.match(/!\[.*?\]\((.*?)\)/);
        if (imageMatch) {
          return (
            <div key={i} className="my-6 overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)] shadow-sm">
              <img src={imageMatch[1]} alt="Attached visual" className="w-full object-cover" />
            </div>
          );
        }
        const isHeader = line.startsWith("#");
        const isBullet = line.trim().startsWith("-") || line.trim().startsWith("*");
        let content = line.replace(/^[#\-*]+\s*/, "").replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1");
        if (isHeader) return <h3 key={i} className="mt-6 font-heading text-xl font-bold text-[color:var(--foreground)]">{content}</h3>;
        if (isBullet) return <div key={i} className="relative pl-5 text-base leading-relaxed text-[color:var(--muted-foreground)] before:absolute before:left-0 before:top-2.5 before:h-[6px] before:w-[6px] before:rounded-full before:bg-[color:var(--border)]">{content}</div>;
        return <p key={i} className="text-base leading-relaxed text-[color:var(--muted-foreground)]">{content}</p>;
      })}
    </div>
  );
}

// --- AUTH SCREEN ---
function AuthScreen({ onAuthSuccess }: { onAuthSuccess: (session: Session) => void }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email, password, options: { data: { full_name: fullName } }
        });
        if (signUpError) throw signUpError;
        if (data.session) onAuthSuccess(data.session);
        else setError("Please check your email to verify your account.");
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
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card-elevated w-full max-w-md p-8 sm:p-12">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--primary)]/10 text-[color:var(--primary)]">
            <img src="/logo.png" alt="Company Logo" className="h-10 w-10 object-contain" />
          </div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Autolinium</h1>
          <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">Sign in to your execution log.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {isSignUp && (
            <div>
              <label className="mb-1.5 block text-sm font-medium">Full Name</label>
              <div className="relative">
                <UserIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--muted-foreground)]" />
                <input required type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="input-field pl-10" placeholder="John Doe" />
              </div>
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-sm font-medium">Email Address</label>
            <div className="relative">
              <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--muted-foreground)]" />
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field pl-10" placeholder="you@company.com" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Password</label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--muted-foreground)]" />
              <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input-field pl-10" placeholder="••••••••" />
            </div>
          </div>
          {error && <div className="rounded-lg bg-[color:var(--destructive)]/10 p-3 text-sm text-[color:var(--destructive)]">{error}</div>}
          <button type="submit" disabled={isLoading} className="button-primary mt-2 w-full">
            {isLoading ? <Loader2 size={18} className="animate-spin" /> : isSignUp ? "Create Account" : "Sign In"}
          </button>
        </form>
        <div className="mt-8 text-center text-sm text-[color:var(--muted-foreground)]">
          {isSignUp ? "Already have an account? " : "Need an account? "}
          <button onClick={() => { setIsSignUp(!isSignUp); setError(null); }} className="font-semibold text-[color:var(--primary)] hover:underline">
            {isSignUp ? "Sign In" : "Sign Up"}
          </button>
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
  selectedImage: File | null;
  uploadedImageUrl: string | null;
};

export default function Dashboard() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState<"dashboard" | "reports" | "feed" | "profile" | "settings">("dashboard");
  const [reportsViewMode, setReportsViewMode] = useState<"list" | "calendar">("list");
  const [visibleMonth, setVisibleMonth] = useState<Date>(new Date());

  const [selectedReport, setSelectedReport] = useState<ReportRecord | null>(null);
  const [selectedAuthor, setSelectedAuthor] = useState<string | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  
  // Compose Report State
  const [reportDate, setReportDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [updates, setUpdates] = useState<ProjectUpdateState[]>([
    { id: "1", projectName: "", workNotes: "", selectedImage: null, uploadedImageUrl: null }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Compose Post State
  const [postContent, setPostContent] = useState("");
  const [postImage, setPostImage] = useState<File | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  
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
    if (!session) { setIsLoading(false); return; }
    let isCancelled = false;
    async function loadAll() {
      setIsLoading(true);
      try {
        const [repData, postData, profData] = await Promise.all([
          requestReports(session!.access_token),
          requestPosts(session!.access_token),
          requestProfile(session!.access_token)
        ]);
        if (!isCancelled) {
          setReports(repData.map((r, i) => ({ ...r, id: r.id || `temp-${i}`, author_name: r.author_name || "Unknown" })));
          setPosts(postData);
          setProfile(profData);
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
      setActiveTab("reports"); // Redirect away from CEO tab
    }
  }, [session, isCEO, activeTab]);

  function handleMonthChange(direction: "previous" | "next") {
    setVisibleMonth((current) => direction === "previous" ? subMonths(current, 1) : addMonths(current, 1));
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
        updates: finalUpdates.map(u => ({ project_name: u.projectName.trim(), work_notes: u.workNotes.trim(), image_url: u.uploadedImageUrl }))
      };
      await createReport(payload, session.access_token);
      const data = await requestReports(session.access_token);
      setReports(data.map((r, i) => ({ ...r, id: r.id || `temp-${i}`, author_name: r.author_name || "Unknown" })));
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
      await createPost({ content: postContent.trim(), image_url: finalImageUrl }, session.access_token);
      const newPosts = await requestPosts(session.access_token);
      setPosts(newPosts);
      setPostContent("");
      setPostImage(null);
    } catch (err) { console.error(err); } finally { setIsPosting(false); }
  }

  async function handleCommentSubmit(postId: string, content: string) {
    if (!session || !content.trim()) return;
    try {
      await createComment(postId, content.trim(), session.access_token);
      const newPosts = await requestPosts(session.access_token);
      setPosts(newPosts);
    } catch (err) { console.error(err); }
  }

  async function handleReaction(postId: string, emoji: string) {
    if (!session) return;
    try {
      await toggleReaction(postId, emoji, session.access_token);
      const newPosts = await requestPosts(session.access_token);
      setPosts(newPosts);
    } catch (err) { console.error(err); }
  }

  async function handleProfileImageUpload(file: File, type: "avatar" | "cover") {
    if (!session) return;
    setIsUpdatingProfile(true);
    try {
      const uploadRes = await startUpload([file]);
      if (uploadRes && uploadRes.length > 0) {
        const url = uploadRes[0].url;
        const newProf = await updateProfile(type === "avatar" ? { avatar_url: url } : { cover_url: url }, session.access_token);
        setProfile(newProf);
        // Refresh posts to show new avatar instantly
        const newPosts = await requestPosts(session.access_token);
        setPosts(newPosts);
      }
    } catch (err) { console.error(err); } finally { setIsUpdatingProfile(false); }
  }

  async function handleProfileUpdate(e: FormEvent, bio: string, name: string) {
    e.preventDefault();
    if (!session) return;
    setIsUpdatingProfile(true);
    try {
      const newProf = await updateProfile({ bio, full_name: name }, session.access_token);
      setProfile(newProf);
      const newPosts = await requestPosts(session.access_token);
      setPosts(newPosts);
    } catch (err) { console.error(err); } finally { setIsUpdatingProfile(false); }
  }

  if (!mounted) return null;

  if (!session) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return (
        <div className="flex h-screen items-center justify-center bg-[color:var(--background)] p-6 text-center text-[color:var(--foreground)]">
          <div className="card-elevated p-8 max-w-lg">
            <h2 className="font-heading text-2xl font-bold text-[color:var(--destructive)] mb-4">Configuration Error</h2>
            <p className="text-[color:var(--muted-foreground)]">Missing ENV vars. Check .env.local.</p>
          </div>
        </div>
      );
    }
    return <AuthScreen onAuthSuccess={setSession} />;
  }

  const uniqueAuthors = Array.from(new Set(reports.map(r => r.author_name).filter(Boolean)));
  const displayedReports = selectedAuthor ? reports.filter(r => r.author_name === selectedAuthor) : reports;
  const myReports = reports.filter(r => r.author_name === (session.user.user_metadata.full_name || session.user.email));
  const reportsToShow = isCEO ? displayedReports : myReports;

  // Profile Avatar helper
  const userAvatar = profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.full_name || session.user.email || "U")}&background=random`;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[color:var(--background)] text-[color:var(--foreground)]">
      
      {/* SIDEBAR */}
      <aside className="flex w-64 flex-col border-r border-[color:var(--border)] bg-[color:var(--card)] p-4 shadow-sm z-20">
        <div className="mb-8 px-2 pt-2 flex items-center gap-3">
          <img src="/logo.png" alt="Company Logo" className="h-8 w-8 object-contain" />
          <div>
            <h1 className="font-heading text-xl font-bold tracking-tight">Autolinium</h1>
            <p className="text-xs text-[color:var(--muted-foreground)]">Workspace</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-2">
          {isCEO && (
            <button onClick={() => { setActiveTab("dashboard"); setSelectedReport(null); setSelectedAuthor(null); setIsComposing(false); }} className={`sidebar-nav-item ${activeTab === "dashboard" ? "active" : ""}`}>
              <LayoutDashboard size={18} /> CEO Dashboard
            </button>
          )}
          <button onClick={() => { setActiveTab("reports"); setSelectedReport(null); setSelectedAuthor(null); setIsComposing(false); }} className={`sidebar-nav-item ${activeTab === "reports" && !selectedAuthor ? "active" : ""}`}>
            <FileText size={18} /> {isCEO ? "All Briefings" : "My Briefings"}
          </button>
          <button onClick={() => { setActiveTab("feed"); setSelectedReport(null); setIsComposing(false); }} className={`sidebar-nav-item ${activeTab === "feed" ? "active" : ""}`}>
            <Activity size={18} /> Company Feed
          </button>
          <button onClick={() => { setActiveTab("profile"); setSelectedReport(null); setIsComposing(false); }} className={`sidebar-nav-item ${activeTab === "profile" ? "active" : ""}`}>
            <UserIcon size={18} /> My Profile
          </button>
          <button onClick={() => { setActiveTab("settings"); setSelectedReport(null); setIsComposing(false); }} className={`sidebar-nav-item ${activeTab === "settings" ? "active" : ""}`}>
            <Settings size={18} /> Settings
          </button>
        </nav>

        <div className="mt-auto flex flex-col gap-4 border-t border-[color:var(--border)] pt-4">
          <button onClick={() => setActiveTab("profile")} className="flex items-center gap-3 px-2 py-2 text-left hover:bg-[color:var(--muted)] rounded-lg transition-colors">
            <div className="h-8 w-8 overflow-hidden rounded-full bg-[color:var(--muted)] shrink-0 border border-[color:var(--border)]">
              <img src={userAvatar} alt="" className="h-full w-full object-cover" />
            </div>
            <div className="flex flex-col truncate">
              <span className="truncate text-sm font-medium">{profile?.full_name || session.user.email}</span>
              <span className="truncate text-xs text-[color:var(--muted-foreground)]">{session.user.email}</span>
            </div>
          </button>
          
          <div className="flex items-center justify-between rounded-lg border border-[color:var(--border)] bg-[color:var(--input)] p-1">
            <button onClick={() => setTheme("light")} className={`flex flex-1 items-center justify-center rounded-md p-1.5 transition-smooth ${theme === "light" ? "bg-[color:var(--card)] shadow-sm text-[color:var(--foreground)]" : "text-[color:var(--muted-foreground)]"}`}><Sun size={14} /></button>
            <button onClick={() => setTheme("dark")} className={`flex flex-1 items-center justify-center rounded-md p-1.5 transition-smooth ${theme === "dark" ? "bg-[color:var(--card)] shadow-sm text-[color:var(--foreground)]" : "text-[color:var(--muted-foreground)]"}`}><Moon size={14} /></button>
          </div>
          <button onClick={() => supabase.auth.signOut()} className="sidebar-nav-item mt-2 text-[color:var(--destructive)] hover:bg-[color:var(--destructive)]/10 hover:text-[color:var(--destructive)]"><LogOut size={18} /> Sign Out</button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto bg-[color:var(--background)] custom-scrollbar">
        
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-[color:var(--border)] bg-[color:var(--background)]/80 px-8 backdrop-blur-md">
          <h2 className="font-heading text-xl font-semibold capitalize">
            {selectedReport ? "Briefing Details" : isComposing ? "Draft New Briefing" : activeTab === "reports" && selectedAuthor ? `${selectedAuthor}'s Execution Log` : activeTab === "dashboard" ? "Team Members" : activeTab.replace("-", " ")}
          </h2>
          {!isComposing && !selectedReport && activeTab !== "profile" && activeTab !== "feed" && activeTab !== "settings" && (
            <button onClick={() => setIsComposing(true)} className="button-primary fade-in"><Plus size={16} /> New Report</button>
          )}
        </header>

        <div className="container mx-auto max-w-6xl py-8 px-4 sm:px-8">
          <AnimatePresence mode="wait">
            
            {isLoading && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex justify-center p-20">
                <Loader2 size={32} className="animate-spin text-[color:var(--primary)]" />
              </motion.div>
            )}

            {/* FEED VIEW */}
            {!isLoading && activeTab === "feed" && !isComposing && !selectedReport && (
              <motion.div key="feed" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-8 max-w-2xl mx-auto">
                
                {/* Create Post Card */}
                <div className="card-elevated p-6">
                  <div className="flex gap-4">
                    <img src={userAvatar} className="h-10 w-10 rounded-full border border-[color:var(--border)] object-cover shrink-0" alt="" />
                    <form onSubmit={handlePostSubmit} className="flex-1 flex flex-col gap-4">
                      <textarea
                        value={postContent}
                        onChange={(e) => setPostContent(e.target.value)}
                        placeholder="Share a milestone, idea, or update with the team..."
                        className="w-full resize-none bg-transparent outline-none text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)] min-h-[60px]"
                      />
                      
                      {postImage && (
                        <div className="relative rounded-lg overflow-hidden border border-[color:var(--border)] w-fit">
                          <button type="button" onClick={() => setPostImage(null)} className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70"><X size={14}/></button>
                          <img src={URL.createObjectURL(postImage)} className="h-32 object-cover" alt="Preview" />
                        </div>
                      )}

                      <div className="flex items-center justify-between border-t border-[color:var(--border)] pt-4">
                        <label className="cursor-pointer text-[color:var(--muted-foreground)] hover:text-[color:var(--primary)] transition-colors flex items-center gap-2 text-sm font-medium">
                          <Camera size={18} /> Add Media
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => setPostImage(e.target.files?.[0] ?? null)} />
                        </label>
                        <button type="submit" disabled={isPosting || (!postContent.trim() && !postImage)} className="button-primary text-sm py-1.5 px-4">
                          {isPosting ? <Loader2 size={16} className="animate-spin" /> : "Post"}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>

                {/* Posts Feed */}
                <div className="flex flex-col gap-6">
                  {posts.length === 0 ? (
                    <div className="text-center p-12 text-[color:var(--muted-foreground)]">No posts yet. Be the first to share!</div>
                  ) : (
                    posts.map(post => {
                      const postAvatar = post.author_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.author_name || "U")}&background=random`;
                      
                      return (
                        <div key={post.id} className="card-elevated flex flex-col overflow-hidden">
                          {/* Post Header */}
                          <div className="flex items-center gap-3 p-5">
                            <img src={postAvatar} className="h-10 w-10 rounded-full border border-[color:var(--border)] object-cover shrink-0" alt="" />
                            <div className="flex flex-col">
                              <span className="font-semibold text-[color:var(--foreground)]">{post.author_name}</span>
                              <span className="text-xs text-[color:var(--muted-foreground)]">{formatDistanceToNow(parseISO(post.created_at), { addSuffix: true })}</span>
                            </div>
                          </div>
                          
                          {/* Post Content */}
                          <div className="px-5 pb-4 whitespace-pre-wrap text-[color:var(--foreground)] leading-relaxed">
                            {post.content}
                          </div>
                          
                          {/* Post Image */}
                          {post.image_url && (
                            <img src={post.image_url} className="w-full max-h-[500px] object-cover border-y border-[color:var(--border)]" alt="" />
                          )}
                          
                          {/* Post Actions (Reactions) */}
                          <div className="p-3 border-b border-[color:var(--border)] bg-[color:var(--muted)]/20 flex flex-wrap gap-2">
                            {["👍", "🚀", "🎉", "🔥", "👀"].map(emoji => {
                              const count = post.reactions.filter(r => r.emoji === emoji).length;
                              const isReacted = post.reactions.some(r => r.emoji === emoji && r.author_email === session.user.email);
                              if (count === 0 && !isReacted) return null; // Only show active ones, plus a generic add button
                              return (
                                <button 
                                  key={emoji} onClick={() => handleReaction(post.id, emoji)}
                                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm border transition-colors ${isReacted ? "bg-[color:var(--primary)]/10 border-[color:var(--primary)]/30 text-[color:var(--primary)]" : "bg-[color:var(--card)] border-[color:var(--border)] text-[color:var(--foreground)] hover:bg-[color:var(--muted)]"}`}
                                >
                                  <span>{emoji}</span> <span className="font-medium text-xs">{count}</span>
                                </button>
                              )
                            })}
                            
                            {/* Generic add reaction (simplified to just adding a rocket for UI cleanliness, or a menu) */}
                            <button onClick={() => handleReaction(post.id, "🔥")} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm border border-dashed border-[color:var(--border)] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] hover:border-[color:var(--muted-foreground)] transition-colors">
                              <SmilePlus size={14} /> React
                            </button>
                          </div>
                          
                          {/* Comments Section */}
                          <div className="p-5 bg-[color:var(--muted)]/10 flex flex-col gap-4">
                            {post.comments.length > 0 && (
                              <div className="flex flex-col gap-4 mb-2">
                                {post.comments.map(comment => {
                                  const commentAvatar = comment.author_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.author_name || "U")}&background=random`;
                                  return (
                                    <div key={comment.id} className="flex gap-3">
                                      <img src={commentAvatar} className="h-8 w-8 rounded-full border border-[color:var(--border)] object-cover shrink-0" alt="" />
                                      <div className="flex flex-col bg-[color:var(--card)] border border-[color:var(--border)] rounded-2xl rounded-tl-sm px-4 py-2 text-sm text-[color:var(--foreground)] shadow-sm">
                                        <span className="font-semibold text-xs mb-0.5">{comment.author_name}</span>
                                        <span>{comment.content}</span>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                            
                            {/* Add Comment */}
                            <div className="flex gap-3 items-center">
                              <img src={userAvatar} className="h-8 w-8 rounded-full border border-[color:var(--border)] object-cover shrink-0" alt="" />
                              <form 
                                onSubmit={(e) => { e.preventDefault(); const input = e.currentTarget.elements.namedItem('comment') as HTMLInputElement; handleCommentSubmit(post.id, input.value); input.value = ''; }} 
                                className="flex-1 relative"
                              >
                                <input name="comment" type="text" placeholder="Write a comment..." className="w-full bg-[color:var(--card)] border border-[color:var(--border)] rounded-full px-4 py-2 text-sm outline-none focus:border-[color:var(--primary)] transition-colors" />
                              </form>
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
              <motion.div key="profile" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-8 max-w-4xl mx-auto">
                <div className="card-elevated overflow-hidden relative">
                  
                  {/* Cover Photo */}
                  <div className="h-48 md:h-64 w-full bg-[color:var(--muted)] relative group">
                    {profile.cover_url ? (
                      <img src={profile.cover_url} className="w-full h-full object-cover" alt="Cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-r from-blue-500/20 to-purple-500/20" />
                    )}
                    
                    <label className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md text-white p-2 rounded-full cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80">
                      <Camera size={18} />
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => { if(e.target.files?.[0]) handleProfileImageUpload(e.target.files[0], "cover"); }} />
                    </label>
                  </div>

                  {/* Profile Info Area */}
                  <div className="px-6 md:px-10 pb-8 relative">
                    <div className="flex justify-between items-end mb-6">
                      {/* Avatar */}
                      <div className="relative -mt-16 group inline-block">
                        <div className="h-32 w-32 rounded-full border-4 border-[color:var(--card)] bg-[color:var(--card)] overflow-hidden shadow-lg relative">
                          <img src={userAvatar} className="w-full h-full object-cover" alt="Avatar" />
                        </div>
                        <label className="absolute inset-0 flex items-center justify-center bg-black/50 text-white rounded-full cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                          <Camera size={24} />
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => { if(e.target.files?.[0]) handleProfileImageUpload(e.target.files[0], "avatar"); }} />
                        </label>
                      </div>
                      
                      <div className="pb-2">
                         {isUpdatingProfile && <span className="text-sm text-[color:var(--primary)] flex items-center gap-2"><Loader2 size={14} className="animate-spin"/> Updating...</span>}
                      </div>
                    </div>

                    <form onSubmit={(e) => handleProfileUpdate(e, (e.currentTarget.elements.namedItem('bio') as HTMLTextAreaElement).value, (e.currentTarget.elements.namedItem('name') as HTMLInputElement).value)} className="flex flex-col gap-4">
                      <div>
                        <input name="name" defaultValue={profile.full_name} className="font-heading text-3xl font-bold bg-transparent outline-none border-b border-transparent focus:border-[color:var(--primary)] text-[color:var(--foreground)] w-full max-w-sm" />
                        <p className="text-[color:var(--muted-foreground)]">{profile.user_email}</p>
                      </div>
                      
                      <div className="mt-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-[color:var(--muted-foreground)] mb-1 block">Bio / Role</label>
                        <textarea 
                          name="bio"
                          defaultValue={profile.bio || ""}
                          placeholder="What do you do here?"
                          className="w-full max-w-2xl resize-none bg-[color:var(--input)] border border-[color:var(--border)] rounded-lg p-3 text-sm focus:border-[color:var(--primary)] outline-none min-h-[80px]"
                        />
                      </div>
                      <div className="flex justify-end">
                        <button type="submit" disabled={isUpdatingProfile} className="button-secondary text-sm">Save Profile</button>
                      </div>
                    </form>
                  </div>
                </div>

                {/* Profile's Recent Execution Logs */}
                <div>
                  <h3 className="font-heading text-xl font-semibold mb-4">My Execution Logs</h3>
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    {myReports.length === 0 ? <p className="text-[color:var(--muted-foreground)]">No logs yet.</p> : myReports.slice(0,4).map(report => (
                       <button
                        key={report.id}
                        onClick={() => setSelectedReport(report)}
                        className="card-elevated flex cursor-pointer flex-col p-5 text-left hover:border-[color:var(--primary)]/30"
                      >
                        <div className="mb-2 flex justify-between">
                          <span className="text-xs font-semibold uppercase text-[color:var(--primary)]">{format(parseISO(report.report_date), "MMM d, yyyy")}</span>
                        </div>
                        <h3 className="line-clamp-2 font-heading text-lg font-semibold">{report.formatted_report.split("\n")[0].replace(/[*#\-]/g, "")}</h3>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* CEO DASHBOARD (TEAM) */}
            {!isLoading && !isComposing && !selectedReport && activeTab === "dashboard" && (
              // existing dashboard map...
              <motion.div key="dashboard" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-6 fade-in">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {uniqueAuthors.map(author => {
                    const authorReports = reports.filter(r => r.author_name === author);
                    return (
                      <button
                        key={author}
                        onClick={() => { setSelectedAuthor(author); setActiveTab("reports"); setReportsViewMode("list"); }}
                        className="card-elevated flex cursor-pointer flex-col items-center justify-center p-8 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                      >
                        <div className="mb-4 overflow-hidden rounded-full border-4 border-[color:var(--background)] shadow-sm">
                          <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(author)}&background=random&size=128`} alt={author} className="h-20 w-20" />
                        </div>
                        <h4 className="font-heading text-lg font-semibold">{author}</h4>
                        <p className="mt-1 text-sm font-medium text-[color:var(--muted-foreground)]">{authorReports.length} Updates</p>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* REPORTS TIMELINE VIEW */}
            {!isLoading && !isComposing && !selectedReport && activeTab === "reports" && (
               <motion.div key="list" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-6 fade-in">
                {selectedAuthor && (
                  <div className="mb-2 flex items-center justify-between">
                    <button onClick={() => setActiveTab("dashboard")} className="button-secondary text-sm"><ArrowLeft size={16} /> Back to Team</button>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <h3 className="font-heading text-2xl font-semibold">{selectedAuthor ? `${selectedAuthor}'s Updates` : isCEO ? "All Briefings" : "My Briefings"}</h3>
                  <div className="flex rounded-lg border border-[color:var(--border)] bg-[color:var(--input)] p-1">
                    <button onClick={() => setReportsViewMode("list")} className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-smooth ${reportsViewMode === "list" ? "bg-[color:var(--card)] shadow-sm text-[color:var(--foreground)]" : "text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"}`}><LayoutList size={14} /> List</button>
                    <button onClick={() => setReportsViewMode("calendar")} className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-smooth ${reportsViewMode === "calendar" ? "bg-[color:var(--card)] shadow-sm text-[color:var(--foreground)]" : "text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"}`}><CalendarDays size={14} /> Calendar</button>
                  </div>
                </div>

                {reportsViewMode === "list" ? (
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                    {reportsToShow.map((report) => (
                      <button
                        key={report.id}
                        onClick={() => setSelectedReport(report)}
                        className="card-elevated flex cursor-pointer flex-col p-6 text-left hover:shadow-md hover:border-[color:var(--primary)]/30"
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase tracking-wider text-[color:var(--primary)]">{format(parseISO(report.report_date), "MMM d, yyyy")}</span>
                          {report.image_url && <ImageIcon size={16} className="text-[color:var(--muted-foreground)]" />}
                        </div>
                        <h3 className="mb-3 line-clamp-2 font-heading text-lg font-semibold leading-tight">{report.formatted_report.split("\n")[0].replace(/[*#\-]/g, "")}</h3>
                        {!selectedAuthor && isCEO && (
                          <div className="mb-3 flex items-center gap-2 text-xs font-medium text-[color:var(--muted-foreground)]">
                            <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(report.author_name)}&background=random&size=32`} alt="" className="h-5 w-5 rounded-full" />
                            {report.author_name}
                          </div>
                        )}
                        <p className="mt-auto line-clamp-3 text-sm text-[color:var(--muted-foreground)]">{JSON.parse(report.raw_text || "[]")[0]?.work_notes || report.raw_text}</p>
                      </button>
                    ))}
                  </div>
                ) : (
                  // Calendar View (abbreviated for brevity here, assumed functioning identically to before just mapped over reportsToShow)
                  <div className="card-elevated p-6 md:p-8">
                     <div className="mb-8 flex items-center justify-between">
                      <h2 className="font-heading text-2xl font-semibold text-[color:var(--foreground)]">{format(visibleMonth, "MMMM yyyy")}</h2>
                      <div className="flex gap-2">
                        <button onClick={() => handleMonthChange("previous")} className="flex h-10 w-10 items-center justify-center rounded-full text-[color:var(--muted-foreground)] hover:bg-[color:var(--muted)] hover:text-[color:var(--foreground)] transition-colors"><ChevronLeft size={20} /></button>
                        <button onClick={() => handleMonthChange("next")} className="flex h-10 w-10 items-center justify-center rounded-full text-[color:var(--muted-foreground)] hover:bg-[color:var(--muted)] hover:text-[color:var(--foreground)] transition-colors"><ChevronRight size={20} /></button>
                      </div>
                    </div>
                    {/* Grid rendering skipped in this block replacement for length, but preserved logically */}
                     <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs font-semibold uppercase tracking-wider text-[color:var(--muted-foreground)]">
                      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((dayName) => <div key={dayName} className="py-2">{dayName}</div>)}
                    </div>
                    <div className="grid grid-cols-7 gap-2 md:gap-3">
                      {eachDayOfInterval({ start: startOfWeek(startOfMonth(visibleMonth), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(visibleMonth), { weekStartsOn: 1 }) }).map((day) => {
                        const dayReports = reportsToShow.filter((r) => isSameDay(parseISO(r.report_date), day));
                        return (
                           <div key={day.toISOString()} className={`flex min-h-[100px] flex-col p-2 rounded-xl border ${!isSameMonth(day, visibleMonth) ? "opacity-30 border-transparent" : dayReports.length > 0 ? "border-[color:var(--border)] bg-[color:var(--muted)]/30" : "border-[color:var(--border)]"}`}>
                             <span className={`text-sm font-semibold ${dayReports.length > 0 ? "text-[color:var(--foreground)]" : "text-[color:var(--muted-foreground)]"}`}>{format(day, "d")}</span>
                             {dayReports.map((r, idx) => (
                               <button key={idx} onClick={() => setSelectedReport(r)} className="mt-1 w-full truncate rounded bg-[color:var(--card)] px-1.5 py-0.5 text-left text-[10px] font-medium shadow-sm hover:ring-1 hover:ring-[color:var(--primary)]">{selectedAuthor ? r.formatted_report.substring(0,10) : r.author_name}</button>
                             ))}
                           </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* COMPOSE VIEW */}
             {!isLoading && isComposing && (
               // Kept exact compose view code from previous working version
               <motion.div key="compose" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="card-elevated mx-auto max-w-3xl p-8">
                <div className="mb-8 flex items-center justify-between border-b border-[color:var(--border)] pb-6">
                  <h3 className="font-heading text-2xl font-semibold">Log Execution Details</h3>
                  <button onClick={() => setIsComposing(false)} className="text-[color:var(--muted-foreground)] transition-colors hover:text-[color:var(--foreground)]"><X size={20} /></button>
                </div>
                <form onSubmit={handleReportSubmit} className="flex flex-col gap-8">
                  <div>
                    <label className="mb-2 block text-sm font-medium">Report Date</label>
                    <input required type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} className="input-field max-w-xs" />
                  </div>
                  <div className="flex flex-col gap-6">
                    <h4 className="font-heading text-lg font-semibold border-b border-[color:var(--border)] pb-2">Project Updates</h4>
                    {updates.map((update, idx) => (
                      <div key={update.id} className="relative rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] p-6 shadow-sm">
                        {updates.length > 1 && (
                          <button type="button" onClick={() => setUpdates(prev => prev.filter(u => u.id !== update.id))} className="absolute right-4 top-4 text-[color:var(--muted-foreground)] hover:text-[color:var(--destructive)]"><X size={16} /></button>
                        )}
                        <div className="mb-4">
                          <label className="mb-2 block text-sm font-medium">Project Name / Client</label>
                          <input required type="text" value={update.projectName} onChange={(e) => { const newU = [...updates]; newU[idx].projectName = e.target.value; setUpdates(newU); }} className="input-field" />
                        </div>
                        <div className="mb-4">
                          <label className="mb-2 block text-sm font-medium">Work Notes</label>
                          <textarea required minLength={5} value={update.workNotes} onChange={(e) => { const newU = [...updates]; newU[idx].workNotes = e.target.value; setUpdates(newU); }} className="input-field min-h-[100px] resize-y" />
                        </div>
                        <div>
                          <label className="mb-2 block text-sm font-medium">Proof of Work (Optional Image)</label>
                          <label className="input-field flex cursor-pointer items-center justify-between hover:bg-[color:var(--muted)]">
                            <span className="truncate">{update.selectedImage ? update.selectedImage.name : "Attach screenshot..."}</span>
                            <ImageIcon size={18} className="text-[color:var(--muted-foreground)]" />
                            <input type="file" accept="image/*" onChange={(e) => { const newU = [...updates]; newU[idx].selectedImage = e.target.files?.[0] ?? null; setUpdates(newU); }} className="hidden" />
                          </label>
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={() => setUpdates(prev => [...prev, { id: Math.random().toString(), projectName: "", workNotes: "", selectedImage: null, uploadedImageUrl: null }])} className="flex items-center gap-2 text-sm font-medium text-[color:var(--primary)] self-start"><Plus size={16} /> Add Another Project</button>
                  </div>
                  <div className="mt-4 flex justify-end gap-3 border-t border-[color:var(--border)] pt-6">
                    <button type="button" onClick={() => setIsComposing(false)} className="button-secondary">Cancel</button>
                    <button type="submit" disabled={isSubmitting || updates.some(u => !u.projectName || !u.workNotes)} className="button-primary">
                      {isSubmitting ? <><Loader2 size={16} className="animate-spin" /> Processing...</> : "Submit Briefing"}
                    </button>
                  </div>
                </form>
              </motion.div>
             )}

            {/* REPORT DETAIL VIEW */}
            {!isLoading && selectedReport && !isComposing && (
              <motion.div key="detail" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="mx-auto flex max-w-4xl flex-col gap-6">
                <button onClick={() => setSelectedReport(null)} className="button-secondary w-fit"><ArrowLeft size={16} /> Back</button>
                <div className="card-elevated p-8 md:p-12">
                  <div className="mb-10 border-b border-[color:var(--border)] pb-8">
                    <h1 className="font-heading text-3xl font-bold tracking-tight md:text-4xl">Executive Briefing</h1>
                    <span className="text-sm uppercase tracking-wider text-[color:var(--primary)]">{format(parseISO(selectedReport.report_date), "EEEE, MMMM do, yyyy")}</span>
                  </div>
                  <div className="mb-12"><CleanReport text={selectedReport.formatted_report} /></div>
                  <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]/50 p-6">
                    <h4 className="mb-4 flex items-center gap-2 font-heading text-sm font-semibold border-b border-[color:var(--border)] pb-3"><FileText size={16} /> Raw Notes</h4>
                    <div className="space-y-6">
                      {(() => {
                        try {
                          const parsed = JSON.parse(selectedReport.raw_text);
                          return parsed.map((p: any, i: number) => (
                            <div key={i} className="flex flex-col gap-2">
                              <span className="text-sm font-semibold">{p.project_name}</span>
                              <span className="whitespace-pre-wrap text-sm text-[color:var(--muted-foreground)]">{p.work_notes}</span>
                            </div>
                          ));
                        } catch { return <span className="whitespace-pre-wrap text-sm text-[color:var(--muted-foreground)]">{selectedReport.raw_text}</span>; }
                      })()}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* SETTINGS VIEW */}
            {!isLoading && activeTab === "settings" && !isComposing && !selectedReport && (
               <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card-elevated max-w-2xl p-8">
                <h3 className="mb-6 font-heading text-2xl font-semibold">System Configuration</h3>
                <div className="space-y-6">
                  <div className="rounded-lg border border-[color:var(--border)] p-4">
                    <h4 className="font-medium">Account</h4>
                    <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">Logged in as {session.user.email}</p>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
