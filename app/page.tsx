// Autolinium Dashboard - Stable Production Version
"use client";

import { format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, formatDistanceToNow } from "date-fns";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import { createClient, Session } from "@supabase/supabase-js";
import Swal from "sweetalert2";
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
  Command,
  Sparkles,
  Bell,
  Heart,
  Rocket,
  Flame,
  PartyPopper,
  Eye,
  CheckCircle2,
  MoreHorizontal,
  Trash2,
  AtSign,
  Trophy,
  BookMarked,
  Copy
} from "lucide-react";
import { useUploadThing } from "../utils/uploadthing";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function normalizeCompletionPercent(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim().replace("%", "");
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(100, Math.max(0, Math.round(parsed)));
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

type SubmitReportResponse = {
  message: string;
  provider: string;
  report: ReportRecord;
};

type OptimizeTone = "executive" | "concise" | "impact";

type OptimizeUpdatesResponse = {
  message: string;
  provider: string;
  preview: string;
  updates: Array<{
    project_name: string;
    work_notes: string;
    next_steps?: string | null;
    blockers?: string | null;
    image_url?: string | null;
    completion_percent?: number | null;
  }>;
};

type ReportUpdateEntry = {
  project_name: string;
  work_notes: string;
  next_steps?: string | null;
  blockers?: string | null;
  image_url?: string | null;
  completion_percent?: number | null;
};

type NotificationItem = {
  id: string;
  type: string;
  created_at: string;
  actor_email?: string | null;
  actor_name?: string | null;
  actor_avatar?: string | null;
  post_id?: string | null;
  comment_id?: string | null;
  title: string;
  body: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/backend";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const CEO_EMAIL = process.env.NEXT_PUBLIC_CEO_EMAIL?.toLowerCase() ?? "";
const CEO_EMAILS = new Set(
  [
    ...(process.env.NEXT_PUBLIC_CEO_EMAILS ?? "").split(","),
    CEO_EMAIL,
  ]
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
);

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const EMOJI_OPTIONS = [
  { char: "👍", label: "Thumbs Up" },
  { char: "🚀", label: "Rocket" },
  { char: "🔥", label: "Fire" },
  { char: "🎉", label: "Party" },
  { char: "👀", label: "Eyes" },
];

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const TARGET_UPLOAD_BYTES = Math.floor(3.8 * 1024 * 1024);
const MAX_IMAGE_DIMENSION = 2400;
const SUPPORTED_UPLOAD_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);
const FEED_DRAFT_KEY_PREFIX = "autolinium:feed-draft:";
const FEED_PLAYBOOK_KEY_PREFIX = "autolinium:feed-playbooks:";
const NOTIFICATIONS_SEEN_KEY_PREFIX = "autolinium:notifications-seen:";
const WIN_SIGNAL_KEYWORDS = [
  "delivered",
  "launched",
  "automated",
  "improved",
  "reduced",
  "saved",
  "shipped",
  "deployed",
  "optimized",
  "closed",
];
const PLAYBOOK_SIGNAL_KEYWORDS = [
  "playbook",
  "template",
  "automation flow",
  "workflow",
  "recipe",
  "steps",
  "trigger",
  "stack",
];
const FEED_TEMPLATE_SNIPPETS = [
  {
    id: "daily-win",
    label: "Daily Win",
    text: "Daily win:\n- What we automated\n- Result we unlocked\n- Next momentum move",
  },
  {
    id: "client-shoutout",
    label: "Client Signal",
    text: "Client signal:\n- Context\n- Action taken\n- Business impact",
  },
  {
    id: "idea-drop",
    label: "Idea Drop",
    text: "Idea drop:\nWhat if we automate the handoff between _ and _ so no task stalls in between?",
  },
  {
    id: "playbook-snippet",
    label: "Playbook Snippet",
    text: "Playbook:\nTrigger:\nTools Stack:\nFlow:\nOutcome:",
  },
];

function bytesToMb(bytes: number) {
  return (bytes / (1024 * 1024)).toFixed(2);
}

function toJpegFileName(fileName: string) {
  const dotIndex = fileName.lastIndexOf(".");
  const base = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;
  return `${base}.jpg`;
}

function loadImageElement(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Unable to read selected image."));
    };
    image.src = objectUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Image processing failed."));
        return;
      }
      resolve(blob);
    }, "image/jpeg", quality);
  });
}

