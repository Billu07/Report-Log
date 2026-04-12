"use client";

import { format, parseISO } from "date-fns";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
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
  X
} from "lucide-react";

type ReportRecord = {
  id: string;
  report_date: string;
  raw_text: string;
  formatted_report: string;
  image_url?: string | null;
  created_at?: string | null;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

async function requestReports(): Promise<ReportRecord[]> {
  const response = await fetch(`${API_BASE_URL}/reports`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Failed to fetch reports`);
  return response.json();
}

async function createReport(formData: FormData): Promise<{ provider: string; report: ReportRecord }> {
  const response = await fetch(`${API_BASE_URL}/submit-report`, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) throw new Error("Submission failed");
  return response.json();
}

// Sophisticated editorial parser
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

export default function Dashboard() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState<"dashboard" | "reports" | "settings">("dashboard");
  const [selectedReport, setSelectedReport] = useState<ReportRecord | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  
  const [rawText, setRawText] = useState("");
  const [reportDate, setReportDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setMounted(true);
    let isCancelled = false;
    async function load() {
      try {
        const data = await requestReports();
        const validData = data.map((r, i) => ({ ...r, id: r.id || `temp-${i}` }));
        if (!isCancelled) setReports(validData);
      } catch (err) {
        console.error(err);
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }
    void load();
    return () => { isCancelled = true; };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("raw_text", rawText.trim());
      formData.append("report_date", reportDate);
      if (selectedImage) formData.append("image", selectedImage);

      await createReport(formData);
      const data = await requestReports();
      setReports(data.map((r, i) => ({ ...r, id: r.id || `temp-${i}` })));
      
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

  if (!mounted) return null; // Prevent hydration mismatch

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[color:var(--background)] text-[color:var(--foreground)]">
      
      {/* SIDEBAR */}
      <aside className="flex w-64 flex-col border-r border-[color:var(--border)] bg-[color:var(--card)] p-4 shadow-sm">
        <div className="mb-8 px-2 pt-2">
          <h1 className="font-serif text-xl font-bold tracking-tight">Report Auto.</h1>
          <p className="text-xs text-[color:var(--muted-foreground)]">Enterprise Edition</p>
        </div>

        <nav className="flex flex-1 flex-col gap-2">
          <button 
            onClick={() => { setActiveTab("dashboard"); setSelectedReport(null); }}
            className={`sidebar-nav-item ${activeTab === "dashboard" ? "active" : ""}`}
          >
            <LayoutDashboard size={18} />
            Dashboard
          </button>
          <button 
            onClick={() => { setActiveTab("reports"); setSelectedReport(null); }}
            className={`sidebar-nav-item ${activeTab === "reports" ? "active" : ""}`}
          >
            <FileText size={18} />
            Briefings
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
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto bg-[color:var(--background)]">
        
        {/* TOP BAR */}
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-[color:var(--border)] bg-[color:var(--background)]/80 px-8 backdrop-blur-md">
          <h2 className="font-serif text-xl font-semibold capitalize">
            {selectedReport ? "Briefing Details" : isComposing ? "Draft New Briefing" : activeTab}
          </h2>
          
          {!isComposing && !selectedReport && (
            <button onClick={() => setIsComposing(true)} className="button-primary fade-in">
              <Plus size={16} />
              New Report
            </button>
          )}
        </header>

        <div className="container mx-auto max-w-5xl py-8">
          <AnimatePresence mode="wait">
            
            {/* LOADING STATE */}
            {isLoading && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex justify-center p-20">
                <Loader2 size={32} className="animate-spin text-[color:var(--primary)]" />
              </motion.div>
            )}

            {/* DASHBOARD / REPORTS LIST */}
            {!isLoading && !isComposing && !selectedReport && activeTab !== "settings" && (
              <motion.div key="list" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-6 fade-in">
                {reports.length === 0 ? (
                  <div className="card-elevated p-12 text-center">
                    <Calendar size={48} className="mx-auto mb-4 text-[color:var(--muted-foreground)]" />
                    <h3 className="mb-2 font-serif text-xl font-semibold">No Activity Logged</h3>
                    <p className="text-[color:var(--muted-foreground)] mb-6">Create your first daily briefing to start the timeline.</p>
                    <button onClick={() => setIsComposing(true)} className="button-primary">Create Report</button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {reports.map((report) => (
                      <button
                        key={report.id}
                        onClick={() => setSelectedReport(report)}
                        className="card-elevated flex cursor-pointer flex-col p-5 text-left"
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase tracking-wider text-[color:var(--primary)]">
                            {format(parseISO(report.report_date), "MMM d, yyyy")}
                          </span>
                          {report.image_url && <ImageIcon size={16} className="text-[color:var(--muted-foreground)]" />}
                        </div>
                        <h3 className="mb-2 line-clamp-2 font-serif text-lg font-semibold text-[color:var(--foreground)]">
                          {report.formatted_report.split("\n")[0].replace(/[*#\-]/g, "")}
                        </h3>
                        <p className="line-clamp-3 text-sm text-[color:var(--muted-foreground)]">
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
              <motion.div key="compose" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="card-elevated max-w-3xl p-8">
                <div className="mb-6 flex items-center justify-between">
                  <h3 className="font-serif text-2xl font-semibold">Log Execution Details</h3>
                  <button onClick={() => setIsComposing(false)} className="text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition-colors">
                    <X size={20} />
                  </button>
                </div>
                
                <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                  <div>
                    <label className="mb-2 block text-sm font-medium">Work Notes</label>
                    <textarea
                      required
                      minLength={10}
                      autoFocus
                      value={rawText}
                      onChange={(e) => setRawText(e.target.value)}
                      placeholder="Detail your operational achievements..."
                      className="input-field min-h-[160px] resize-y"
                    />
                  </div>

                  <div className="flex flex-col gap-6 sm:flex-row sm:gap-4">
                    <div className="flex-1">
                      <label className="mb-2 block text-sm font-medium">Report Date</label>
                      <input
                        type="date"
                        value={reportDate}
                        onChange={(e) => setReportDate(e.target.value)}
                        className="input-field"
                      />
                    </div>
                    <div className="flex-1">
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
              <motion.div key="detail" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-6">
                <button onClick={() => setSelectedReport(null)} className="button-secondary w-fit">
                  <ArrowLeft size={16} /> Back to Briefings
                </button>
                
                <div className="card-elevated p-8 md:p-10">
                  <div className="mb-8 border-b border-[color:var(--border)] pb-8">
                    <span className="mb-2 inline-block rounded-full bg-[color:var(--primary)]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[color:var(--primary)]">
                      Executive Briefing
                    </span>
                    <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight md:text-4xl">
                      {format(parseISO(selectedReport.report_date), "EEEE, MMMM do, yyyy")}
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
                    <p className="mt-1 text-sm text-[color:var(--muted-foreground)] font-mono">{API_BASE_URL}</p>
                  </div>
                  <div className="rounded-lg border border-[color:var(--border)] p-4">
                    <h4 className="font-medium">Theme Preference</h4>
                    <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">Currently using {theme} mode.</p>
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
