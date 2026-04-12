"use client";

import { format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns";
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
  CalendarDays
} from "lucide-react";

type ReportRecord = {
  id: string;
  report_date: string;
  author_name: string;
  raw_text: string;
  formatted_report: string;
  image_url?: string | null;
  created_at?: string | null;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function requestReports(token: string): Promise<ReportRecord[]> {
  const response = await fetch(`${API_BASE_URL}/reports`, {
    method: "GET",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Failed to fetch reports`);
  return response.json();
}

async function createReport(formData: FormData, token: string): Promise<{ provider: string; report: ReportRecord }> {
  const response = await fetch(`${API_BASE_URL}/submit-report`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`
    },
    body: formData,
  });
  if (!response.ok) throw new Error("Submission failed");
  return response.json();
}

function CleanReport({ text }: { text: string }) {
  const lines = text.split("\n");
  
  return (
    <div className="flex flex-col gap-4 text-[color:var(--foreground)]">
      {lines.map((line, i) => {
        if (!line.trim()) return null;
        
        const isHeader = line.startsWith("#");
        const isBullet = line.trim().startsWith("-") || line.trim().startsWith("*");
        
        let content = line
          .replace(/^[#\-*]+\s*/, "")
          .replace(/\*\*(.*?)\*\*/g, "$1")
          .replace(/\*(.*?)\*/g, "$1");
          
        if (isHeader) {
          return (
            <h3 key={i} className="mt-4 font-serif text-xl font-semibold text-[color:var(--foreground)]">
              {content}
            </h3>
          );
        }
        
        if (isBullet) {
          return (
            <div key={i} className="relative pl-5 text-base leading-relaxed text-[color:var(--muted-foreground)] before:absolute before:left-0 before:top-2.5 before:h-[6px] before:w-[6px] before:rounded-full before:bg-[color:var(--border)]">
              {content}
            </div>
          );
        }
        
        return (
          <p key={i} className="text-base leading-relaxed text-[color:var(--muted-foreground)]">
            {content}
          </p>
        );
      })}
    </div>
  );
}

// Authentication Component
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
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            }
          }
        });
        if (signUpError) throw signUpError;
        if (data.session) onAuthSuccess(data.session);
        else setError("Please check your email to verify your account.");
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        if (data.session) onAuthSuccess(data.session);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[color:var(--background)] p-4 text-[color:var(--foreground)]">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card-elevated w-full max-w-md p-8 sm:p-12">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--primary)]/10 text-[color:var(--primary)]">
            <img src="/logo.png" alt="Company Logo" className="h-10 w-10 object-contain" />
          </div>
          <h1 className="font-serif text-2xl font-bold tracking-tight">Autolinium</h1>
          <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">Sign in to your team's execution log.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {isSignUp && (
            <div>
              <label className="mb-1.5 block text-sm font-medium">Full Name</label>
              <div className="relative">
                <UserIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--muted-foreground)]" />
                <input
                  required
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="input-field pl-10"
                  placeholder="John Doe"
                />
              </div>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium">Email Address</label>
            <div className="relative">
              <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--muted-foreground)]" />
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field pl-10"
                placeholder="you@company.com"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Password</label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--muted-foreground)]" />
              <input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field pl-10"
                placeholder="••••••••"
              />
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