async function compressImageToLimit(file: File, maxBytes: number) {
  if (file.size <= maxBytes && SUPPORTED_UPLOAD_MIME_TYPES.has(file.type.toLowerCase())) return file;
  if (!file.type.startsWith("image/")) throw new Error("Only image files are supported.");

  const image = await loadImageElement(file);
  const scaleForMaxDimension = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(image.width, image.height));
  let scale = scaleForMaxDimension;
  let smallestBlob: Blob | null = null;
  const qualitySteps = [0.9, 0.82, 0.74, 0.66, 0.58, 0.5, 0.42, 0.35];

  for (let scalePass = 0; scalePass < 6; scalePass++) {
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image canvas context unavailable.");
    context.drawImage(image, 0, 0, width, height);

    for (const quality of qualitySteps) {
      const blob = await canvasToBlob(canvas, quality);
      if (!smallestBlob || blob.size < smallestBlob.size) smallestBlob = blob;
      if (blob.size <= maxBytes) {
        return new File([blob], toJpegFileName(file.name), {
          type: "image/jpeg",
          lastModified: Date.now(),
        });
      }
    }

    scale *= 0.85;
  }

  if (!smallestBlob) throw new Error("Unable to compress this image.");

  return new File([smallestBlob], toJpegFileName(file.name), {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

type UploadResultItem = {
  url?: string | null;
  ufsUrl?: string | null;
};

// --- API FETCHERS ---
let authRecoveryInProgress = false;

async function fetchWithAuth(url: string, options: RequestInit = {}, token?: string) {
  const execute = (accessToken: string) =>
    fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${accessToken}`,
      },
    });

  const fallbackSession = await supabase.auth.getSession();
  let accessToken = token || fallbackSession.data.session?.access_token || "";
  if (!accessToken) {
    if (!authRecoveryInProgress) {
      authRecoveryInProgress = true;
      await supabase.auth.signOut();
      authRecoveryInProgress = false;
    }
    throw new Error("Request failed: 401");
  }

  let response = await execute(accessToken);

  if (response.status === 401) {
    const errorBody = (await response.text()).toLowerCase();
    const needsRecovery =
      errorBody.includes("session") ||
      errorBody.includes("jwt") ||
      errorBody.includes("token");

    if (needsRecovery) {
      try {
        const refreshed = await supabase.auth.refreshSession();
        const refreshedToken = refreshed.data.session?.access_token || "";
        if (refreshedToken) {
          accessToken = refreshedToken;
          response = await execute(accessToken);
        }
      } catch (err) {
        console.error(err);
      }
    }

    if (response.status === 401) {
      if (!authRecoveryInProgress) {
        authRecoveryInProgress = true;
        await supabase.auth.signOut();
        authRecoveryInProgress = false;
      }
      throw new Error("Request failed: 401");
    }
  }

  if (response.status === 204) return null;
  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`API Error ${response.status}:`, errorBody);
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}

// --- UI COMPONENTS ---

function LoadingSpinner({
  className = "h-6 w-6",
  tone = "primary"
}: {
  className?: string;
  tone?: "primary" | "light" | "danger";
}) {
  const ringClass =
    tone === "light"
      ? "border-white/25"
      : tone === "danger"
        ? "border-destructive/25"
        : "border-primary/25";
  const glowClass =
    tone === "light"
      ? "bg-white"
      : tone === "danger"
        ? "bg-destructive"
        : "bg-primary";
  return (
    <div className={cn("relative", className)}>
      <motion.div
        animate={{ rotate: -360 }}
        transition={{ repeat: Infinity, duration: 1.35, ease: "linear" }}
        className={cn("absolute inset-0 rounded-full border border-dashed", ringClass)}
      />
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 0.92, ease: "linear" }}
        className={cn("h-full w-full rounded-full border-2 border-transparent border-t-current border-r-current", tone === "light" ? "text-white" : tone === "danger" ? "text-destructive" : "text-primary")}
      />
      <motion.div
        animate={{ opacity: [0.45, 1, 0.45], scale: [0.86, 1, 0.86] }}
        transition={{ repeat: Infinity, duration: 1.1, ease: "easeInOut" }}
        className={cn("absolute left-1/2 top-1/2 h-[28%] w-[28%] -translate-x-1/2 -translate-y-1/2 rounded-full", glowClass)}
      />
    </div>
  );
}

function LoadingRail({ label }: { label: string }) {
  return (
    <div className="w-[220px] rounded-2xl border border-primary/20 bg-primary/10 px-3 py-2.5 backdrop-blur-xl dark:border-primary/35 dark:bg-[#123154]">
      <div className="mb-2 flex items-center gap-2">
        <LoadingSpinner className="h-3.5 w-3.5" />
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">{label}</span>
      </div>
      <div className="relative h-1.5 overflow-hidden rounded-full bg-primary/20 dark:bg-primary/30">
        <motion.div
          className="absolute inset-y-0 w-2/5 rounded-full bg-gradient-to-r from-primary/20 via-primary to-primary/30"
          animate={{ x: ["-115%", "265%"] }}
          transition={{ repeat: Infinity, duration: 1.3, ease: "easeInOut" }}
        />
      </div>
    </div>
  );
}

function CleanReport({ text, onViewImage }: { text: string, onViewImage: (url: string) => void }) {
  const lines = text.split("\n");
  return (
    <div className="flex flex-col gap-2 font-mono text-[13px] leading-relaxed text-[#2d2a25] dark:text-[#d6e3fb]">
      {lines.map((line, i) => {
        if (!line.trim()) return null;

        const imageMatch = line.match(/!\[.*?\]\((.*?)\)/);
        if (imageMatch) {
          return (
            <div key={i} className="pt-2">
              <button 
                onClick={() => onViewImage(imageMatch[1])}
                className="inline-flex items-center gap-2 border border-[#ceb994] bg-[#efe5ce] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#2d2a25] transition-colors hover:border-primary/40 hover:text-primary dark:border-[#3d5f8e] dark:bg-[#173056] dark:text-[#dce8ff] dark:hover:border-[#77a9ff]"
              >
                <ImageIcon size={12} />
                Attachment
              </button>
            </div>
          );
        }

        const isHeader = line.startsWith("#") || line.match(/^##?\s/) || line.match(/^\d\.\s/);
        const isSubHeader = line.match(/^\s*-\s\w+:/);
        const isBullet = line.trim().startsWith("-") || line.trim().startsWith("*");

        const content = line.replace(/^[#\-*]+\s*/, "").replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1");

        if (isHeader) {
          return (
            <h3 key={i} className="mt-2 border-b border-[#ccb998] pb-1.5 text-sm font-bold uppercase tracking-[0.08em] text-[#3e5f96] dark:border-[#3b5a87] dark:text-[#9fc5ff]">
              {content}
            </h3>
          );
        }

        if (isSubHeader) {
          const [label, ...rest] = content.split(":");
          const value = rest.join(":").trim();
          return (
            <div key={i} className="grid grid-cols-[120px_1fr] gap-2 border-b border-dotted border-[#d0c0a4] py-1 dark:border-[#35507a]">
              <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#3e5f96] dark:text-[#9fc5ff]">{label.trim()}</span>
              <span className="text-[13px]">{value}</span>
            </div>
          );
        }

        if (isBullet) {
          return <p key={i} className="pl-2 text-[13px] text-[#2d2a25] dark:text-[#d6e3fb]">- {content}</p>;
        }

        return <p key={i} className="text-[13px] text-[#2d2a25] dark:text-[#d6e3fb]">{content}</p>;
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
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden p-4 text-[color:var(--foreground)]">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/login-bg.png')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-[#081429]/78 via-[#0e2443]/66 to-[#10284f]/58" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.16),transparent_40%)]" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="card-elevated relative z-10 w-full max-w-md border-white/20 bg-[color:var(--card)]/92 p-8 shadow-2xl backdrop-blur-md sm:p-12"
      >
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
            {isLoading ? <LoadingSpinner className="h-5 w-5" tone="light" /> : isResetMode ? "Send Recovery Link" : isSignUp ? "Create Account" : "Sign In"}
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
  completionPercent: string;
  selectedImage: File | null;
  uploadedImageUrl: string | null;
};

type CommandPaletteAction = {
  id: string;
  title: string;
  subtitle: string;
  keywords: string;
  run: () => void | Promise<void>;
};

type ReactionBurst = {
  id: string;
  anchor: string;
  emoji: string;
  x: number;
  y: number;
  size: number;
};

function createEmptyUpdate(): ProjectUpdateState {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    projectName: "",
    workNotes: "",
    nextSteps: "",
    blockers: "",
    completionPercent: "",
    selectedImage: null,
    uploadedImageUrl: null
  };
}

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
  const [selectedAuthorEmail, setSelectedAuthorEmail] = useState<string | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [viewingPost, setViewingPost] = useState<PostRecord | null>(null);
  const [viewingProfile, setViewingProfile] = useState<ProfileRecord | null>(null);
  
  // Compose Report State
  const [reportDate, setReportDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [updates, setUpdates] = useState<ProjectUpdateState[]>(() => [createEmptyUpdate()]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copilotTone, setCopilotTone] = useState<OptimizeTone>("executive");
  const [isOptimizingUpdates, setIsOptimizingUpdates] = useState(false);
  const [copilotPreview, setCopilotPreview] = useState<string>("");

  // Compose Post State
  const [postContent, setPostContent] = useState("");
  const [postImage, setPostImage] = useState<File | null>(null);
  const [hasLoadedFeedDraft, setHasLoadedFeedDraft] = useState(false);
  const [savedPlaybookPostIds, setSavedPlaybookPostIds] = useState<string[]>([]);
  const [feedLens, setFeedLens] = useState<"all" | "wins" | "playbooks">("all");
  const [reactionBursts, setReactionBursts] = useState<ReactionBurst[]>([]);
  const [isPosting, setIsPosting] = useState(false);
  const [commentingPostId, setCommentingPostId] = useState<string | null>(null);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [mentionSearch, setMentionSearch] = useState<string | null>(null);
  
  // Profile State
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [commandFocusedIndex, setCommandFocusedIndex] = useState(0);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [notificationsLastSeenAt, setNotificationsLastSeenAt] = useState<number>(0);
  const [focusedPostId, setFocusedPostId] = useState<string | null>(null);
  const profileViewerOpenGuardRef = useRef(0);

  const { startUpload } = useUploadThing("imageUploader");

  const toast = Swal.mixin({
    toast: true,
    position: "top-end",
    showConfirmButton: false,
    timer: 2400,
    timerProgressBar: true
  });

  function notify(icon: "success" | "error" | "warning" | "info" | "question", title: string) {
    const themeByIcon: Record<typeof icon, { background: string; iconColor: string; textColor: string }> = {
      success: {
        background: "linear-gradient(135deg, rgba(29,185,84,0.2), rgba(29,185,84,0.12))",
        iconColor: "#1DB954",
        textColor: "var(--foreground)",
      },
      warning: {
        background: "linear-gradient(135deg, rgba(245,158,11,0.22), rgba(245,158,11,0.12))",
        iconColor: "#f59e0b",
        textColor: "var(--foreground)",
      },
      error: {
        background: "linear-gradient(135deg, rgba(239,68,68,0.2), rgba(239,68,68,0.12))",
        iconColor: "#ef4444",
        textColor: "var(--foreground)",
      },
      info: {
        background: "linear-gradient(135deg, rgba(59,130,246,0.2), rgba(59,130,246,0.12))",
        iconColor: "#3b82f6",
        textColor: "var(--foreground)",
      },
      question: {
        background: "linear-gradient(135deg, rgba(56,189,248,0.18), rgba(56,189,248,0.1))",
        iconColor: "#38bdf8",
        textColor: "var(--foreground)",
      },
    };
    const themed = themeByIcon[icon];
    void toast.fire({
      icon,
      title,
      background: themed.background,
      iconColor: themed.iconColor,
      color: themed.textColor
    });
  }

  function getErrorMessage(err: unknown, fallback: string) {
    if (err instanceof Error && err.message) {
      const msg = err.message;
      if (msg.includes("400")) {
        return "Upload rejected. Please use JPG/PNG/WebP under 4MB.";
      }
      return msg;
    }
    return fallback;
  }

  function getUploadUrl(uploadRes: UploadResultItem[] | undefined | null) {
    if (!uploadRes || uploadRes.length === 0) return null;
    return uploadRes[0].ufsUrl || uploadRes[0].url || null;
  }

  async function prepareImageForUpload(file: File, label: string) {
    if (!file.type.startsWith("image/")) {
      throw new Error(`${label}: only image files are allowed.`);
    }

    const mimeType = file.type.toLowerCase();
    const isSupportedMime = SUPPORTED_UPLOAD_MIME_TYPES.has(mimeType);

    if (!isSupportedMime) {
      notify("info", `${label}: converting ${mimeType || "image"} to JPG for compatibility...`);
      const converted = await compressImageToLimit(file, TARGET_UPLOAD_BYTES);
      if (converted.size > MAX_UPLOAD_BYTES) {
        throw new Error(`${label}: converted file is still above 4MB. Please use a smaller image.`);
      }
      return converted;
    }

    if (file.size <= MAX_UPLOAD_BYTES) return file;

    notify("warning", `${label}: file is ${bytesToMb(file.size)}MB. Optimizing to fit 4MB limit...`);
    let compressed: File;
    try {
      compressed = await compressImageToLimit(file, TARGET_UPLOAD_BYTES);
    } catch {
      throw new Error(`${label}: compression failed. Please try JPG, PNG, or WebP under 4MB.`);
    }

    if (compressed.size > MAX_UPLOAD_BYTES) {
      throw new Error(
        `${label}: file is ${bytesToMb(compressed.size)}MB after compression, still above 4MB limit.`
      );
    }

    if (compressed.size < file.size) {
      notify("success", `${label}: compressed from ${bytesToMb(file.size)}MB to ${bytesToMb(compressed.size)}MB.`);
    } else {
      notify("warning", `${label}: could not reduce size significantly.`);
    }

    return compressed;
  }

  function notifyLargeImageSelection(file: File, label: string) {
    if (!file.type.startsWith("image/")) {
      notify("error", `${label}: only image files are allowed.`);
      return;
    }

    if (!SUPPORTED_UPLOAD_MIME_TYPES.has(file.type.toLowerCase())) {
      notify("info", `${label}: this format will be converted to JPG on upload.`);
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      notify("warning", `${label}: selected ${bytesToMb(file.size)}MB. It will be auto-compressed on upload.`);
      return;
    }

    if (file.size > TARGET_UPLOAD_BYTES) {
      notify("info", `${label}: ${bytesToMb(file.size)}MB selected. Near 4MB limit.`);
    }
  }

  function parseReportUpdates(rawText: string): ReportUpdateEntry[] {
    try {
      const parsed = JSON.parse(rawText);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((item) => item && typeof item === "object")
        .map((item) => ({
          project_name: typeof item.project_name === "string" ? item.project_name : "Untitled Project",
          work_notes: typeof item.work_notes === "string" ? item.work_notes : "",
          next_steps: typeof item.next_steps === "string" && item.next_steps.trim() ? item.next_steps : null,
          blockers: typeof item.blockers === "string" && item.blockers.trim() ? item.blockers : null,
          image_url: typeof item.image_url === "string" && item.image_url.trim() ? item.image_url : null,
          completion_percent: normalizeCompletionPercent(item.completion_percent),
        }));
    } catch {
      return [];
    }
  }

  function getReportMetrics(updatesList: ReportUpdateEntry[]) {
    const totalProjects = updatesList.length;
    const completionValues = updatesList
      .map((update) => normalizeCompletionPercent(update.completion_percent))
      .filter((value): value is number => value !== null);
    const averageCompletion = completionValues.length
      ? Math.round(completionValues.reduce((acc, value) => acc + value, 0) / completionValues.length)
      : null;
    const blockersCount = updatesList.filter((update) => Boolean(update.blockers)).length;
    const readyNextSteps = updatesList.filter((update) => Boolean(update.next_steps)).length;
    return { totalProjects, averageCompletion, blockersCount, readyNextSteps };
  }

  function getFeedDraftStorageKey() {
    const email = session?.user?.email?.toLowerCase();
    if (!email) return null;
    return `${FEED_DRAFT_KEY_PREFIX}${email}`;
  }

  function getPlaybookStorageKey() {
    const email = session?.user?.email?.toLowerCase();
    if (!email) return null;
    return `${FEED_PLAYBOOK_KEY_PREFIX}${email}`;
  }

  function getNotificationsSeenStorageKey() {
    const email = session?.user?.email?.toLowerCase();
    if (!email) return null;
    return `${NOTIFICATIONS_SEEN_KEY_PREFIX}${email}`;
  }

  function markNotificationsAsSeen() {
    const now = Date.now();
    setNotificationsLastSeenAt(now);
    const key = getNotificationsSeenStorageKey();
    if (!key) return;
    try {
      localStorage.setItem(key, String(now));
    } catch (err) {
      console.error(err);
    }
  }

  function applyFeedTemplate(templateText: string) {
    setPostContent((prev) => {
      const cleanPrev = prev.trim();
      if (!cleanPrev) return templateText;
      return `${cleanPrev}\n\n${templateText}`;
    });
  }

  function postHasWinSignal(post: PostRecord) {
    const content = post.content.toLowerCase();
    return WIN_SIGNAL_KEYWORDS.some((keyword) => content.includes(keyword));
  }

  function postHasPlaybookSignal(post: PostRecord) {
    const content = post.content.toLowerCase();
    return PLAYBOOK_SIGNAL_KEYWORDS.some((keyword) => content.includes(keyword));
  }

  function scorePostImpact(post: PostRecord) {
    const reactionWeight = post.reactions.length * 3;
    const commentWeight = post.comments.length * 2;
    const freshnessHours = Math.max(
      1,
      (Date.now() - new Date(post.created_at).getTime()) / (1000 * 60 * 60)
    );
    const freshnessWeight = Math.max(0, 28 - Math.round(freshnessHours / 6));
    const winBonus = postHasWinSignal(post) ? 6 : 0;
    return reactionWeight + commentWeight + freshnessWeight + winBonus;
  }

  function toggleSavedPlaybook(postId: string) {
    setSavedPlaybookPostIds((prev) =>
      prev.includes(postId) ? prev.filter((id) => id !== postId) : [postId, ...prev]
    );
  }

  async function copyPlaybook(post: PostRecord) {
    const text = post.content.trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      notify("success", "Playbook snippet copied.");
    } catch (err) {
      console.error(err);
      notify("warning", "Unable to copy on this browser.");
    }
  }

  function triggerReactionBurst(anchor: string, emoji: string) {
    const spawned = Array.from({ length: 6 }).map((_, idx) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${idx}`,
      anchor,
      emoji,
      x: Math.round((Math.random() - 0.5) * 90),
      y: -Math.round(30 + Math.random() * 70),
      size: 14 + Math.round(Math.random() * 8),
    }));
    setReactionBursts((prev) => [...prev, ...spawned]);
    window.setTimeout(() => {
      const spawnedIds = new Set(spawned.map((item) => item.id));
      setReactionBursts((prev) => prev.filter((item) => !spawnedIds.has(item.id)));
    }, 900);
  }

  function renderReactionBursts(anchor: string) {
    const items = reactionBursts.filter((burst) => burst.anchor === anchor);
    if (items.length === 0) return null;
    return (
      <div className="pointer-events-none absolute left-1/2 top-0 z-30 h-0 w-0">
        {items.map((burst) => (
          <motion.span
            key={burst.id}
            initial={{ opacity: 0, x: 0, y: 8, scale: 0.65 }}
            animate={{ opacity: [0, 1, 1, 0], x: burst.x, y: burst.y, scale: [0.65, 1.05, 0.88] }}
            transition={{ duration: 0.86, ease: "easeOut" }}
            className="absolute select-none drop-shadow"
            style={{ fontSize: `${burst.size}px` }}
          >
            {burst.emoji}
          </motion.span>
        ))}
      </div>
    );
  }

  async function confirmAction(title: string, text: string) {
    const result = await Swal.fire({
      title,
      text,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Confirm",
      cancelButtonText: "Cancel",
      reverseButtons: true,
      background: "var(--card)",
      color: "var(--foreground)",
      confirmButtonColor: "#dc2626"
    });
    return result.isConfirmed;
  }

  function resetComposer() {
    setIsSubmitting(false);
    setIsOptimizingUpdates(false);
    setCopilotPreview("");
    setCopilotTone("executive");
    setReportDate(format(new Date(), "yyyy-MM-dd"));
    setUpdates([createEmptyUpdate()]);
    setIsComposing(false);
  }

  function openWorkspaceTab(tab: "dashboard" | "reports" | "feed" | "profile" | "settings") {
    setActiveTab(tab);
    setSelectedReport(null);
    setSelectedAuthor(null);
    setSelectedAuthorEmail(null);
    setViewingPost(null);
    setIsNotificationsOpen(false);
    setIsComposing(false);
  }

  function openComposeBriefing() {
    setSelectedReport(null);
    setSelectedAuthor(null);
    setSelectedAuthorEmail(null);
    setActiveTab("reports");
    setIsComposing(true);
  }

  async function handleOptimizeUpdates() {
    if (!session) return;
    const nonEmptyUpdates = updates.filter(
      (update) => update.projectName.trim() && update.workNotes.trim()
    );
    if (nonEmptyUpdates.length === 0) {
      notify("warning", "Add at least one project update before optimizing.");
      return;
    }

    setIsOptimizingUpdates(true);
    try {
      const payload = {
        style: copilotTone,
        updates: updates.map((update) => ({
          project_name: update.projectName.trim(),
          work_notes: update.workNotes.trim(),
          next_steps: update.nextSteps?.trim() || null,
          blockers: update.blockers?.trim() || null,
          image_url: update.uploadedImageUrl || null,
          completion_percent: normalizeCompletionPercent(update.completionPercent),
        })),
      };

      const optimized = await fetchWithAuth(
        `${API_BASE_URL}/optimize-updates`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
        session.access_token
      ) as OptimizeUpdatesResponse;

      if (!optimized?.updates?.length) {
        notify("warning", "AI returned no rewrite. Please try again.");
        return;
      }

      setUpdates((prev) =>
        prev.map((oldUpdate, idx) => {
          const nextUpdate = optimized.updates[idx];
          if (!nextUpdate) return oldUpdate;
          return {
            ...oldUpdate,
            projectName: nextUpdate.project_name ?? oldUpdate.projectName,
            workNotes: nextUpdate.work_notes ?? oldUpdate.workNotes,
            nextSteps: nextUpdate.next_steps ?? "",
            blockers: nextUpdate.blockers ?? "",
            completionPercent:
              nextUpdate.completion_percent === null || nextUpdate.completion_percent === undefined
                ? oldUpdate.completionPercent
                : String(normalizeCompletionPercent(nextUpdate.completion_percent) ?? ""),
          };
        })
      );
      setCopilotPreview(optimized.preview || "");
      notify("success", `Draft optimized via ${optimized.provider}.`);
    } catch (err) {
      console.error(err);
      notify("error", getErrorMessage(err, "Unable to optimize this draft."));
    } finally {
      setIsOptimizingUpdates(false);
    }
  }

  function applyProfileToLocalState(nextProfile: ProfileRecord) {
    setProfile(nextProfile);
    setAllProfiles((prev) =>
      prev.map((p) => (p.user_email === nextProfile.user_email ? { ...p, ...nextProfile } : p))
    );
    setPosts((prev) =>
      prev.map((post) =>
        post.author_email === nextProfile.user_email
          ? {
              ...post,
              author_name: nextProfile.full_name,
              author_avatar: nextProfile.avatar_url ?? post.author_avatar
            }
          : post
      )
    );
  }

  async function openProfileViewer(params?: { email?: string | null; fullName?: string | null; avatarUrl?: string | null } | string | null) {
    const payload = typeof params === "string" || params === null || params === undefined
      ? { email: params ?? undefined, fullName: null, avatarUrl: null }
      : params;
    const normalizedEmail = (payload.email || "").trim().toLowerCase();
    const normalizedName = (payload.fullName || "").trim();
    const localProfileByName = normalizedName
      ? profiles.find((member) => member.full_name?.trim().toLowerCase() === normalizedName.toLowerCase())
      : null;
    if (!normalizedEmail) {
      if (localProfileByName) {
        profileViewerOpenGuardRef.current = Date.now();
        setViewingProfile(localProfileByName);
        return;
      }
      if (normalizedName) {
        profileViewerOpenGuardRef.current = Date.now();
        setViewingProfile({
          id: `optimistic-name-${normalizedName.toLowerCase().replace(/\s+/g, "-")}`,
          user_email: "unknown@autolinium.local",
          full_name: normalizedName,
          avatar_url: payload.avatarUrl || null,
          cover_url: null,
          bio: null,
        });
      } else {
        notify("warning", "Profile is unavailable for this activity.");
      }
      return;
    }

    const localProfile = profiles.find((member) => member.user_email?.toLowerCase() === normalizedEmail);
    if (localProfile) {
      profileViewerOpenGuardRef.current = Date.now();
      setViewingProfile(localProfile);
    } else {
      // Open instantly from feed/comment metadata to avoid dead-click UX.
      const optimisticProfile: ProfileRecord = {
        id: `optimistic-${normalizedEmail}`,
        user_email: normalizedEmail,
        full_name: (payload.fullName || "").trim() || normalizedEmail.split("@")[0] || "Team Member",
        avatar_url: payload.avatarUrl || null,
        cover_url: null,
        bio: null,
      };
      profileViewerOpenGuardRef.current = Date.now();
      setViewingProfile(optimisticProfile);
    }

    if (!session) {
      return;
    }

    try {
      const fetchedProfile = await fetchWithAuth(
        `${API_BASE_URL}/profiles/fetch/${encodeURIComponent(normalizedEmail)}`,
        { cache: "no-store" },
        session.access_token
      ) as ProfileRecord;

      if (!fetchedProfile?.user_email) {
        notify("warning", "Profile data not found.");
        return;
      }

      const normalizedProfile = { ...fetchedProfile, user_email: fetchedProfile.user_email.toLowerCase() };
      setAllProfiles((prev) => {
        const exists = prev.some((member) => member.user_email?.toLowerCase() === normalizedProfile.user_email);
        if (exists) {
          return prev.map((member) =>
            member.user_email?.toLowerCase() === normalizedProfile.user_email ? { ...member, ...normalizedProfile } : member
          );
        }
        return [...prev, normalizedProfile];
      });
      profileViewerOpenGuardRef.current = Date.now();
      setViewingProfile(normalizedProfile);
    } catch (err) {
      console.error(err);
      // Keep optimistic profile if fetch fails; avoid blocking modal visibility.
    }
  }

  async function fetchNotificationsNow(currentSession: Session) {
    try {
      setIsLoadingNotifications(true);
      const data = await fetchWithAuth(`${API_BASE_URL}/notifications`, { cache: "no-store" }, currentSession.access_token);
      setNotifications(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingNotifications(false);
    }
  }

  // Load Session
  useEffect(() => {
    setMounted(true);
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsCommandPaletteOpen((previous) => !previous);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mounted]);

  useEffect(() => {
    if (!isCommandPaletteOpen) return;
    setCommandQuery("");
    setCommandFocusedIndex(0);
  }, [isCommandPaletteOpen]);

  useEffect(() => {
    if (!mounted) return;
    const shouldLockScroll = Boolean(viewingImage || viewingProfile || viewingPost || isCommandPaletteOpen || isNotificationsOpen);
    const previousOverflow = document.body.style.overflow;
    if (shouldLockScroll) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mounted, viewingImage, viewingProfile, viewingPost, isCommandPaletteOpen, isNotificationsOpen]);

  useEffect(() => {
    setHasLoadedFeedDraft(false);
    setPostContent("");
    setPostImage(null);
    setSavedPlaybookPostIds([]);
    setFeedLens("all");
    setNotifications([]);
    setNotificationsLastSeenAt(0);
    setIsNotificationsOpen(false);
    setFocusedPostId(null);
  }, [session?.user?.email]);

  useEffect(() => {
    if (!mounted || hasLoadedFeedDraft) return;
    const key = getFeedDraftStorageKey();
    if (!key) return;
    try {
      const rawDraft = localStorage.getItem(key);
      if (rawDraft) {
        const parsed = JSON.parse(rawDraft) as { content?: string };
        if (parsed.content) setPostContent(parsed.content);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setHasLoadedFeedDraft(true);
    }
  }, [mounted, hasLoadedFeedDraft, session?.user?.email]);

  useEffect(() => {
    if (!mounted || !hasLoadedFeedDraft) return;
    const key = getFeedDraftStorageKey();
    if (!key) return;
    try {
      const clean = postContent.trim();
      if (!clean) {
        localStorage.removeItem(key);
        return;
      }
      localStorage.setItem(key, JSON.stringify({ content: postContent, updatedAt: Date.now() }));
    } catch (err) {
      console.error(err);
    }
  }, [mounted, hasLoadedFeedDraft, postContent, session?.user?.email]);

  useEffect(() => {
    if (!mounted) return;
    const key = getPlaybookStorageKey();
    if (!key) return;
    try {
      const rawSaved = localStorage.getItem(key);
      if (!rawSaved) return;
      const parsed = JSON.parse(rawSaved) as { ids?: string[] };
      if (Array.isArray(parsed.ids)) {
        setSavedPlaybookPostIds(parsed.ids.filter((id): id is string => typeof id === "string"));
      }
    } catch (err) {
      console.error(err);
    }
  }, [mounted, session?.user?.email]);

  useEffect(() => {
    if (!mounted) return;
    const key = getPlaybookStorageKey();
    if (!key) return;
    try {
      if (savedPlaybookPostIds.length === 0) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify({ ids: savedPlaybookPostIds }));
      }
    } catch (err) {
      console.error(err);
    }
  }, [mounted, savedPlaybookPostIds, session?.user?.email]);

  useEffect(() => {
    if (!mounted) return;
    const key = getNotificationsSeenStorageKey();
    if (!key) return;
    try {
      const raw = localStorage.getItem(key);
      setNotificationsLastSeenAt(raw ? Number(raw) || 0 : 0);
    } catch (err) {
      console.error(err);
      setNotificationsLastSeenAt(0);
    }
  }, [mounted, session?.user?.email]);

  useEffect(() => {
    if (!session) return;
    void fetchNotificationsNow(session);
    const intervalId = window.setInterval(() => {
      void fetchNotificationsNow(session);
    }, 45000);
    return () => window.clearInterval(intervalId);
  }, [session]);

  useEffect(() => {
    if (!focusedPostId) return;
    const clearId = window.setTimeout(() => setFocusedPostId(null), 2500);
    return () => window.clearTimeout(clearId);
  }, [focusedPostId]);

  // Load Data
  useEffect(() => {
    // IMMEDIATE RESET: Clear all user-specific state when session changes
    setReports([]);
    setPosts([]);
    setProfile(null);
    setAllProfiles([]);
    setSelectedReport(null);
    setSelectedAuthor(null);
    setSelectedAuthorEmail(null);
    
    if (!session) { 
      setIsLoading(false); 
      return; 
    }
    let isCancelled = false;
    async function loadAll() {
      setIsLoading(true);
      try {
        const [repData, postData, profData] = await Promise.all([
          fetchWithAuth(`${API_BASE_URL}/reports`, { cache: "no-store" }, session!.access_token),
          fetchWithAuth(`${API_BASE_URL}/posts`, { cache: "no-store" }, session!.access_token),
          fetchWithAuth(`${API_BASE_URL}/profiles/me`, {}, session!.access_token)
        ]);
        if (!isCancelled) {
          setReports(repData.map((r: any, i: number) => ({ ...r, id: r.id || `temp-${i}`, author_name: r.author_name || "Unknown" })));
          setPosts(postData);
          setProfile(profData);
        }
        void fetchWithAuth(`${API_BASE_URL}/profiles/all`, {}, session!.access_token)
          .then((allProfs) => {
            if (!isCancelled) setAllProfiles(allProfs ?? []);
          })
          .catch(() => {
            if (!isCancelled) setAllProfiles([]);
          });
      } catch (err) { console.error(err); } 
      finally { if (!isCancelled) setIsLoading(false); }
    }
    void loadAll();
    return () => { isCancelled = true; };
  }, [session]);

  const isCEO = CEO_EMAILS.has((session?.user?.email || "").toLowerCase());
  const commandActions: CommandPaletteAction[] = [
    ...(isCEO
      ? [{
          id: "go-dashboard",
          title: "Go To Team Overview",
          subtitle: "Open CEO dashboard",
          keywords: "dashboard ceo team overview",
          run: () => openWorkspaceTab("dashboard"),
        } satisfies CommandPaletteAction]
      : []),
    {
      id: "go-reports",
      title: "Go To Reports",
      subtitle: "Open briefing logs",
      keywords: "reports logs briefings",
      run: () => openWorkspaceTab("reports"),
    },
    {
      id: "go-feed",
      title: "Go To Feed",
      subtitle: "Open company feed",
      keywords: "feed company updates posts",
      run: () => openWorkspaceTab("feed"),
    },
    {
      id: "open-notifications",
      title: "Open Notifications",
      subtitle: "Review mentions and activity",
      keywords: "notifications mentions comments reactions",
      run: openNotificationsCenter,
    },
    {
      id: "go-feed-wins",
      title: "Open Wins Lens",
      subtitle: "See high-impact updates",
      keywords: "feed wins wall impact",
      run: () => {
        openWorkspaceTab("feed");
        setFeedLens("wins");
      },
    },
    {
      id: "go-feed-playbooks",
      title: "Open Playbooks Lens",
      subtitle: "See saved automation snippets",
      keywords: "feed playbook automation snippets",
      run: () => {
        openWorkspaceTab("feed");
        setFeedLens("playbooks");
      },
    },
    {
      id: "go-profile",
      title: "Go To Profile",
      subtitle: "Open profile editor",
      keywords: "profile account",
      run: () => openWorkspaceTab("profile"),
    },
    {
      id: "go-settings",
      title: "Go To Settings",
      subtitle: "Open system configuration",
      keywords: "settings configuration system",
      run: () => openWorkspaceTab("settings"),
    },
    {
      id: "create-briefing",
      title: "Create New Briefing",
      subtitle: "Open report composer",
      keywords: "create new report briefing compose",
      run: openComposeBriefing,
    },
    {
      id: "toggle-theme",
      title: theme === "dark" ? "Switch To Light Mode" : "Switch To Dark Mode",
      subtitle: "Toggle workspace appearance",
      keywords: "theme dark light mode",
      run: () => setTheme(theme === "dark" ? "light" : "dark"),
    },
    {
      id: "optimize-draft",
      title: "AI Optimize Draft",
      subtitle: isComposing ? "Rewrite current update notes" : "Open composer first to optimize",
      keywords: "ai optimize rewrite draft",
      run: () => {
        if (isComposing) return handleOptimizeUpdates();
        openComposeBriefing();
      },
    },
    {
      id: "sign-out",
      title: "Sign Out",
      subtitle: "End current session",
      keywords: "logout sign out",
      run: () => supabase.auth.signOut(),
    },
  ];
  const normalizedCommandQuery = commandQuery.trim().toLowerCase();
  const visibleCommandActions = normalizedCommandQuery
    ? commandActions.filter((action) =>
        `${action.title} ${action.subtitle} ${action.keywords}`.toLowerCase().includes(normalizedCommandQuery)
      )
    : commandActions;
  
  useEffect(() => {
    if (session && !isCEO && activeTab === "dashboard") {
      setActiveTab("reports");
    }
  }, [session, isCEO, activeTab]);

  useEffect(() => {
    if (!isCommandPaletteOpen) return;
    setCommandFocusedIndex((prev) => {
      if (visibleCommandActions.length === 0) return 0;
      return Math.min(prev, visibleCommandActions.length - 1);
    });
  }, [isCommandPaletteOpen, visibleCommandActions.length]);

  function executeCommand(action: CommandPaletteAction) {
    setIsCommandPaletteOpen(false);
    setCommandQuery("");
    setCommandFocusedIndex(0);
    void Promise.resolve(action.run()).catch((err) => {
      console.error(err);
      notify("error", getErrorMessage(err, "Command failed."));
    });
  }

  function openNotificationsCenter() {
    setIsNotificationsOpen(true);
    markNotificationsAsSeen();
    if (session) void fetchNotificationsNow(session);
  }

  function handleNotificationClick(notification: NotificationItem) {
    setIsNotificationsOpen(false);
    setActiveTab("feed");
    setSelectedReport(null);
    setSelectedAuthor(null);
    setSelectedAuthorEmail(null);
    setIsComposing(false);

    if (notification.post_id) {
      setFocusedPostId(notification.post_id);
      window.setTimeout(() => {
        const element = document.getElementById(`feed-post-${notification.post_id}`);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 160);
    }
  }

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
      const finalUpdates = updates.map((update) => ({ ...update }));
      for (let i = 0; i < finalUpdates.length; i++) {
        if (finalUpdates[i].selectedImage) {
          const preparedFile = await prepareImageForUpload(finalUpdates[i].selectedImage!, `Attachment ${i + 1}`);
          const uploadRes = await startUpload([preparedFile]);
          const uploadedUrl = getUploadUrl(uploadRes as UploadResultItem[] | null | undefined);
          if (uploadedUrl) finalUpdates[i].uploadedImageUrl = uploadedUrl;
        }
      }
      const payload = {
        report_date: reportDate,
        updates: finalUpdates.map(u => ({ 
          project_name: u.projectName.trim(), 
          work_notes: u.workNotes.trim(), 
          next_steps: u.nextSteps?.trim(),
          blockers: u.blockers?.trim(),
          image_url: u.uploadedImageUrl,
          completion_percent: normalizeCompletionPercent(u.completionPercent),
        }))
      };
      const submitResult = await fetchWithAuth(`${API_BASE_URL}/submit-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }, session.access_token) as SubmitReportResponse;

      const createdReport = submitResult?.report;
      if (createdReport) {
        setReports((prev) => {
          const normalized = {
            ...createdReport,
            id: createdReport.id || `temp-${Date.now()}`,
            author_name: createdReport.author_name || "Unknown"
          };
          return [normalized, ...prev.filter((report) => report.id !== normalized.id)];
        });
      }

      resetComposer();
      notify("success", "Briefing generated and saved.");

      // Keep modal responsiveness high; refresh list in the background.
      void fetchWithAuth(`${API_BASE_URL}/reports`, { cache: "no-store" }, session.access_token)
        .then((data) => {
          setReports(data.map((r: any, i: number) => ({ ...r, id: r.id || `temp-${i}`, author_name: r.author_name || "Unknown" })));
        })
        .catch((err) => console.error(err));
    } catch (err) {
      console.error(err);
      notify("error", getErrorMessage(err, "Unable to save this briefing."));
      setIsSubmitting(false);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePostSubmit(e: FormEvent) {
    e.preventDefault();
    if (!session || (!postContent.trim() && !postImage)) return;
    setIsPosting(true);
    try {
      let finalImageUrl: string | null = null;
      if (postImage) {
        const preparedPostImage = await prepareImageForUpload(postImage, "Post image");
        const uploadRes = await startUpload([preparedPostImage]);
        finalImageUrl = getUploadUrl(uploadRes as UploadResultItem[] | null | undefined);
      }
      const createdPost = await fetchWithAuth(`${API_BASE_URL}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: postContent.trim(), image_url: finalImageUrl }),
      }, session.access_token) as PostRecord;
      setPosts((prev) => [
        {
          ...createdPost,
          author_name: profile?.full_name || session.user.user_metadata.full_name || session.user.email || "Unknown",
          author_avatar: profile?.avatar_url ?? undefined,
          comments: createdPost.comments ?? [],
          reactions: createdPost.reactions ?? []
        },
        ...prev
      ]);
      setPostContent("");
      setPostImage(null);
      const draftKey = getFeedDraftStorageKey();
      if (draftKey) {
        try {
          localStorage.removeItem(draftKey);
        } catch (err) {
          console.error(err);
        }
      }
      notify("success", "Post published.");
    } catch (err) {
      console.error(err);
      notify("error", getErrorMessage(err, "Post failed to publish."));
    } finally { setIsPosting(false); }
  }

  async function handleDeletePost(postId: string) {
    if (!session) return;
    const confirmed = await confirmAction("Delete post?", "This action cannot be undone.");
    if (!confirmed) return;
    setDeletingPostId(postId);
    try {
      await fetchWithAuth(`${API_BASE_URL}/posts/${postId}`, { method: "DELETE" }, session.access_token);
      setPosts(prev => prev.filter(p => p.id !== postId));
      notify("success", "Post deleted.");
    } catch (err) {
      console.error(err);
      notify("error", "Unable to delete post.");
    } finally {
      setDeletingPostId(null);
    }
  }

  async function handleCommentSubmit(postId: string, content: string) {
    if (!session || !content.trim()) return;
    setCommentingPostId(postId);
    try {
      const createdComment = await fetchWithAuth(`${API_BASE_URL}/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim() }),
      }, session.access_token) as CommentRecord;
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? {
                ...post,
                comments: [
                  ...post.comments,
                  {
                    ...createdComment,
                    author_name: profile?.full_name || session.user.user_metadata.full_name || session.user.email || "Unknown",
                    author_avatar: profile?.avatar_url ?? undefined,
                    reactions: createdComment.reactions ?? []
                  }
                ]
              }
            : post
        )
      );
      setReplyingTo(null);
    } catch (err) {
      console.error(err);
      notify("error", "Unable to add comment.");
    } finally {
      setCommentingPostId(null);
    }
  }

  async function handleDeleteComment(postId: string, commentId: string) {
    if (!session) return;
    const confirmed = await confirmAction("Delete comment?", "This action cannot be undone.");
    if (!confirmed) return;
    setDeletingCommentId(commentId);
    try {
      await fetchWithAuth(`${API_BASE_URL}/comments/${commentId}`, { method: "DELETE" }, session.access_token);
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId ? { ...post, comments: post.comments.filter((comment) => comment.id !== commentId) } : post
        )
      );
      notify("success", "Comment deleted.");
    } catch (err) {
      console.error(err);
      notify("error", "Unable to delete comment.");
    } finally {
      setDeletingCommentId(null);
    }
  }

  async function handleReaction(id: string, emoji: string, type: "post" | "comment") {
    if (!session) return;
    triggerReactionBurst(`${type}-${id}`, emoji);
    
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
    } catch (err) { 
      console.error(err);
      notify("error", "Reaction failed.");
      setPosts(oldPosts); // Revert on error
    }
  }

  async function handleProfileImageUpload(file: File, type: "avatar" | "cover") {
    if (!session) return;
    setIsUpdatingProfile(true);
    try {
      const preparedFile = await prepareImageForUpload(file, type === "avatar" ? "Profile photo" : "Cover photo");
      const uploadRes = await startUpload([preparedFile]);
      const url = getUploadUrl(uploadRes as UploadResultItem[] | null | undefined);
      if (url) {
        const newProf = await fetchWithAuth(`${API_BASE_URL}/profiles/me`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(type === "avatar" ? { avatar_url: url } : { cover_url: url })
        }, session.access_token);
        applyProfileToLocalState(newProf);
        notify("success", "Profile image updated.");
      }
    } catch (err) {
      console.error(err);
      notify("error", getErrorMessage(err, "Image update failed."));
    } finally { setIsUpdatingProfile(false); }
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
      applyProfileToLocalState(newProf);
      notify("success", "Profile updated.");
    } catch (err) {
      console.error(err);
      notify("error", "Profile update failed.");
    } finally { setIsUpdatingProfile(false); }
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
  const displayedReports = selectedAuthorEmail
    ? reports.filter((report) => (report.author_email || "").toLowerCase() === selectedAuthorEmail)
    : selectedAuthor
      ? reports.filter((report) => report.author_name === selectedAuthor)
      : reports;
  const myReports = reports.filter(r => r.author_name === (profile?.full_name || session.user.user_metadata.full_name || session.user.email));
  const myFeedPosts = posts
    .filter((post) => post.author_email === session.user.email)
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  const reportsToShow = isCEO ? displayedReports : myReports;
  const dashboardProfileMembers = profiles
    .filter((member) => (member.user_email || "").toLowerCase() !== (session.user.email || "").toLowerCase())
    .sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));
  const dashboardFallbackMembers: ProfileRecord[] = uniqueAuthors.map((author, index) => {
    const firstReport = reports.find((report) => report.author_name === author);
    return {
      id: `fallback-member-${index}`,
      user_email: (firstReport?.author_email || `${author.toLowerCase().replace(/\s+/g, ".")}@autolinium.local`) as string,
      full_name: author,
      avatar_url: null,
      cover_url: null,
      bio: null,
    };
  });
  const dashboardMembers = dashboardProfileMembers.length > 0 ? dashboardProfileMembers : dashboardFallbackMembers;
  const winsWallPosts = [...posts]
    .map((post) => ({ post, score: scorePostImpact(post) }))
    .filter(({ post, score }) => postHasWinSignal(post) || score >= 10)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
  const playbookPosts = posts.filter(
    (post) => savedPlaybookPostIds.includes(post.id) || postHasPlaybookSignal(post)
  );
  const visibleFeedPosts = feedLens === "wins"
    ? winsWallPosts.map((item) => item.post)
    : feedLens === "playbooks"
      ? playbookPosts
      : posts;
  const unreadNotificationsCount = notifications.filter(
    (notification) => new Date(notification.created_at).getTime() > notificationsLastSeenAt
  ).length;
  const latestNotifications = notifications.slice(0, 80);
  const publicProfilePosts = viewingProfile
    ? posts
        .filter((post) => post.author_email === viewingProfile.user_email)
        .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    : [];
  const publicProfileReports = viewingProfile
    ? reports
        .filter((report) => report.author_email === viewingProfile.user_email)
        .sort((a, b) => +new Date(b.report_date) - +new Date(a.report_date))
    : [];
  const myReportCapsules = [...myReports].sort((a, b) => +new Date(b.report_date) - +new Date(a.report_date));
  const publicReportCapsules = [...publicProfileReports].sort((a, b) => +new Date(b.report_date) - +new Date(a.report_date));

  const userAvatar = profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.full_name || session.user.email || "U")}&background=random`;
  const attachmentViewer = mounted && viewingImage
    ? createPortal(
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/70 p-4 sm:p-6 md:p-10 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.985 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative flex h-[min(86vh,920px)] w-full max-w-6xl flex-col overflow-hidden rounded-[1.75rem] border border-[color:var(--border)] bg-[color:var(--card)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-14 items-center justify-between border-b border-[color:var(--border)] px-5 md:px-7">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <span className="text-[10px] font-black uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
                  Attachment
                </span>
              </div>
              <button
                onClick={() => setViewingImage(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[color:var(--muted-foreground)] transition-all hover:bg-destructive/10 hover:text-destructive"
              >
                <X size={17} />
              </button>
            </div>
            <div className="flex flex-1 items-center justify-center bg-[color:var(--muted)]/40 p-4 md:p-8">
              <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-xl border border-[color:var(--border)] bg-black/10">
                <img
                  src={viewingImage}
                  alt="Attachment"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            </div>
          </motion.div>
          <div className="absolute inset-0 -z-10" onClick={() => setViewingImage(null)} />
        </div>,
        document.body
      )
    : null;
  const postViewer = mounted && viewingPost
    ? createPortal(
        <div className="fixed inset-0 z-[510] flex items-center justify-center bg-black/72 p-4 backdrop-blur-md sm:p-6 md:p-10" onClick={() => setViewingPost(null)}>
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.985 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative flex h-[min(90vh,920px)] w-full max-w-5xl flex-col overflow-hidden rounded-[1.9rem] border border-[color:var(--border)] bg-[color:var(--card)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex h-14 items-center justify-between border-b border-[color:var(--border)] px-5">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => void openProfileViewer({
                    email: viewingPost.author_email,
                    fullName: viewingPost.author_name,
                    avatarUrl: viewingPost.author_avatar ?? null,
                  })}
                  className="h-8 w-8 overflow-hidden rounded-xl border border-[color:var(--border)] transition-all hover:scale-[1.03] hover:ring-2 hover:ring-primary/20"
                >
                  <img src={viewingPost.author_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(viewingPost.author_name || "U")}&background=random`} className="h-8 w-8 rounded-xl object-cover" alt="" />
                </button>
                <div>
                  <button
                    type="button"
                    onClick={() => void openProfileViewer({
                      email: viewingPost.author_email,
                      fullName: viewingPost.author_name,
                      avatarUrl: viewingPost.author_avatar ?? null,
                    })}
                    className="text-sm font-black tracking-tight transition-colors hover:text-primary"
                  >
                    {viewingPost.author_name || "Unknown"}
                  </button>
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">{formatDistanceToNow(parseISO(viewingPost.created_at), { addSuffix: true })}</div>
                </div>
              </div>
              <button onClick={() => setViewingPost(null)} className="flex h-8 w-8 items-center justify-center rounded-lg text-[color:var(--muted-foreground)] transition-all hover:bg-destructive/10 hover:text-destructive">
                <X size={16} />
              </button>
            </div>
            <div className="grid min-h-0 flex-1 gap-0 md:grid-cols-[minmax(0,1fr)_360px]">
              <div className="min-h-0 overflow-y-auto p-5 custom-scrollbar">
                {viewingPost.image_url ? (
                  <div className="overflow-hidden rounded-2xl border border-[color:var(--border)]">
                    <img src={viewingPost.image_url} className="max-h-[72vh] w-full object-cover" alt="" />
                  </div>
                ) : (
                  <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-[color:var(--border)] bg-[color:var(--muted)]/35 p-8 text-center">
                    <span className="text-sm font-semibold text-[color:var(--muted-foreground)]">No media attached to this post.</span>
                  </div>
                )}
              </div>
              <aside className="border-t border-[color:var(--border)] bg-[color:var(--muted)]/30 p-5 md:border-l md:border-t-0">
                <p className="whitespace-pre-wrap text-sm font-semibold leading-relaxed text-[color:var(--foreground)]/90">{viewingPost.content}</p>
                <div className="mt-5 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">
                  <span>{viewingPost.reactions.length} reactions</span>
                  <span>•</span>
                  <span>{viewingPost.comments.length} comments</span>
                </div>
              </aside>
            </div>
          </motion.div>
        </div>,
        document.body
      )
    : null;
  const profileViewer = mounted && viewingProfile
    ? createPortal(
        <div
          className="fixed inset-0 z-[940] flex items-start justify-center overflow-y-auto bg-[#020814]/78 p-3 pt-16 backdrop-blur-md sm:p-6 sm:pt-20"
          onClick={() => {
            if (Date.now() - profileViewerOpenGuardRef.current < 220) return;
            setViewingProfile(null);
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.985 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="relative my-2 flex max-h-[calc(100dvh-2.5rem)] w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-[color:var(--border)]/80 bg-[color:var(--card)] shadow-[0_28px_80px_-32px_rgba(0,0,0,0.68)]"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="relative h-40 overflow-hidden border-b border-[color:var(--border)] md:h-52">
              {viewingProfile.cover_url ? (
                <img src={viewingProfile.cover_url} className="h-full w-full object-cover" alt="" />
              ) : (
                <div className="h-full w-full bg-gradient-to-tr from-primary/30 via-primary/12 to-transparent" />
              )}
              <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/20 to-black/55" />
              <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full border border-white/25 bg-black/35 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-white/90 backdrop-blur-xl sm:left-6 sm:top-6">
                <Activity size={12} />
                Team Profile
              </div>
              <button
                onClick={() => setViewingProfile(null)}
                className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-black/40 text-white transition-all hover:bg-black/65 sm:right-6 sm:top-6"
              >
                <X size={18} />
              </button>
            </header>

            <div className="grid min-h-0 flex-1 gap-0 md:grid-cols-[280px_minmax(0,1fr)]">
              <aside className="border-b border-[color:var(--border)] bg-[color:var(--muted)]/35 px-5 py-6 md:border-b-0 md:border-r md:px-6 md:py-8">
                <div className="mx-auto -mt-20 h-28 w-28 overflow-hidden rounded-[1.65rem] border-[5px] border-[color:var(--card)] bg-[color:var(--card)] shadow-2xl md:mx-0 md:h-32 md:w-32">
                  <img src={viewingProfile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(viewingProfile.full_name)}&background=random&size=128&bold=true`} className="h-full w-full object-cover" alt="" />
                </div>
                <div className="mt-5">
                  <h2 className="font-heading text-2xl font-black tracking-tight md:text-[1.75rem]">{viewingProfile.full_name}</h2>
                  <p className="mt-1 break-all text-xs font-semibold text-[color:var(--muted-foreground)]">{viewingProfile.user_email}</p>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-primary/20 bg-primary/10 px-3 py-2">
                    <p className="text-[9px] font-black uppercase tracking-[0.15em] text-primary/90">Briefs</p>
                    <p className="mt-1 text-lg font-black leading-none">{publicProfileReports.length}</p>
                  </div>
                  <div className="rounded-xl border border-primary/20 bg-primary/10 px-3 py-2">
                    <p className="text-[9px] font-black uppercase tracking-[0.15em] text-primary/90">Posts</p>
                    <p className="mt-1 text-lg font-black leading-none">{publicProfilePosts.length}</p>
                  </div>
                </div>
                {viewingProfile.bio ? (
                  <div className="mt-5 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/88 p-4 dark:bg-[#122742]/90">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary/80">Bio</p>
                    <p className="mt-2 text-sm leading-relaxed text-[color:var(--muted-foreground)]">{viewingProfile.bio}</p>
                  </div>
                ) : (
                  <div className="mt-5 rounded-2xl border border-dashed border-[color:var(--border)] p-4 text-xs text-[color:var(--muted-foreground)]">
                    No bio added yet.
                  </div>
                )}
              </aside>

              <section className="min-h-0 overflow-y-auto custom-scrollbar px-5 py-6 md:px-7 md:py-8">
                <div className="flex flex-col gap-6 pb-2">
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="font-heading text-xl font-black tracking-tight">Brief Capsules</h3>
                      <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                        {publicProfileReports.length} briefs
                      </span>
                    </div>
                    {publicProfileReports.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-[color:var(--border)] px-4 py-6 text-center text-xs italic text-[color:var(--muted-foreground)]">
                        No brief capsules visible yet.
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {publicReportCapsules.slice(0, 24).map((report) => (
                          <button
                            key={report.id}
                            type="button"
                            onClick={() => {
                              setViewingProfile(null);
                              setSelectedReport(report);
                            }}
                            className="rounded-full border border-[color:var(--border)] bg-[color:var(--card)] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-[color:var(--foreground)] transition-all hover:border-primary/25 hover:text-primary dark:border-[#3a5885] dark:bg-[#112640]"
                          >
                            {format(parseISO(report.report_date), "MMM d")}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="font-heading text-xl font-black tracking-tight">Posts</h3>
                      <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                        {publicProfilePosts.length} posts
                      </span>
                    </div>
                    {publicProfilePosts.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-[color:var(--border)] px-5 py-10 text-center text-sm italic text-[color:var(--muted-foreground)]">
                        No feed activity from this teammate yet.
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                        {publicProfilePosts.slice(0, 12).map((post) => (
                          <button
                            key={post.id}
                            type="button"
                            onClick={() => setViewingPost(post)}
                            className="group relative aspect-square overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--muted)]/35 text-left transition-all hover:border-primary/30 dark:border-[#3a5885] dark:bg-[#122742]"
                          >
                            {post.image_url ? (
                              <img src={post.image_url} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" alt="" />
                            ) : (
                              <div className="flex h-full w-full items-end bg-gradient-to-tr from-primary/15 via-transparent to-primary/10 p-3">
                                <p className="line-clamp-4 text-xs font-semibold leading-snug text-[color:var(--foreground)]/85">{post.content}</p>
                              </div>
                            )}
                            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-2 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-white/90 opacity-0 transition-opacity group-hover:opacity-100">
                              View Post
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </div>
          </motion.div>
        </div>,
        document.body
      )
    : null;
  const commandPalette = mounted && isCommandPaletteOpen
    ? createPortal(
        <div
          className="fixed inset-0 z-[540] flex items-start justify-center bg-black/45 p-4 pt-20 backdrop-blur-sm sm:p-6 sm:pt-24"
          onClick={() => setIsCommandPaletteOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.99 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="w-full max-w-2xl overflow-hidden rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)] shadow-[0_32px_88px_-34px_rgba(0,0,0,0.62)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-[color:var(--border)] px-4 py-3.5 sm:px-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Command size={16} />
              </div>
              <input
                autoFocus
                value={commandQuery}
                onChange={(event) => setCommandQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setIsCommandPaletteOpen(false);
                    return;
                  }
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setCommandFocusedIndex((prev) =>
                      visibleCommandActions.length === 0 ? 0 : Math.min(prev + 1, visibleCommandActions.length - 1)
                    );
                    return;
                  }
                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setCommandFocusedIndex((prev) => Math.max(prev - 1, 0));
                    return;
                  }
                  if (event.key === "Enter") {
                    event.preventDefault();
                    const selectedAction = visibleCommandActions[commandFocusedIndex];
                    if (selectedAction) executeCommand(selectedAction);
                  }
                }}
                placeholder="Search actions... (Ctrl/Cmd + K)"
                className="h-10 w-full bg-transparent text-sm font-semibold outline-none placeholder:text-[color:var(--muted-foreground)]"
              />
              <span className="rounded-lg border border-[color:var(--border)] px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">
                esc
              </span>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-2.5 custom-scrollbar">
              {visibleCommandActions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[color:var(--border)] px-4 py-10 text-center text-sm text-[color:var(--muted-foreground)]">
                  No matching command.
                </div>
              ) : (
                visibleCommandActions.map((action, idx) => (
                  <button
                    key={action.id}
                    type="button"
                    onMouseEnter={() => setCommandFocusedIndex(idx)}
                    onClick={() => executeCommand(action)}
                    className={`mb-1.5 w-full rounded-2xl border px-4 py-3 text-left transition-all ${
                      idx === commandFocusedIndex
                        ? "border-primary/35 bg-primary/10 shadow-sm"
                        : "border-transparent hover:border-[color:var(--border)] hover:bg-[color:var(--muted)]/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-bold tracking-tight">{action.title}</span>
                      {idx === commandFocusedIndex && (
                        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-primary">Enter</span>
                      )}
                    </div>
                    <p className="mt-1 text-xs font-medium text-[color:var(--muted-foreground)]">{action.subtitle}</p>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        </div>,
        document.body
      )
    : null;
  const notificationsCenter = mounted && isNotificationsOpen
    ? createPortal(
        <div className="fixed inset-0 z-[930] flex items-start justify-center bg-black/52 p-4 pt-20 backdrop-blur-sm sm:p-6 sm:pt-24" onClick={() => setIsNotificationsOpen(false)}>
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.99 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-full max-w-2xl overflow-hidden rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)] shadow-[0_32px_88px_-34px_rgba(0,0,0,0.62)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[color:var(--border)] bg-[linear-gradient(135deg,rgba(29,185,84,0.14),rgba(29,185,84,0.06))] px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#1DB954]/35 bg-[#1DB954]/18 text-[#1DB954]">
                  <Bell size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-black tracking-tight">Notifications</h3>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#1DB954]">{unreadNotificationsCount} unread</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { if (session) void fetchNotificationsNow(session); }}
                  className="rounded-lg border border-[color:var(--border)] px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-[color:var(--muted-foreground)] transition-all hover:border-primary/25 hover:text-primary"
                >
                  Refresh
                </button>
                <button onClick={() => setIsNotificationsOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-[color:var(--muted-foreground)] transition-all hover:bg-destructive/10 hover:text-destructive">
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="max-h-[68vh] overflow-y-auto p-3 custom-scrollbar">
              {isLoadingNotifications ? (
                <div className="flex justify-center py-16">
                  <LoadingSpinner className="h-6 w-6" />
                </div>
              ) : latestNotifications.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[color:var(--border)] px-5 py-12 text-center text-sm italic text-[color:var(--muted-foreground)]">
                  No notifications yet.
                </div>
              ) : (
                latestNotifications.map((notification) => {
                  const isUnread = new Date(notification.created_at).getTime() > notificationsLastSeenAt;
                  const actorAvatar = notification.actor_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(notification.actor_name || "U")}&background=random`;
                  return (
                    <button
                      key={notification.id}
                      type="button"
                      onClick={() => handleNotificationClick(notification)}
                      className={`mb-2 flex w-full items-start gap-3 rounded-2xl border px-3.5 py-3 text-left transition-all ${
                        isUnread
                          ? "border-[#1DB954]/35 bg-[#1DB954]/14 shadow-[0_8px_28px_-18px_rgba(29,185,84,0.6)]"
                          : "border-transparent bg-[color:var(--muted)]/35 hover:border-[color:var(--border)]"
                      }`}
                    >
                      <div className="relative">
                        <img src={actorAvatar} className="mt-0.5 h-9 w-9 rounded-xl border border-[color:var(--border)] object-cover" alt="" />
                        {isUnread && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[#1DB954] ring-2 ring-[color:var(--card)]" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <p className="truncate text-sm font-bold tracking-tight">{notification.title}</p>
                          <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[color:var(--muted-foreground)]">
                            {formatDistanceToNow(parseISO(notification.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs font-semibold leading-relaxed text-[color:var(--muted-foreground)]">{notification.body}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-primary">{notification.actor_name || notification.actor_email || "Teammate"}</p>
                          {isUnread && (
                            <span className="rounded-full border border-[#1DB954]/35 bg-[#1DB954]/18 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-[#1DB954]">
                              New
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        </div>,
        document.body
      )
    : null;

  return (
    <div className="flex min-h-screen w-full bg-[color:var(--background)] text-[color:var(--foreground)] selection:bg-primary/20 lg:h-screen lg:overflow-hidden">
      
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
      <aside className="z-20 hidden w-72 flex-col border-r border-[color:var(--border)] bg-[color:var(--card)]/88 p-6 shadow-2xl backdrop-blur-xl lg:flex">
        <div className="mb-10 px-2 flex items-center gap-4 group">
          <img src="/logo.png" alt="Logo" className="h-10 w-10 object-contain group-hover:scale-110 transition-transform duration-500" />
          <div>
            <h1 className="font-heading text-xl font-bold tracking-tight text-primary">Autolinium</h1>
            <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-[color:var(--muted-foreground)] opacity-60">Operations</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {isCEO && (
            <button onClick={() => { setActiveTab("dashboard"); setSelectedReport(null); setSelectedAuthor(null); setSelectedAuthorEmail(null); setIsComposing(false); }} className={`sidebar-nav-item h-11 ${activeTab === "dashboard" ? "active" : ""}`}>
              <LayoutDashboard size={18} /> CEO Dashboard
            </button>
          )}
          <button onClick={() => { setActiveTab("reports"); setSelectedReport(null); setSelectedAuthor(null); setSelectedAuthorEmail(null); setIsComposing(false); }} className={`sidebar-nav-item h-11 ${activeTab === "reports" && !selectedAuthor ? "active" : ""}`}>
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
      <main className="relative z-10 flex-1 overflow-y-auto custom-scrollbar scroll-smooth pb-24 lg:pb-0">
        <header className="sticky top-0 z-40 flex h-20 items-center justify-between border-b border-[color:var(--border)] bg-[color:var(--background)]/88 px-4 shadow-sm backdrop-blur-xl sm:px-6 lg:px-10">
          <div className="flex items-center gap-4">
            {selectedReport && (
              <button onClick={() => setSelectedReport(null)} className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-[color:var(--muted)] transition-colors">
                <ArrowLeft size={20} />
              </button>
            )}
            <img src="/logo.png" alt="" className="h-8 w-8 rounded-lg object-contain lg:hidden" />
            <h2 className="font-heading text-xl font-bold tracking-tight text-[color:var(--foreground)] sm:text-2xl">
              {selectedReport ? "Briefing Details" : isComposing ? "Log Briefing" : activeTab === "reports" && selectedAuthor ? `${selectedAuthor}'s Execution` : activeTab === "dashboard" ? "Team Overview" : activeTab === "feed" ? "Company Feed" : activeTab}
            </h2>
          </div>
          
          <div className="flex items-center gap-2.5">
            <button
              onClick={openNotificationsCenter}
              className={`relative flex h-10 w-10 items-center justify-center rounded-xl border bg-[color:var(--card)] transition-all sm:h-11 sm:w-11 ${
                unreadNotificationsCount > 0
                  ? "border-[#1DB954]/40 text-[#1DB954] shadow-[0_0_0_4px_rgba(29,185,84,0.14)] hover:border-[#1DB954]/55 hover:text-[#1DB954]"
                  : "border-[color:var(--border)] text-[color:var(--muted-foreground)] hover:border-primary/30 hover:text-primary"
              }`}
            >
              <Bell size={16} />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 rounded-full border border-[#0f7e3b] bg-[#1DB954] px-1.5 py-[2px] text-[9px] font-black leading-none text-black shadow-md">
                  {unreadNotificationsCount > 99 ? "99+" : unreadNotificationsCount}
                </span>
              )}
              {unreadNotificationsCount > 0 && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#1DB954] animate-ping opacity-70" />}
            </button>
            <button
              onClick={() => setIsCommandPaletteOpen(true)}
              className="flex h-10 items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 text-xs font-black uppercase tracking-[0.12em] text-[color:var(--muted-foreground)] transition-all hover:border-primary/30 hover:text-primary sm:h-11 sm:px-4"
            >
              <Command size={14} />
              <span className="hidden sm:inline">Actions</span>
              <span className="rounded-md border border-[color:var(--border)] px-1.5 py-0.5 text-[9px] tracking-[0.08em] text-[color:var(--muted-foreground)]">Ctrl K</span>
            </button>
            {!isComposing && !selectedReport && activeTab !== "profile" && activeTab !== "feed" && activeTab !== "settings" && (
              <button onClick={openComposeBriefing} className="button-primary h-10 rounded-xl px-3.5 font-bold tracking-tight shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 sm:h-11 sm:px-6"><Plus size={18} /> <span className="hidden sm:inline">Create Report</span></button>
            )}
          </div>
        </header>

        <div className="sticky top-20 z-30 border-b border-[color:var(--border)] bg-[color:var(--background)]/80 px-4 py-3 backdrop-blur-xl sm:px-6 lg:hidden">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {isCEO && (
              <button
                onClick={() => { setActiveTab("dashboard"); setSelectedReport(null); setSelectedAuthor(null); setSelectedAuthorEmail(null); setIsComposing(false); }}
                className={`whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-bold uppercase tracking-[0.15em] transition-all ${activeTab === "dashboard" ? "bg-primary text-white shadow-md shadow-primary/30" : "bg-[color:var(--card)] text-[color:var(--muted-foreground)] border border-[color:var(--border)]"}`}
              >
                Dashboard
              </button>
            )}
            <button
              onClick={() => { setActiveTab("reports"); setSelectedReport(null); setSelectedAuthor(null); setSelectedAuthorEmail(null); setIsComposing(false); }}
              className={`whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-bold uppercase tracking-[0.15em] transition-all ${activeTab === "reports" ? "bg-primary text-white shadow-md shadow-primary/30" : "bg-[color:var(--card)] text-[color:var(--muted-foreground)] border border-[color:var(--border)]"}`}
            >
              Reports
            </button>
            <button
              onClick={() => { setActiveTab("feed"); setSelectedReport(null); setIsComposing(false); }}
              className={`whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-bold uppercase tracking-[0.15em] transition-all ${activeTab === "feed" ? "bg-primary text-white shadow-md shadow-primary/30" : "bg-[color:var(--card)] text-[color:var(--muted-foreground)] border border-[color:var(--border)]"}`}
            >
              Feed
            </button>
            <button
              onClick={() => { setActiveTab("profile"); setSelectedReport(null); setIsComposing(false); }}
              className={`whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-bold uppercase tracking-[0.15em] transition-all ${activeTab === "profile" ? "bg-primary text-white shadow-md shadow-primary/30" : "bg-[color:var(--card)] text-[color:var(--muted-foreground)] border border-[color:var(--border)]"}`}
            >
              Profile
            </button>
            <button
              onClick={() => { setActiveTab("settings"); setSelectedReport(null); setIsComposing(false); }}
              className={`whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-bold uppercase tracking-[0.15em] transition-all ${activeTab === "settings" ? "bg-primary text-white shadow-md shadow-primary/30" : "bg-[color:var(--card)] text-[color:var(--muted-foreground)] border border-[color:var(--border)]"}`}
            >
              Settings
            </button>
          </div>
        </div>

        <div className="container relative z-10 mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
          <AnimatePresence mode="wait">
            {isLoading && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex h-[60vh] items-center justify-center">
                <LoadingSpinner className="h-10 w-10" />
              </motion.div>
            )}

            {/* FEED VIEW */}
            {!isLoading && activeTab === "feed" && !isComposing && !selectedReport && (
              <motion.div key="feed" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mx-auto flex max-w-3xl flex-col gap-8">
                <div className="card-elevated rounded-[2rem] border-primary/10 bg-[color:var(--card)]/95 p-7 shadow-xl shadow-black/5 backdrop-blur-xl dark:border-[#2f4a72] dark:bg-[#0f1f36]/92 dark:shadow-black/45">
                  <div className="flex gap-5">
                    <img src={userAvatar} className="h-12 w-12 rounded-2xl border border-[color:var(--border)] object-cover shrink-0 ring-4 ring-primary/5" alt="" />
                    <form onSubmit={handlePostSubmit} className="flex-1 flex flex-col gap-5">
                      <div className="rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--card)]/82 p-4 shadow-inner dark:border-[#35527c] dark:bg-[#10233d]/88">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          {FEED_TEMPLATE_SNIPPETS.map((template) => (
                            <button
                              key={template.id}
                              type="button"
                              onClick={() => applyFeedTemplate(template.text)}
                              className="rounded-full border border-[color:var(--border)] bg-[color:var(--muted)]/30 px-3.5 py-1.5 text-[10px] font-black uppercase tracking-[0.13em] text-[color:var(--muted-foreground)] transition-all hover:border-primary/30 hover:bg-primary/10 hover:text-primary dark:border-[#3a5986] dark:bg-[#122945]"
                            >
                              {template.label}
                            </button>
                          ))}
                        </div>
                        <div className="relative">
                          <textarea
                            value={postContent}
                            onChange={(e) => {
                              setPostContent(e.target.value);
                              if (e.target.value.endsWith("@")) setMentionSearch("post");
                              else if (!e.target.value.includes("@")) setMentionSearch(null);
                            }}
                            placeholder="Share an update or tag a teammate with @..."
                            className="min-h-[104px] w-full resize-none rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/55 p-3.5 text-base font-medium leading-relaxed text-[color:var(--foreground)] outline-none transition-all placeholder:text-[color:var(--muted-foreground)] focus:border-primary/30 dark:border-[#3a5986] dark:bg-[#0f223b]/82"
                          />
                          {mentionSearch === "post" && (
                            <div className="absolute top-full left-0 z-50 mt-2 flex w-64 flex-col gap-1 overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/90 p-2 shadow-2xl backdrop-blur-2xl dark:border-[#3a5885] dark:bg-[#0e2039]/95">
                              <p className="p-2 text-[10px] font-bold uppercase tracking-widest text-[color:var(--muted-foreground)]">Select Teammate</p>
                              {profiles.map(p => (
                                <button key={p.id} type="button" onClick={() => insertMention(null, p.full_name)} className="flex items-center gap-3 rounded-xl p-2 text-sm font-semibold transition-colors hover:bg-primary/5 hover:text-primary">
                                  <img src={p.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.full_name)}&background=random`} className="h-8 w-8 rounded-full border border-primary/10" alt=""/>
                                  <span>{p.full_name}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="mt-2 text-[10px] font-semibold text-[color:var(--muted-foreground)]">
                          {hasLoadedFeedDraft ? "Draft autosaved" : "Preparing draft memory..."}
                        </div>
                      </div>
                      
                      {postImage && (
                        <div className="group relative w-fit overflow-hidden rounded-2xl border border-[color:var(--border)]">
                          <button type="button" onClick={() => setPostImage(null)} className="absolute top-2 right-2 z-10 bg-black/60 backdrop-blur-md text-white rounded-full p-1.5 hover:bg-black/80 transition-colors"><X size={14}/></button>
                          <img src={URL.createObjectURL(postImage)} className="h-40 object-cover" alt="Preview" />
                        </div>
                      )}

                      <div className="flex items-center justify-between border-t border-[color:var(--border)] pt-5">
                        <label className="cursor-pointer text-primary hover:text-primary/80 transition-all flex items-center gap-2.5 text-sm font-bold group">
                          <div className="h-9 w-9 flex items-center justify-center rounded-xl bg-primary/5 group-hover:bg-primary/10"><Camera size={18} /></div>
                          Attach Media
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0] ?? null;
                              if (file) notifyLargeImageSelection(file, "Post image");
                              setPostImage(file);
                            }}
                          />
                        </label>
                        <div className="flex items-center gap-3">
                          <span className="hidden text-[10px] font-black uppercase tracking-[0.14em] text-[color:var(--muted-foreground)] sm:inline">
                            {postContent.trim() ? postContent.trim().split(/\s+/).length : 0} words
                          </span>
                          <button type="submit" disabled={isPosting || (!postContent.trim() && !postImage)} className="button-primary h-10 px-6 rounded-xl font-bold tracking-tight">
                            {isPosting ? <LoadingSpinner className="h-4 w-4" tone="light" /> : "Post Briefing"}
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>
                </div>

                <div className="flex flex-col gap-7">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <section className="rounded-[1.6rem] border border-[color:var(--border)] bg-[color:var(--card)]/88 p-5 shadow-sm dark:border-[#35527b] dark:bg-[#112741]/92">
                      <div className="mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-primary">
                          <Trophy size={16} />
                          <h4 className="text-[11px] font-black uppercase tracking-[0.16em]">Wins Wall</h4>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">Top Momentum</span>
                      </div>
                      <div className="flex flex-col gap-3">
                        {winsWallPosts.length === 0 ? (
                          <p className="text-xs italic text-[color:var(--muted-foreground)]">Your wins will appear here as the feed gets active.</p>
                        ) : (
                          winsWallPosts.slice(0, 3).map(({ post, score }) => (
                            <button key={post.id} type="button" onClick={() => setFeedLens("all")} className="group/win rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]/35 p-3 text-left transition-all hover:border-primary/25 hover:bg-primary/5 dark:border-[#3a5886] dark:bg-[#132943]">
                              <p className="line-clamp-2 text-sm font-semibold leading-snug text-[color:var(--foreground)]">{post.content}</p>
                              <div className="mt-2 flex items-center justify-between">
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void openProfileViewer({
                                      email: post.author_email,
                                      fullName: post.author_name,
                                      avatarUrl: post.author_avatar ?? null,
                                    });
                                  }}
                                  className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary transition-colors hover:text-primary/80"
                                >
                                  {post.author_name}
                                </button>
                                <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-primary">
                                  score {score}
                                </span>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </section>

                    <section className="rounded-[1.6rem] border border-[color:var(--border)] bg-[color:var(--card)]/88 p-5 shadow-sm dark:border-[#35527b] dark:bg-[#112741]/92">
                      <div className="mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-primary">
                          <BookMarked size={16} />
                          <h4 className="text-[11px] font-black uppercase tracking-[0.16em]">Automation Playbooks</h4>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">{playbookPosts.length} snippets</span>
                      </div>
                      <div className="flex flex-col gap-3">
                        {playbookPosts.length === 0 ? (
                          <p className="text-xs italic text-[color:var(--muted-foreground)]">Save posts as playbooks from the post menu.</p>
                        ) : (
                          playbookPosts.slice(0, 3).map((post) => (
                            <div key={post.id} className="rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]/35 p-3 dark:border-[#3a5886] dark:bg-[#132943]">
                              <p className="line-clamp-3 text-sm font-semibold leading-snug text-[color:var(--foreground)]">{post.content}</p>
                              <div className="mt-2 flex items-center justify-between gap-2">
                                <button
                                  type="button"
                                  onClick={() => void openProfileViewer({
                                    email: post.author_email,
                                    fullName: post.author_name,
                                    avatarUrl: post.author_avatar ?? null,
                                  })}
                                  className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary transition-colors hover:text-primary/80"
                                >
                                  {post.author_name}
                                </button>
                                <button type="button" onClick={() => void copyPlaybook(post)} className="flex items-center gap-1 rounded-lg border border-[color:var(--border)] px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[color:var(--muted-foreground)] transition-all hover:border-primary/25 hover:text-primary">
                                  <Copy size={12} />
                                  Copy
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </section>
                  </div>

                  <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
                    {([
                      { id: "all", label: "All Feed" },
                      { id: "wins", label: "Wins Lens" },
                      { id: "playbooks", label: "Playbooks Lens" },
                    ] as Array<{ id: "all" | "wins" | "playbooks"; label: string }>).map((lens) => (
                      <button
                        key={lens.id}
                        type="button"
                        onClick={() => setFeedLens(lens.id)}
                        className={`rounded-full border px-3.5 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] transition-all ${
                          feedLens === lens.id
                            ? "border-primary/25 bg-primary text-white"
                            : "border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--muted-foreground)] hover:border-primary/25 hover:text-primary"
                        }`}
                      >
                        {lens.label}
                      </button>
                    ))}
                  </div>

                  {visibleFeedPosts.length === 0 ? (
                    <div className="rounded-[2rem] border border-dashed border-[color:var(--border)] px-8 py-16 text-center font-medium italic text-[color:var(--muted-foreground)] backdrop-blur-sm">
                      {feedLens === "all" ? "No transmissions found in the current sector." : `No posts found for ${feedLens} lens yet.`}
                    </div>
                  ) : (
                    visibleFeedPosts.map(post => {
                      const postAvatar = post.author_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.author_name || "U")}&background=random`;
                      const isMyPost = post.author_email === session.user.email;
                      
                      return (
                        <div id={`feed-post-${post.id}`} key={post.id} className={`group/card card-elevated relative flex flex-col overflow-hidden rounded-[2rem] border-[color:var(--border)]/80 bg-[color:var(--card)]/95 shadow-xl shadow-black/5 backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/25 dark:border-[#334f78] dark:bg-[#0d1e34]/92 dark:shadow-black/45 ${focusedPostId === post.id ? "ring-2 ring-primary/45 ring-offset-2 ring-offset-[color:var(--background)]" : ""}`}>
                          {/* Post Header */}
                          <div className="flex items-center justify-between px-6 pb-4 pt-6">
                            <div className="flex items-center gap-4">
                              <button 
                                type="button"
                                onClick={() => {
                                  void openProfileViewer({
                                    email: post.author_email,
                                    fullName: post.author_name,
                                    avatarUrl: post.author_avatar ?? null,
                                  });
                                }}
                                className="relative group/avatar"
                              >
                                <img src={postAvatar} className="h-12 w-12 shrink-0 rounded-2xl border border-[color:var(--border)] object-cover ring-4 ring-primary/5 transition-transform group-hover/avatar:scale-105" alt="" />
                                <div className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-[color:var(--card)] bg-emerald-500" />
                              </button>
                              <div className="flex flex-col text-left">
                                <button 
                                  type="button"
                                  onClick={() => {
                                    void openProfileViewer({
                                      email: post.author_email,
                                      fullName: post.author_name,
                                      avatarUrl: post.author_avatar ?? null,
                                    });
                                  }}
                                  className="font-bold text-base text-[color:var(--foreground)] tracking-tight hover:text-primary transition-colors"
                                >
                                  {post.author_name}
                                </button>
                                <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--muted-foreground)] opacity-60">
                                  {formatDistanceToNow(parseISO(post.created_at), { addSuffix: true })}
                                </span>
                              </div>
                            </div>
                            
                            <div className="relative group/menu">
                              <button className="flex h-10 w-10 items-center justify-center rounded-xl text-[color:var(--muted-foreground)] transition-all hover:bg-primary/10 hover:text-primary">
                                <MoreHorizontal size={20} />
                              </button>
                              
                              <div className="absolute right-0 top-full w-48 opacity-0 pointer-events-none group-hover/menu:opacity-100 group-hover/menu:pointer-events-auto transition-all translate-y-2 group-hover/menu:translate-y-0 z-50 pt-2">
                                <div className="absolute top-0 left-0 right-0 h-2" /> {/* Invisible Bridge */}
                                <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/90 py-2 shadow-2xl backdrop-blur-2xl dark:border-[#3a5885] dark:bg-[#10243f]/95">
                                  {isMyPost && (
                                    <button onClick={() => handleDeletePost(post.id)} disabled={deletingPostId === post.id} className="flex w-full items-center gap-3 px-4 py-2 text-sm font-bold text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-60">
                                      {deletingPostId === post.id ? <LoadingSpinner className="h-4 w-4" tone="danger" /> : <Trash2 size={16} />} Delete Post
                                    </button>
                                  )}
                                  <button
                                    onClick={async () => {
                                      const postUrl = `${window.location.origin}/#feed-post-${post.id}`;
                                      try {
                                        await navigator.clipboard.writeText(postUrl);
                                        notify("success", "Post link copied.");
                                      } catch (err) {
                                        console.error(err);
                                        notify("warning", "Unable to copy link.");
                                      }
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-2 text-sm font-bold text-[color:var(--foreground)] hover:bg-primary/5 transition-colors text-left"
                                  >
                                    <AtSign size={16} /> Copy Link
                                  </button>
                                  <button
                                    onClick={() => toggleSavedPlaybook(post.id)}
                                    className="w-full flex items-center gap-3 px-4 py-2 text-sm font-bold text-[color:var(--foreground)] hover:bg-primary/5 transition-colors text-left"
                                  >
                                    <BookMarked size={16} /> {savedPlaybookPostIds.includes(post.id) ? "Remove Playbook" : "Save Playbook"}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Post Content */}
                          <div className="whitespace-pre-wrap px-6 pb-5 text-base font-medium leading-relaxed text-[color:var(--foreground)] opacity-90">
                            {post.content.split(/(@[\w\s]+)/g).map((part, i) => 
                              part.startsWith("@") ? <span key={i} className="text-primary font-bold cursor-pointer hover:underline">{part}</span> : part
                            )}
                          </div>
                          
                          {/* Post Image */}
                          {post.image_url && (
                            <div className="px-5 pb-5">
                              <div className="overflow-hidden rounded-2xl border border-[color:var(--border)] group/img relative">
                                <img src={post.image_url} className="w-full max-h-[500px] object-cover transition-transform duration-700 group-hover/img:scale-105" alt="" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity" />
                              </div>
                            </div>
                          )}
                          
                          {/* Post Actions */}
                          <div className="flex items-center justify-between border-t border-[color:var(--border)] bg-[color:var(--muted)]/45 px-6 py-3.5 dark:border-[#2d466b] dark:bg-[#10243f]">
                            <div className="relative flex flex-wrap gap-1.5">
                              {renderReactionBursts(`post-${post.id}`)}
                              {EMOJI_OPTIONS.map(({ char }) => {
                                const count = post.reactions.filter(r => r.emoji === char).length;
                                const isReacted = post.reactions.some(r => r.emoji === char && r.author_email === session.user.email);
                                if (count === 0 && !isReacted) return null;
                                return (
                                  <button 
                                    key={char} onClick={() => handleReaction(post.id, char, "post")}
                                    className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition-all ${isReacted ? "border-primary/20 bg-primary/10 text-primary" : "border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--foreground)]"}`}
                                  >
                                    <span>{char}</span> 
                                    <span>{count}</span>
                                  </button>
                                )
                              })}
                              
                              <div className="relative group/react">
                                <button className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/5 text-primary transition-all hover:bg-primary hover:text-white"><SmilePlus size={18} /></button>
                                <div className="absolute bottom-full left-0 opacity-0 pointer-events-none group-hover/react:opacity-100 group-hover/react:pointer-events-auto transition-all translate-y-2 group-hover/react:translate-y-0 z-50 pb-3">
                                  <div className="flex gap-1 rounded-full border border-[color:var(--border)] bg-[color:var(--card)]/90 p-2 shadow-2xl backdrop-blur-2xl dark:border-[#3a5885] dark:bg-[#10243f]/95">
                                    {EMOJI_OPTIONS.map(({ char }) => (
                                      <button key={char} onClick={() => handleReaction(post.id, char, "post")} className="h-10 w-10 flex items-center justify-center text-xl rounded-full hover:bg-primary/10 transition-colors">{char}</button>
                                    ))}
                                  </div>
                                  <div className="absolute bottom-0 left-0 right-0 h-3" /> {/* Invisible Bridge */}
                                </div>
                              </div>
                            </div>
                            
                            <button className="flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--muted-foreground)] transition-all hover:bg-primary/5 hover:text-primary">
                              <MessageSquare size={16} /> {post.comments.length} Comments
                            </button>
                          </div>
                          
                          {/* Comments Section */}
                          <div className="flex flex-col gap-5 bg-[color:var(--card)] px-6 pb-6 pt-5 dark:bg-[#0e1f36]">
                            {post.comments.length > 0 && (
                              <div className="flex flex-col gap-5">
                                {post.comments.map(comment => {
                                  const commentAvatar = comment.author_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.author_name || "U")}&background=random`;
                                  const isMyComment = comment.author_email === session.user.email;
                                  return (
                                    <div key={comment.id} className="group/comment flex gap-4">
                                      <button
                                        type="button"
                                        onClick={() => void openProfileViewer({
                                          email: comment.author_email,
                                          fullName: comment.author_name ?? null,
                                          avatarUrl: comment.author_avatar ?? null,
                                        })}
                                        className="h-9 w-9 shrink-0 overflow-hidden rounded-xl border border-[color:var(--border)] ring-2 ring-primary/5 transition-all hover:scale-[1.03] hover:ring-primary/25"
                                      >
                                        <img src={commentAvatar} className="h-full w-full object-cover" alt="" />
                                      </button>
                                      <div className="flex flex-col gap-1 flex-1">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-3">
                                            <button
                                              type="button"
                                              onClick={() => void openProfileViewer({
                                                email: comment.author_email,
                                                fullName: comment.author_name ?? null,
                                                avatarUrl: comment.author_avatar ?? null,
                                              })}
                                              className="font-bold text-sm tracking-tight transition-colors hover:text-primary"
                                            >
                                              {comment.author_name}
                                            </button>
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--muted-foreground)] opacity-40">{formatDistanceToNow(parseISO(comment.created_at), { addSuffix: true })}</span>
                                          </div>
                                          {isMyComment && <button onClick={() => handleDeleteComment(post.id, comment.id)} disabled={deletingCommentId === comment.id} className="flex h-6 w-6 items-center justify-center rounded-lg text-destructive opacity-0 transition-all hover:bg-destructive/10 group-hover/comment:opacity-100 disabled:cursor-not-allowed disabled:opacity-60">{deletingCommentId === comment.id ? <LoadingSpinner className="h-3 w-3" tone="danger" /> : <Trash2 size={12}/>}</button>}
                                        </div>
                                        <div className="rounded-2xl rounded-tl-none border border-[color:var(--border)] bg-[color:var(--muted)]/40 px-4 py-2.5 text-sm font-medium text-[color:var(--foreground)] opacity-90 shadow-sm dark:border-[#38557f] dark:bg-[#142944]">
                                          {comment.content.split(/(@[\w\s]+)/g).map((part, i) => part.startsWith("@") ? <span key={i} className="text-primary font-bold">{part}</span> : part)}
                                        </div>
                                        <div className="flex items-center gap-3 ml-2 mt-1">
                                          <button onClick={() => handleReply(comment.author_name || "", post.id)} className="text-[10px] font-bold uppercase tracking-widest text-primary opacity-0 group-hover/comment:opacity-100 transition-opacity">Reply</button>
                                          {/* Comment Reactions */}
                                          <div className="relative flex gap-1.5">
                                            {renderReactionBursts(`comment-${comment.id}`)}
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
                            <div className="relative flex items-center gap-4">
                              <img src={userAvatar} className="h-9 w-9 shrink-0 rounded-xl border border-[color:var(--border)] object-cover ring-2 ring-primary/5" alt="" />
                              <div className="flex-1 relative">
                                <form onSubmit={(e) => { e.preventDefault(); const input = e.currentTarget.elements.namedItem('comment') as HTMLInputElement; handleCommentSubmit(post.id, input.value); input.value = ''; }} className="relative flex items-center">
                                  <input id={`comment-input-${post.id}`} name="comment" type="text" disabled={commentingPostId === post.id} placeholder={replyTo ? `Replying to @${replyTo}... type @ to mention` : "Add a comment... type @ to mention"} className="h-11 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-4 pr-12 text-sm font-semibold outline-none ring-primary/5 transition-all focus:border-primary/30 focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#3b5a85] dark:bg-[#10233d]" onChange={(e) => {
                                    if(e.target.value.endsWith("@")) setMentionSearch(post.id);
                                    else if (!e.target.value.includes("@")) setMentionSearch(null);
                                  }} />
                                  <button type="submit" disabled={commentingPostId === post.id} className="absolute right-2.5 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/5 text-primary transition-all hover:bg-primary hover:text-white disabled:cursor-not-allowed disabled:opacity-60">{commentingPostId === post.id ? <LoadingSpinner className="h-3.5 w-3.5" /> : <Send size={15} />}</button>
                                </form>
                                {mentionSearch === post.id && (
                                  <div className="absolute bottom-full left-0 z-50 mb-2 flex w-64 flex-col gap-1 overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-2 shadow-2xl dark:border-[#3a5885] dark:bg-[#0f213a]">
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
              <motion.div key="profile" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mx-auto flex max-w-4xl flex-col gap-12">
                <div className="card-elevated relative overflow-hidden rounded-[3rem] border-primary/5 shadow-2xl dark:border-[#2f4a72] dark:bg-[#0d1f36]/92">
                  <div className="aspect-[3.5/1] w-full bg-[color:var(--muted)] relative group overflow-hidden border-b border-[color:var(--border)]">
                    {profile.cover_url ? (
                      <img src={profile.cover_url} className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105" alt="Cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-tr from-primary/20 via-primary/5 to-transparent" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                    <label className="absolute bottom-6 right-8 h-10 px-4 bg-black/60 backdrop-blur-xl border border-white/10 text-white rounded-xl cursor-pointer opacity-0 group-hover:opacity-100 transition-all flex items-center gap-2.5 font-bold text-xs hover:bg-black/80"><Camera size={16} /> Update Cover <input type="file" accept="image/*" className="hidden" onChange={(e) => { if(e.target.files?.[0]) { notifyLargeImageSelection(e.target.files[0], "Cover photo"); handleProfileImageUpload(e.target.files[0], "cover"); } }} /></label>
                  </div>
                  <div className="relative px-6 pb-12 sm:px-10 md:px-16">
                    <div className="flex justify-between items-start">
                      <div className="relative -mt-16 md:-mt-20 group inline-block">
                        <div className="h-32 w-32 md:h-40 md:w-40 rounded-[2.5rem] border-[6px] border-[color:var(--card)] bg-[color:var(--card)] overflow-hidden shadow-2xl relative ring-1 ring-primary/5">
                          <img src={userAvatar} className="w-full h-full object-cover" alt="Avatar" />
                        </div>
                        <label className="absolute inset-0 flex items-center justify-center bg-black/50 text-white rounded-[2.5rem] cursor-pointer opacity-0 group-hover:opacity-100 transition-all border-4 border-transparent group-hover:border-primary/20"><Camera size={28} /> <input type="file" accept="image/*" className="hidden" onChange={(e) => { if(e.target.files?.[0]) { notifyLargeImageSelection(e.target.files[0], "Profile photo"); handleProfileImageUpload(e.target.files[0], "avatar"); } }} /></label>
                      </div>
                      <div className="pt-8 flex items-center gap-4">{isUpdatingProfile && <LoadingRail label="Syncing Profile" />}</div>
                    </div>
                    <form onSubmit={(e) => handleProfileUpdate(e, (e.currentTarget.elements.namedItem('bio') as HTMLTextAreaElement).value, (e.currentTarget.elements.namedItem('name') as HTMLInputElement).value)} className="mt-8 flex flex-col gap-8">
                      <div><input name="name" defaultValue={profile.full_name} className="font-heading w-full bg-transparent text-3xl font-extrabold tracking-tight text-[color:var(--foreground)] outline-none transition-all focus:border-primary/30 border-b-2 border-transparent sm:text-4xl lg:text-5xl" /> <div className="mt-2 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.2em] text-primary opacity-80">{session.user.email}</div></div>
                      <div><label className="mb-3 block text-[10px] font-bold uppercase tracking-[0.3em] text-[color:var(--muted-foreground)] opacity-60">Bio / Role</label><textarea name="bio" defaultValue={profile.bio || ""} placeholder="Describe your role..." className="min-h-[120px] w-full max-w-3xl resize-none rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--input)] p-5 text-lg font-medium leading-relaxed outline-none ring-primary/5 transition-all focus:border-primary/30 focus:ring-4 shadow-inner dark:border-[#3a5885] dark:bg-[#12263f]/85" /></div>
                      <div className="flex justify-end pt-4"><button type="submit" disabled={isUpdatingProfile} className="button-primary h-12 px-8 rounded-2xl font-bold text-base shadow-xl shadow-primary/20">Save Profile</button></div>
                    </form>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-8 px-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
                  <section className="rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--card)]/90 p-6 dark:border-[#35527c] dark:bg-[#10243d]/92">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="font-heading text-xl font-black tracking-tight flex items-center gap-2"><FileText size={18} className="text-primary" /> Brief Capsules</h3>
                      <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">{myReports.length} total</span>
                    </div>
                    {myReports.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-[color:var(--border)] px-4 py-8 text-center text-xs italic text-[color:var(--muted-foreground)]">No reports recorded yet.</div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {myReportCapsules.slice(0, 30).map((report) => (
                          <button
                            key={report.id}
                            onClick={() => setSelectedReport(report)}
                            className="rounded-full border border-[color:var(--border)] bg-[color:var(--card)] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-[color:var(--foreground)] transition-all hover:border-primary/30 hover:text-primary dark:border-[#3b5986] dark:bg-[#122844]"
                          >
                            {format(parseISO(report.report_date), "MMM d")}
                          </button>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--card)]/90 p-6 dark:border-[#35527c] dark:bg-[#10243d]/92">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="font-heading text-xl font-black tracking-tight flex items-center gap-2"><Activity size={18} className="text-primary" /> My Posts</h3>
                      <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">{myFeedPosts.length} posts</span>
                    </div>
                    {myFeedPosts.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-[color:var(--border)] px-4 py-8 text-center text-xs italic text-[color:var(--muted-foreground)]">No posts shared yet.</div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                        {myFeedPosts.slice(0, 12).map((post) => (
                          <button
                            key={post.id}
                            type="button"
                            onClick={() => setViewingPost(post)}
                            className="group relative aspect-square overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--muted)]/35 transition-all hover:border-primary/30 dark:border-[#3a5885] dark:bg-[#132a45]"
                          >
                            {post.image_url ? (
                              <img src={post.image_url} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" alt="" />
                            ) : (
                              <div className="flex h-full w-full items-end bg-gradient-to-tr from-primary/15 via-transparent to-primary/8 p-3 text-left">
                                <p className="line-clamp-4 text-xs font-semibold leading-snug text-[color:var(--foreground)]/85">{post.content}</p>
                              </div>
                            )}
                            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-2 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-white/90 opacity-0 transition-opacity group-hover:opacity-100">
                              Open Post
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              </motion.div>
            )}

            {/* DASHBOARD: TEAM */}
            {!isLoading && !isComposing && !selectedReport && activeTab === "dashboard" && (
              <motion.div key="dashboard" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-10">
                {dashboardMembers.length === 0 ? (
                  <div className="rounded-[1.75rem] border border-dashed border-[color:var(--border)] px-6 py-14 text-center text-sm font-semibold italic text-[color:var(--muted-foreground)]">
                    No team members found yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                    {dashboardMembers.map((member) => {
                      const memberEmail = (member.user_email || "").toLowerCase();
                      const memberReports = reports.filter(
                        (report) =>
                          ((report.author_email || "").toLowerCase() === memberEmail) ||
                          (!report.author_email && report.author_name === member.full_name)
                      );
                      const memberPosts = posts.filter((post) => (post.author_email || "").toLowerCase() === memberEmail);
                      const latestReport = [...memberReports].sort((a, b) => +new Date(b.report_date) - +new Date(a.report_date))[0];
                      const avatar = member.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.full_name)}&background=random&size=128&bold=true`;

                      return (
                        <button
                          key={member.user_email || member.id}
                          onClick={() => {
                            setSelectedAuthor(member.full_name);
                            setSelectedAuthorEmail(memberEmail || null);
                            setActiveTab("reports");
                            setReportsViewMode("list");
                          }}
                          className="card-elevated group relative flex cursor-pointer flex-col gap-4 overflow-hidden rounded-[2rem] border border-primary/10 bg-[color:var(--card)]/90 p-6 text-left transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl dark:border-[#324f79] dark:bg-[#10243f]/90"
                        >
                          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                          <div className="relative flex items-center gap-4">
                            <img src={avatar} alt={member.full_name} className="h-14 w-14 rounded-2xl border border-[color:var(--border)] object-cover shadow-sm" />
                            <div className="min-w-0">
                              <h4 className="truncate font-heading text-lg font-black tracking-tight">{member.full_name}</h4>
                              <p className="truncate text-[11px] font-semibold text-[color:var(--muted-foreground)]">{member.user_email}</p>
                            </div>
                          </div>
                          <div className="relative grid grid-cols-3 gap-2">
                            <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]/35 px-2.5 py-2 text-center">
                              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[color:var(--muted-foreground)]">Briefs</p>
                              <p className="mt-1 text-base font-black text-primary">{memberReports.length}</p>
                            </div>
                            <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]/35 px-2.5 py-2 text-center">
                              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[color:var(--muted-foreground)]">Posts</p>
                              <p className="mt-1 text-base font-black text-primary">{memberPosts.length}</p>
                            </div>
                            <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]/35 px-2.5 py-2 text-center">
                              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[color:var(--muted-foreground)]">Last</p>
                              <p className="mt-1 text-[11px] font-black uppercase tracking-[0.08em] text-primary">
                                {latestReport ? format(parseISO(latestReport.report_date), "MMM d") : "--"}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {/* REPORTS VIEW */}
            {!isLoading && !isComposing && !selectedReport && activeTab === "reports" && (
               <motion.div key="list" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-10">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    {selectedAuthor && <button onClick={() => { setActiveTab("dashboard"); setSelectedAuthor(null); setSelectedAuthorEmail(null); }} className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary hover:translate-x-1 transition-transform"><ArrowLeft size={14} /> Back to Team</button>}
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
                        <div key={report.id} className="card-elevated group flex flex-col rounded-[2rem] bg-gradient-to-br from-[color:var(--card)] to-transparent p-8 transition-all duration-500 hover:border-primary/20 hover:shadow-2xl dark:border-[#334f78] dark:bg-gradient-to-br dark:from-[#10233d] dark:to-transparent">
                          <div className="mb-5 flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary bg-primary/5 px-3 py-1.5 rounded-full">{format(parseISO(report.report_date), "MMM d, yyyy")}</span> <div className="h-8 w-8 rounded-xl bg-[color:var(--muted)] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"><ArrowLeft size={16} className="rotate-180" /></div></div>
                          <button onClick={() => setSelectedReport(report)} className="text-left">
                            <h3 className="mb-4 line-clamp-2 font-heading text-xl font-bold tracking-tight leading-tight group-hover:text-primary transition-colors">{report.formatted_report.split("\n")[0].replace(/[*#\-]/g, "")}</h3>
                          </button>
                          {!selectedAuthor && isCEO && (
                            <div className="mb-5 flex items-center gap-3">
                              <button 
                                type="button"
                                onClick={() => {
                                  void openProfileViewer({
                                    email: report.author_email,
                                    fullName: report.author_name,
                                    avatarUrl: reportAvatar,
                                  });
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
                  <div className="card-elevated rounded-[2.4rem] border-primary/10 bg-[color:var(--card)] p-8 shadow-2xl dark:border-[#2b4268] dark:bg-[#0c182b]/95">
                     <div className="mb-8 flex items-center justify-between">
                       <h2 className="font-heading text-3xl font-extrabold tracking-tight">{format(visibleMonth, "MMMM yyyy")}</h2> 
                       <div className="flex gap-2.5">
                         <button onClick={() => handleMonthChange("previous")} className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/20 bg-primary/5 text-primary transition-all hover:bg-primary hover:text-white dark:border-[#375683] dark:bg-[#142745] dark:text-[#b6d2ff] dark:hover:bg-primary dark:hover:text-white"><ChevronLeft size={20} /></button> 
                         <button onClick={() => handleMonthChange("next")} className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/20 bg-primary/5 text-primary transition-all hover:bg-primary hover:text-white dark:border-[#375683] dark:bg-[#142745] dark:text-[#b6d2ff] dark:hover:bg-primary dark:hover:text-white"><ChevronRight size={20} /></button>
                       </div>
                     </div>
                     <div className="mb-3 grid grid-cols-7 gap-3 text-center text-[10px] font-black uppercase tracking-[0.22em] text-primary/60 dark:text-[#8fb8ff]">
                       {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((dayName) => <div key={dayName} className="py-1">{dayName}</div>)}
                     </div>
                    <div className="grid grid-cols-7 gap-3">
                      {eachDayOfInterval({ start: startOfWeek(startOfMonth(visibleMonth), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(visibleMonth), { weekStartsOn: 1 }) }).map((day) => {
                        const dayReports = reportsToShow.filter((r) => isSameDay(parseISO(r.report_date), day));
                        const current = isSameMonth(day, visibleMonth);
                        const isToday = isSameDay(day, new Date());
                        return (
                           <div key={day.toISOString()} className={`flex min-h-[128px] flex-col rounded-[1.25rem] border p-3 transition-all duration-300 ${!current ? "border-transparent opacity-20 dark:opacity-30" : isToday ? "border-primary/30 bg-primary/10 shadow-sm shadow-primary/10 dark:border-primary/55 dark:bg-primary/15 dark:shadow-primary/20" : "border-[color:var(--border)] bg-[color:var(--muted)]/35 dark:border-[#2f456a] dark:bg-[#10233d]/80"} ${dayReports.length > 0 ? "hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary/5 dark:hover:border-primary/50 dark:hover:bg-primary/10" : ""}`}>
                             <div className="mb-2 flex items-center justify-between">
                               <span className={`text-sm font-black tracking-tight ${dayReports.length > 0 ? "text-primary dark:text-[#b8d5ff]" : "text-[color:var(--muted-foreground)] opacity-50 dark:opacity-80"} ${isToday ? "scale-110 origin-left" : ""}`}>{format(day, "d")}</span>
                               {dayReports.length > 0 && (
                                 <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary dark:bg-primary/20 dark:text-[#d7e8ff]">{dayReports.length}</span>
                               )}
                             </div>
                             <div className="mt-1 flex flex-col gap-1.5">
                               {dayReports.map((r, idx) => (
                                 <button key={idx} onClick={() => setSelectedReport(r)} className="w-full truncate rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--foreground)] transition-all hover:border-primary/30 hover:text-primary dark:border-[#3a5784] dark:bg-[#122845] dark:text-[#d9e8ff] dark:hover:border-primary/50 dark:hover:text-[#eaf2ff]">{selectedAuthor ? r.formatted_report.substring(0, 14) : r.author_name}</button>
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
               <div className="fixed inset-0 z-[920] flex items-start justify-center overflow-y-auto bg-black/45 p-3 pt-16 backdrop-blur-sm sm:p-6 sm:pt-20" onClick={resetComposer}>
                 <motion.div 
                   key="compose" 
                   initial={{ opacity: 0, scale: 0.95 }} 
                   animate={{ opacity: 1, scale: 1 }} 
                   exit={{ opacity: 0, scale: 0.95 }} 
                   className="my-2 flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] shadow-2xl max-h-[calc(100dvh-2rem)]"
                   onClick={(e) => e.stopPropagation()}
                 >
                  <header className="flex items-center justify-between px-6 py-4 border-b border-[color:var(--border)] bg-[color:var(--muted)]/30">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <Plus size={18} strokeWidth={2.5} />
                      </div>
                      <h3 className="text-base font-bold text-[color:var(--foreground)]">New Briefing</h3>
                    </div>
                    <button onClick={resetComposer} className="text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition-colors">
                      <X size={20} />
                    </button>
                  </header>

                  <form id="briefing-entry-form" onSubmit={handleReportSubmit} className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 custom-scrollbar">
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold text-[color:var(--muted-foreground)] uppercase tracking-wider">Report Date</label>
                      <input required type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--input)] text-sm font-medium focus:ring-2 ring-primary/20 outline-none transition-all" />
                    </div>

                    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]/35 p-4 dark:border-[#39567f] dark:bg-[#112741]">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="flex items-center gap-2 text-primary">
                            <Sparkles size={14} />
                            <h4 className="text-[11px] font-black uppercase tracking-[0.18em]">AI Copilot</h4>
                          </div>
                          <p className="mt-1 text-xs font-medium text-[color:var(--muted-foreground)]">Refine tone and clarity before generating the final briefing.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleOptimizeUpdates()}
                          disabled={isOptimizingUpdates || isSubmitting}
                          className="button-primary h-9 rounded-lg px-4 text-[10px] font-black uppercase tracking-[0.15em] disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {isOptimizingUpdates ? <LoadingSpinner className="h-3.5 w-3.5" tone="light" /> : <Sparkles size={13} />}
                          Optimize Draft
                        </button>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {([
                          { value: "executive", label: "Executive" },
                          { value: "concise", label: "Concise" },
                          { value: "impact", label: "Impact-Focused" },
                        ] as Array<{ value: OptimizeTone; label: string }>).map((tone) => (
                          <button
                            key={tone.value}
                            type="button"
                            onClick={() => setCopilotTone(tone.value)}
                            className={`rounded-lg border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] transition-all ${
                              copilotTone === tone.value
                                ? "border-primary/30 bg-primary/15 text-primary"
                                : "border-[color:var(--border)] text-[color:var(--muted-foreground)] hover:border-primary/20 hover:text-primary"
                            }`}
                          >
                            {tone.label}
                          </button>
                        ))}
                      </div>
                      {copilotPreview && (
                        <p className="mt-3 rounded-lg border border-primary/15 bg-primary/10 px-3 py-2 text-xs font-semibold text-[color:var(--foreground)]">
                          {copilotPreview}
                        </p>
                      )}
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

                            <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)]/70 p-3.5">
                              <div className="mb-2 flex items-center justify-between">
                                <label className="text-[11px] font-bold text-[color:var(--muted-foreground)] opacity-80">Completion (Optional)</label>
                                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-primary/80">
                                  {update.completionPercent ? `${update.completionPercent}%` : "Not set"}
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  step={1}
                                  inputMode="numeric"
                                  value={update.completionPercent}
                                  onChange={(e) => {
                                    const sanitized = e.target.value.replace(/[^\d]/g, "");
                                    const nextValue = sanitized === "" ? "" : String(Math.min(100, Number(sanitized)));
                                    const newU = [...updates];
                                    newU[idx].completionPercent = nextValue;
                                    setUpdates(newU);
                                  }}
                                  placeholder="0-100"
                                  className="h-10 w-28 rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-3 text-sm font-semibold outline-none focus:border-primary/50"
                                />
                                <div className="h-2 flex-1 overflow-hidden rounded-full bg-primary/10 dark:bg-primary/25">
                                  <div
                                    className="h-full rounded-full bg-gradient-to-r from-primary/55 to-primary transition-all duration-300"
                                    style={{ width: `${normalizeCompletionPercent(update.completionPercent) ?? 0}%` }}
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                              <label className="flex h-10 cursor-pointer items-center justify-between rounded-lg border border-dashed border-[color:var(--border)] bg-[color:var(--muted)]/30 px-3 transition-all hover:bg-[color:var(--muted)]/50 dark:border-[#3b5986] dark:bg-[#142842] dark:hover:bg-[#1a3151]">
                                <span className="text-xs text-[color:var(--muted-foreground)] truncate">{update.selectedImage ? update.selectedImage.name : "Choose file..."}</span>
                                <ImageIcon size={14} className="text-[color:var(--muted-foreground)]" />
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0] ?? null;
                                    if (file) notifyLargeImageSelection(file, `Attachment ${idx + 1}`);
                                    const newU = [...updates];
                                    newU[idx].selectedImage = file;
                                    setUpdates(newU);
                                  }}
                                  className="hidden"
                                />
                              </label>
                            </div>
                          </div>
                        </div>
                      ))}

                      <button 
                        type="button" 
                        onClick={() => setUpdates((prev) => [...prev, createEmptyUpdate()])} 
                        className="w-full py-2 flex items-center justify-center gap-2 text-xs font-bold text-primary hover:bg-primary/5 border border-dashed border-primary/20 rounded-lg transition-all"
                      >
                        <Plus size={14} strokeWidth={3} /> Add Project
                      </button>
                    </div>
                  </form>

                  <footer className="px-6 py-4 border-t border-[color:var(--border)] bg-[color:var(--muted)]/30 flex items-center justify-end gap-3">
                    <button type="button" onClick={resetComposer} className="px-4 py-2 text-sm font-bold text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition-colors">Cancel</button>
                    <button type="submit" form="briefing-entry-form" disabled={isSubmitting || isOptimizingUpdates || updates.some(u => !u.projectName || !u.workNotes)} className="button-primary px-5 py-2 h-9 rounded-lg text-xs font-bold uppercase tracking-wider">
                      {isSubmitting ? <LoadingSpinner className="h-4 w-4" tone="light" /> : "Save Briefing"}
                    </button>
                  </footer>
                 </motion.div>
               </div>
             )}

            {/* REPORT DETAIL VIEW */}
            {!isLoading && selectedReport && !isComposing && (() => {
              const authorProfile = profiles.find(p => p.user_email === selectedReport.author_email);
              const reportAvatar = authorProfile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedReport.author_name)}&background=random&size=48&bold=true`;
              const structuredUpdates = parseReportUpdates(selectedReport.raw_text);
              
              return (
                <motion.div key="detail" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="relative z-0 mx-auto flex w-full max-w-3xl flex-col gap-6 pb-6">
                  <div className="rounded-2xl border-2 border-[#c8b48f] bg-[#f8f1de] p-4 text-[#2d2922] shadow-[0_20px_45px_-24px_rgba(62,45,14,0.35)] dark:border-[#36527d] dark:bg-[#0f1e34] dark:text-[#d7e4fe] dark:shadow-[0_24px_56px_-30px_rgba(8,20,44,0.72)] sm:p-6">
                    <div className="mb-4 border-b-2 border-dotted border-[#d4c29f] pb-3 dark:border-[#37567f]">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => {
                              void openProfileViewer({
                                email: selectedReport.author_email,
                                fullName: selectedReport.author_name,
                                avatarUrl: reportAvatar,
                              });
                            }}
                            className="h-8 w-8 overflow-hidden rounded border border-[color:var(--border)]"
                          >
                            <img src={reportAvatar} alt="" className="h-full w-full object-cover" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void openProfileViewer({
                                email: selectedReport.author_email,
                                fullName: selectedReport.author_name,
                                avatarUrl: reportAvatar,
                              });
                            }}
                            className="text-xs font-bold uppercase tracking-[0.08em] hover:text-primary"
                          >
                            {selectedReport.author_name}
                          </button>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#635941] dark:text-[#a8bfdc]">Daily Report</span>
                      </div>
                      <div className="mt-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#635941] dark:text-[#a8bfdc]">
                        {format(parseISO(selectedReport.report_date), "EEE, MMM d, yyyy")}
                      </div>
                    </div>

                    <div className="rounded-md border border-[#d4c29f] bg-[#fffaf0] p-3 dark:border-[#3a5b87] dark:bg-[#132748] sm:p-4">
                      <CleanReport text={selectedReport.formatted_report} onViewImage={setViewingImage} />
                    </div>

                    {structuredUpdates.length > 0 && (
                      <div className="mt-4 rounded-md border border-dashed border-[#d4c29f] bg-[#fbf4e3] p-3 dark:border-[#3a5b87] dark:bg-[#11233f]">
                        <h4 className="mb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[#3e5f96] dark:text-[#9fc5ff]">Submitted Fields</h4>
                        <div className="space-y-2 text-[12px] font-mono">
                          {structuredUpdates.map((update, idx) => (
                            <div key={`${update.project_name}-${idx}`} className="border-b border-dotted border-[#d4c29f] pb-2 last:border-b-0 dark:border-[#35507a]">
                              <p className="font-bold uppercase tracking-[0.06em] text-[#3e5f96] dark:text-[#9fc5ff]">{update.project_name}</p>
                              <p>{update.work_notes}</p>
                              {update.next_steps && <p className="text-[#5f5542] dark:text-[#a8bfdc]">Next: {update.next_steps}</p>}
                              {update.blockers && <p className="text-[#5f5542] dark:text-[#a8bfdc]">Blockers: {update.blockers}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })()}

            {profileViewer}

            {/* SETTINGS VIEW */}
            {!isLoading && activeTab === "settings" && !isComposing && !selectedReport && (
               <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card-elevated max-w-3xl rounded-[2rem] border-primary/5 p-6 dark:border-[#2f4a72] dark:bg-[#0f223d]/92 sm:p-10 md:rounded-[2.5rem] md:p-12">
                <h3 className="mb-10 font-heading text-3xl font-black tracking-tight text-primary">System Configuration</h3>
                <div className="space-y-8">
                  <div className="rounded-2xl border border-[color:var(--border)] bg-black/5 p-6 dark:border-[#38547c] dark:bg-[#132843]">
                    <h4 className="mb-3 text-[10px] font-black uppercase tracking-[0.3em] text-primary">User Identity</h4>
                    <div className="flex items-center gap-4">
                      <img src={userAvatar} className="h-12 w-12 rounded-2xl border border-primary/10 object-cover" alt="" />
                      <div>
                        <div className="font-bold text-lg">{profile?.full_name || session.user.user_metadata.full_name || "User"}</div>
                        <div className="text-xs font-medium text-[color:var(--muted-foreground)]">{session.user.email}</div>
                      </div>
                    </div>
                  </div>

                  <form
                    onSubmit={(e) =>
                      handleProfileUpdate(
                        e,
                        (e.currentTarget.elements.namedItem("settings-bio") as HTMLTextAreaElement).value,
                        (e.currentTarget.elements.namedItem("settings-name") as HTMLInputElement).value
                      )
                    }
                    className="rounded-2xl border border-[color:var(--border)] bg-black/5 p-6 dark:border-[#38547c] dark:bg-[#132843]"
                  >
                    <h4 className="mb-4 text-[10px] font-black uppercase tracking-[0.3em] text-primary">Profile Controls</h4>
                    <div className="space-y-4">
                      <div>
                        <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Display Name</label>
                        <input
                          name="settings-name"
                          defaultValue={profile?.full_name || session.user.user_metadata.full_name || ""}
                          required
                          className="h-11 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 text-sm font-semibold outline-none focus:border-primary/35 dark:border-[#3a5986] dark:bg-[#102640]"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Bio</label>
                        <textarea
                          name="settings-bio"
                          defaultValue={profile?.bio || ""}
                          className="min-h-[90px] w-full resize-none rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2 text-sm font-semibold outline-none focus:border-primary/35 dark:border-[#3a5986] dark:bg-[#102640]"
                          placeholder="Describe your role and specialization..."
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <button type="submit" disabled={isUpdatingProfile} className="button-primary h-10 rounded-xl px-5 text-xs font-black uppercase tracking-[0.15em]">
                          {isUpdatingProfile ? <LoadingSpinner className="h-4 w-4" tone="light" /> : "Save Name & Bio"}
                        </button>
                        {isUpdatingProfile && <LoadingRail label="Syncing Profile" />}
                      </div>
                    </div>
                  </form>

                  <div className="rounded-2xl border border-[color:var(--border)] bg-black/5 p-6 dark:border-[#38547c] dark:bg-[#132843]">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-3">API Link</h4>
                    <p className="font-mono text-xs text-[color:var(--muted-foreground)] tracking-tight overflow-x-auto whitespace-nowrap">{API_BASE_URL}</p>
                  </div>
                  <div className="pt-2">
                    <button onClick={() => supabase.auth.signOut()} className="flex items-center gap-3 px-6 h-12 rounded-xl bg-destructive/5 text-destructive font-black uppercase tracking-[0.2em] text-[10px] border border-destructive/10 hover:bg-destructive hover:text-white transition-all w-fit">
                      Sign Out
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
      {commandPalette}
      {notificationsCenter}
      {postViewer}
      {attachmentViewer}
    </div>
  );
}