export default function Dashboard() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  const [session, setSession] = useState<Session | null>(null);
  
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState<"dashboard" | "reports" | "settings">("dashboard");
  const [reportsViewMode, setReportsViewMode] = useState<"list" | "calendar">("list");
  const [visibleMonth, setVisibleMonth] = useState<Date>(new Date());

  const [selectedReport, setSelectedReport] = useState<ReportRecord | null>(null);
  const [selectedAuthor, setSelectedAuthor] = useState<string | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  
  const [rawText, setRawText] = useState("");
  const [reportDate, setReportDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setMounted(true);
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setIsLoading(false);
      return;
    }

    let isCancelled = false;
    async function load() {
      setIsLoading(true);
      try {
        const data = await requestReports(session!.access_token);
        const validData = data.map((r, i) => ({ 
          ...r, 
          id: r.id || `temp-${i}`,
          author_name: r.author_name || "Unknown" 
        }));
        if (!isCancelled) setReports(validData);
      } catch (err) {
        console.error(err);
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }
    void load();
    return () => { isCancelled = true; };
  }, [session]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("raw_text", rawText.trim());
      formData.append("report_date", reportDate);
      if (selectedImage) formData.append("image", selectedImage);

      await createReport(formData, session.access_token);
      const data = await requestReports(session.access_token);
      setReports(data.map((r, i) => ({ 
        ...r, 
        id: r.id || `temp-${i}`,
        author_name: r.author_name || "Unknown" 
      })));
      
      setRawText("");
      setSelectedImage(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setIsComposing(false);
      
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  // Calendar Logic
  const monthStart = startOfMonth(visibleMonth);
  const monthEnd = endOfMonth(visibleMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  function handleMonthChange(direction: "previous" | "next") {
    setVisibleMonth((current) =>
      direction === "previous" ? subMonths(current, 1) : addMonths(current, 1)
    );
  }

  if (!mounted) return null;

  if (!session) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return (
        <div className="flex h-screen items-center justify-center bg-[color:var(--background)] p-6 text-center text-[color:var(--foreground)]">
          <div className="card-elevated p-8 max-w-lg">
            <h2 className="font-serif text-2xl font-bold text-[color:var(--destructive)] mb-4">Configuration Error</h2>
            <p className="text-[color:var(--muted-foreground)]">
              Missing <code className="bg-[color:var(--muted)] px-1 rounded">NEXT_PUBLIC_SUPABASE_URL</code> and/or <code className="bg-[color:var(--muted)] px-1 rounded">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
              <br/><br/>
              Please add them to your <code className="bg-[color:var(--muted)] px-1 rounded">.env.local</code> file and restart the development server.
            </p>
          </div>
        </div>
      );
    }
    return <AuthScreen onAuthSuccess={setSession} />;
  }

  const uniqueAuthors = Array.from(new Set(reports.map(r => r.author_name).filter(Boolean)));
  const displayedReports = selectedAuthor 
    ? reports.filter(r => r.author_name === selectedAuthor) 
    : reports;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[color:var(--background)] text-[color:var(--foreground)]">
      
      {/* SIDEBAR */}
      <aside className="flex w-64 flex-col border-r border-[color:var(--border)] bg-[color:var(--card)] p-4 shadow-sm">
        <div className="mb-8 px-2 pt-2 flex items-center gap-3">
          <img src="/logo.png" alt="Company Logo" className="h-8 w-8 object-contain" />
          <div>
            <h1 className="font-serif text-xl font-bold tracking-tight">Autolinium</h1>
            <p className="text-xs text-[color:var(--muted-foreground)]">Execution Log</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-2">
          <button 
            onClick={() => { setActiveTab("dashboard"); setSelectedReport(null); setSelectedAuthor(null); }}
            className={`sidebar-nav-item ${activeTab === "dashboard" ? "active" : ""}`}
          >
            <LayoutDashboard size={18} />
            CEO Dashboard
          </button>
          <button 
            onClick={() => { setActiveTab("reports"); setSelectedReport(null); setSelectedAuthor(null); }}
            className={`sidebar-nav-item ${activeTab === "reports" && !selectedAuthor ? "active" : ""}`}
          >
            <FileText size={18} />
            All Briefings
          </button>
          <button 
            onClick={() => { setActiveTab("settings"); setSelectedReport(null); }}
            className={`sidebar-nav-item ${activeTab === "settings" ? "active" : ""}`}
          >
            <Settings size={18} />
            Settings
          </button>
        </nav>

        <div className="mt-auto flex flex-col gap-4 border-t border-[color:var(--border)] pt-4">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="h-8 w-8 overflow-hidden rounded-full bg-[color:var(--muted)]">
              <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(session.user.user_metadata.full_name || session.user.email)}&background=random`} alt="" />
            </div>
            <div className="flex flex-col truncate text-left">
              <span className="truncate text-sm font-medium">{session.user.user_metadata.full_name || "User"}</span>
              <span className="truncate text-xs text-[color:var(--muted-foreground)]">{session.user.email}</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between rounded-lg border border-[color:var(--border)] bg-[color:var(--input)] p-1">
            <button
              onClick={() => setTheme("light")}
              className={`flex flex-1 items-center justify-center rounded-md p-1.5 transition-smooth ${theme === "light" ? "bg-[color:var(--card)] shadow-sm text-[color:var(--foreground)]" : "text-[color:var(--muted-foreground)]"}`}
            >
              <Sun size={14} />
            </button>
            <button
              onClick={() => setTheme("dark")}
              className={`flex flex-1 items-center justify-center rounded-md p-1.5 transition-smooth ${theme === "dark" ? "bg-[color:var(--card)] shadow-sm text-[color:var(--foreground)]" : "text-[color:var(--muted-foreground)]"}`}
            >
              <Moon size={14} />
            </button>
          </div>
          
          <button onClick={handleSignOut} className="sidebar-nav-item mt-2 text-[color:var(--destructive)] hover:bg-[color:var(--destructive)]/10 hover:text-[color:var(--destructive)]">
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto bg-[color:var(--background)]">
        
        {/* TOP BAR */}
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-[color:var(--border)] bg-[color:var(--background)]/80 px-8 backdrop-blur-md">
          <h2 className="font-serif text-xl font-semibold capitalize">
            {selectedReport 
              ? "Briefing Details" 
              : isComposing 
                ? "Draft New Briefing" 
                : activeTab === "reports" && selectedAuthor
                  ? `${selectedAuthor}'s Execution Log`
                  : activeTab === "dashboard"
                    ? "Team Members"
                    : activeTab}
          </h2>
          
          {!isComposing && !selectedReport && (
            <button onClick={() => setIsComposing(true)} className="button-primary fade-in">
              <Plus size={16} />
              New Report
            </button>
          )}
        </header>

        <div className="container mx-auto max-w-6xl py-8">
          <AnimatePresence mode="wait">
            
            {/* LOADING STATE */}
            {isLoading && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex justify-center p-20">
                <Loader2 size={32} className="animate-spin text-[color:var(--primary)]" />
              </motion.div>
            )}

            {/* DASHBOARD: TEAM MEMBERS (CEO VIEW) */}
            {!isLoading && !isComposing && !selectedReport && activeTab === "dashboard" && (
              <motion.div key="dashboard" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-6 fade-in">
                {uniqueAuthors.length === 0 ? (
                  <div className="card-elevated p-12 text-center">
                    <Users size={48} className="mx-auto mb-4 text-[color:var(--muted-foreground)]" />
                    <h3 className="mb-2 font-serif text-xl font-semibold">No Team Members Found</h3>
                    <p className="text-[color:var(--muted-foreground)] mb-6">Once your team submits reports, they will appear here.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                    {uniqueAuthors.map(author => {
                      const authorReports = reports.filter(r => r.author_name === author);
                      return (
                        <button
                          key={author}
                          onClick={() => {
                            setSelectedAuthor(author);
                            setActiveTab("reports");
                            setReportsViewMode("list");
                          }}
                          className="card-elevated flex cursor-pointer flex-col items-center justify-center p-8 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                        >
                          <div className="mb-4 overflow-hidden rounded-full border-4 border-[color:var(--background)] shadow-sm">
                            <img 
                              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(author)}&background=random&size=128&font-size=0.33`} 
                              alt={author} 
                              className="h-20 w-20" 
                            />
                          </div>
                          <h4 className="font-serif text-lg font-semibold text-[color:var(--foreground)]">{author}</h4>
                          <p className="mt-1 text-sm font-medium text-[color:var(--muted-foreground)]">
                            {authorReports.length} {authorReports.length === 1 ? "Update" : "Updates"}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {/* REPORTS TIMELINE & CALENDAR VIEW */}
            {!isLoading && !isComposing && !selectedReport && activeTab === "reports" && (
              <motion.div key="list" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-6 fade-in">
                
                {selectedAuthor && (
                  <div className="mb-2 flex items-center justify-between">
                    <button onClick={() => setActiveTab("dashboard")} className="button-secondary text-sm">
                      <ArrowLeft size={16} /> Back to Team
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <h3 className="font-serif text-2xl font-semibold">
                    {selectedAuthor ? `${selectedAuthor}'s Updates` : "All Briefings"}
                  </h3>
                  <div className="flex rounded-lg border border-[color:var(--border)] bg-[color:var(--input)] p-1">
                    <button
                      onClick={() => setReportsViewMode("list")}
                      className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-smooth ${reportsViewMode === "list" ? "bg-[color:var(--card)] shadow-sm text-[color:var(--foreground)]" : "text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"}`}
                    >
                      <LayoutList size={14} /> List
                    </button>
                    <button
                      onClick={() => setReportsViewMode("calendar")}
                      className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-smooth ${reportsViewMode === "calendar" ? "bg-[color:var(--card)] shadow-sm text-[color:var(--foreground)]" : "text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"}`}
                    >
                      <CalendarDays size={14} /> Calendar
                    </button>
                  </div>
                </div>

                {reportsViewMode === "calendar" ? (
                  <div className="card-elevated p-6 md:p-8">
                    <div className="mb-8 flex items-center justify-between">
                      <h2 className="font-serif text-2xl font-semibold text-[color:var(--foreground)]">
                        {format(visibleMonth, "MMMM yyyy")}
                      </h2>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleMonthChange("previous")}
                          className="flex h-10 w-10 items-center justify-center rounded-full text-[color:var(--muted-foreground)] hover:bg-[color:var(--muted)] hover:text-[color:var(--foreground)] transition-colors"
                        >
                          <ChevronLeft size={20} />
                        </button>
                        <button
                          onClick={() => handleMonthChange("next")}
                          className="flex h-10 w-10 items-center justify-center rounded-full text-[color:var(--muted-foreground)] hover:bg-[color:var(--muted)] hover:text-[color:var(--foreground)] transition-colors"
                        >
                          <ChevronRight size={20} />
                        </button>
                      </div>
                    </div>

                    <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs font-semibold uppercase tracking-wider text-[color:var(--muted-foreground)]">
                      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((dayName) => (
                        <div key={dayName} className="py-2">{dayName}</div>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-2 md:gap-3">
                      {calendarDays.map((day) => {
                        const dayReports = displayedReports.filter((report) => isSameDay(parseISO(report.report_date), day));
                        const isInCurrentMonth = isSameMonth(day, visibleMonth);

                        return (
                          <div
                            key={day.toISOString()}
                            className={`group relative flex min-h-[100px] flex-col p-2 md:p-3 rounded-xl border transition-all duration-200 ${!isInCurrentMonth ? "opacity-30 border-transparent bg-transparent" : dayReports.length > 0 ? "border-[color:var(--border)] bg-[color:var(--muted)]/30 hover:border-[color:var(--primary)]/50 hover:bg-[color:var(--muted)]/50" : "border-[color:var(--border)] bg-transparent"}`}
                          >
                            <span className={`text-sm font-semibold ${dayReports.length > 0 ? "text-[color:var(--foreground)]" : "text-[color:var(--muted-foreground)]"}`}>
                              {format(day, "d")}
                            </span>
                            
                            {dayReports.length > 0 && (
                              <div className="mt-2 flex flex-col gap-1.5 overflow-hidden">
                                {dayReports.slice(0, 2).map((report, idx) => (
                                  <button
                                    key={idx}
                                    onClick={() => setSelectedReport(report)}
                                    className="flex w-full items-center gap-1.5 truncate rounded-md bg-[color:var(--card)] px-2 py-1 text-left text-[11px] font-medium text-[color:var(--foreground)] shadow-sm hover:ring-1 hover:ring-[color:var(--primary)]"
                                  >
                                    <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--primary)]" />
                                    <span className="truncate">
                                      {selectedAuthor ? report.formatted_report.split("\n")[0].replace(/[*#\-]/g, "") : report.author_name}
                                    </span>
                                  </button>
                                ))}
                                {dayReports.length > 2 && (
                                  <span className="pl-2 text-[10px] font-medium text-[color:var(--muted-foreground)]">+{dayReports.length - 2} more</span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : displayedReports.length === 0 ? (
                  <div className="card-elevated p-12 text-center">
                    <Calendar size={48} className="mx-auto mb-4 text-[color:var(--muted-foreground)]" />
                    <h3 className="mb-2 font-serif text-xl font-semibold">No Activity Logged</h3>
                    <p className="text-[color:var(--muted-foreground)] mb-6">There are no briefings to display.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                    {displayedReports.map((report) => (
                      <button
                        key={report.id}
                        onClick={() => setSelectedReport(report)}
                        className="card-elevated flex cursor-pointer flex-col p-6 text-left transition-all duration-300 hover:shadow-md hover:border-[color:var(--primary)]/30"
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase tracking-wider text-[color:var(--primary)]">
                            {format(parseISO(report.report_date), "MMM d, yyyy")}
                          </span>
                          {report.image_url && <ImageIcon size={16} className="text-[color:var(--muted-foreground)]" />}
                        </div>
                        <h3 className="mb-3 line-clamp-2 font-serif text-lg font-semibold leading-tight text-[color:var(--foreground)]">
                          {report.formatted_report.split("\n")[0].replace(/[*#\-]/g, "")}
                        </h3>
                        {!selectedAuthor && (
                          <div className="mb-3 flex items-center gap-2 text-xs font-medium text-[color:var(--muted-foreground)]">
                            <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(report.author_name)}&background=random&size=32`} alt="" className="h-5 w-5 rounded-full" />
                            {report.author_name}
                          </div>
                        )}
                        <p className="mt-auto line-clamp-3 text-sm text-[color:var(--muted-foreground)]">
                          {report.raw_text}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* COMPOSE VIEW */}
            {!isLoading && isComposing && (
              <motion.div key="compose" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="card-elevated mx-auto max-w-3xl p-8">
                <div className="mb-8 flex items-center justify-between border-b border-[color:var(--border)] pb-6">
                  <h3 className="font-serif text-2xl font-semibold">Log Execution Details</h3>
                  <button onClick={() => setIsComposing(false)} className="text-[color:var(--muted-foreground)] transition-colors hover:text-[color:var(--foreground)]">
                    <X size={20} />
                  </button>
                </div>
                
                <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                  <div>
                    <label className="mb-2 block text-sm font-medium">Report Date</label>
                    <input
                      required
                      type="date"
                      value={reportDate}
                      onChange={(e) => setReportDate(e.target.value)}
                      className="input-field max-w-xs"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">Work Notes</label>
                    <textarea
                      required
                      minLength={10}
                      autoFocus
                      value={rawText}
                      onChange={(e) => setRawText(e.target.value)}
                      placeholder="Detail your operational achievements..."
                      className="input-field min-h-[160px] resize-y leading-relaxed"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">Proof of Work (Image)</label>
                    <label className="input-field flex cursor-pointer items-center justify-between hover:bg-[color:var(--muted)]">
                      <span className="truncate">{selectedImage ? selectedImage.name : "Browse files..."}</span>
                      <ImageIcon size={18} className="text-[color:var(--muted-foreground)]" />
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => setSelectedImage(e.target.files?.[0] ?? null)}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div className="mt-4 flex justify-end gap-3 border-t border-[color:var(--border)] pt-6">
                    <button type="button" onClick={() => setIsComposing(false)} className="button-secondary">Cancel</button>
                    <button type="submit" disabled={isSubmitting || rawText.trim().length < 10} className="button-primary">
                      {isSubmitting ? <><Loader2 size={16} className="animate-spin" /> Processing...</> : "Submit Briefing"}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            {/* REPORT DETAIL VIEW */}
            {!isLoading && selectedReport && !isComposing && (
              <motion.div key="detail" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="mx-auto flex max-w-4xl flex-col gap-6">
                <button onClick={() => setSelectedReport(null)} className="button-secondary w-fit">
                  <ArrowLeft size={16} /> Back
                </button>
                
                <div className="card-elevated p-8 md:p-12">
                  <div className="mb-10 border-b border-[color:var(--border)] pb-8">
                    <div className="mb-6 flex items-center gap-4">
                      <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(selectedReport.author_name)}&background=random&size=48`} alt="" className="h-12 w-12 rounded-full" />
                      <div>
                        <h4 className="font-semibold text-[color:var(--foreground)]">{selectedReport.author_name}</h4>
                        <span className="text-xs font-semibold uppercase tracking-wider text-[color:var(--primary)]">
                          {format(parseISO(selectedReport.report_date), "EEEE, MMMM do, yyyy")}
                        </span>
                      </div>
                    </div>
                    <h1 className="font-serif text-3xl font-bold tracking-tight md:text-4xl">
                      Executive Briefing
                    </h1>
                  </div>

                  <div className="mb-12">
                    <CleanReport text={selectedReport.formatted_report} />
                  </div>

                  {selectedReport.image_url && (
                    <div className="mb-12 border-t border-[color:var(--border)] pt-8">
                      <h4 className="mb-4 flex items-center gap-2 font-serif text-lg font-semibold">
                        <ImageIcon size={20} className="text-[color:var(--muted-foreground)]" />
                        Proof of Work / Attachments
                      </h4>
                      <div className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]">
                        <img
                          src={selectedReport.image_url}
                          alt="Proof of work"
                          className="w-full object-cover"
                        />
                      </div>
                    </div>
                  )}

                  <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]/50 p-6">
                    <h4 className="mb-3 flex items-center gap-2 font-serif text-sm font-semibold text-[color:var(--muted-foreground)]">
                      <FileText size={16} />
                      Raw Operational Notes
                    </h4>
                    <p className="whitespace-pre-wrap text-sm text-[color:var(--muted-foreground)]">
                      {selectedReport.raw_text}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* SETTINGS VIEW */}
            {!isLoading && activeTab === "settings" && !isComposing && !selectedReport && (
              <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card-elevated max-w-2xl p-8">
                <h3 className="mb-6 font-serif text-2xl font-semibold">System Configuration</h3>
                <p className="text-[color:var(--muted-foreground)] mb-8">Manage application settings and connected services.</p>
                
                <div className="space-y-6">
                  <div className="rounded-lg border border-[color:var(--border)] p-4">
                    <h4 className="font-medium">API Endpoint</h4>
                    <p className="mt-1 font-mono text-sm text-[color:var(--muted-foreground)]">{API_BASE_URL}</p>
                  </div>
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
