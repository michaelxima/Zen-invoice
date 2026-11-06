"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import {
  Sparkles, Mic, MicOff, Upload, FileText, ArrowRight,
  Lightbulb, X, CheckCircle2, Wand2, Volume2, AlertCircle,
  FileUp, Loader2, RotateCcw, ChevronRight
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
interface ParsedInvoice {
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  clientAddress: string;
  businessName: string;
  businessEmail: string;
  businessAddress: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  items: Array<{ description: string; quantity: number; unitPrice: number }>;
  taxRate: number;
  discountRate: number;
  notes: string;
}

// ── Web Speech API types ───────────────────────────────────────────────────────
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onend: () => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

// ── Sample prompts ─────────────────────────────────────────────────────────────
const SAMPLE_PROMPTS = [
  "Bill Acme Corp $2,500 for Web Application Design and $750 for API integration in USD, due in 14 days",
  "Invoice Nexus Interactive £1,200 for UI/UX Wireframing and £400 for prototype testing in GBP",
  "Send Starlight Media an invoice for €4,500 Brand Identity Package and €800 social media kit in EUR",
  "Create an invoice for 5 hours of legal consulting at $350 per hour for Johnson & Partners, with 10% tax",
];

// ── Main Component ─────────────────────────────────────────────────────────────
export default function AiCreatePage() {
  const router = useRouter();

  // Input modes
  const [activeMode, setActiveMode] = useState<"text" | "voice" | "upload">("text");
  const [prompt, setPrompt] = useState("");

  // Voice dictation state
  const [isRecording, setIsRecording] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const [voiceSupported, setVoiceSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // File upload state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [parsedResult, setParsedResult] = useState<ParsedInvoice | null>(null);

  // ── Voice recognition setup ──────────────────────────────────────────────────
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setVoiceSupported(false); return; }

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let final = "";
      let interim = "";
      for (let i = 0; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) final += r[0].transcript + " ";
        else interim += r[0].transcript;
      }
      if (final) setVoiceTranscript((prev) => prev + final);
      setInterimText(interim);
    };

    recognition.onend = () => setIsRecording(false);
    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error !== "aborted") setError(`Voice error: ${e.error}`);
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    return () => { recognition.stop(); };
  }, []);

  const toggleRecording = () => {
    if (!recognitionRef.current) return;
    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      setVoiceTranscript("");
      setInterimText("");
      setError("");
      recognitionRef.current.start();
      setIsRecording(true);
    }
  };

  // ── File drag-and-drop ───────────────────────────────────────────────────────
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) acceptFile(file);
  }, []);

  const acceptFile = (file: File) => {
    const allowed = ["application/pdf", "text/plain", "text/markdown",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword"];
    const ext = file.name.split(".").pop()?.toLowerCase();
    const validExt = ["pdf", "txt", "md", "doc", "docx"].includes(ext || "");
    if (!allowed.includes(file.type) && !validExt) {
      setError("Unsupported file type. Please upload a PDF, Word doc, or plain text file.");
      return;
    }
    setUploadedFile(file);
    setError("");
  };

  // ── Submit handler ───────────────────────────────────────────────────────────
  const handleGenerate = async (overrideText?: string) => {
    setError("");
    setParsedResult(null);

    const textToParse = overrideText
      || (activeMode === "voice" ? voiceTranscript + " " + interimText : prompt).trim();

    if (!textToParse && !uploadedFile) {
      setError("Please enter a description, record a voice memo, or upload a document.");
      return;
    }

    setLoading(true);
    try {
      let res: Response;

      if (uploadedFile) {
        // Multipart: send file + optional extra text
        const form = new FormData();
        form.append("file", uploadedFile);
        if (textToParse) form.append("prompt", textToParse);
        res = await fetch("/api/ai-parse", { method: "POST", body: form });
      } else {
        // JSON body
        res = await fetch("/api/ai-parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: textToParse }),
        });
      }

      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error || "Failed to parse invoice.");
        return;
      }

      setParsedResult(json.data as ParsedInvoice);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  };

  // Navigate to editor with pre-filled data
  const handleApplyAndEdit = () => {
    if (!parsedResult) return;
    // Store in sessionStorage for the editor to pick up
    sessionStorage.setItem("ai_prefill", JSON.stringify(parsedResult));
    router.push("/invoices/new?from=ai");
  };

  const handleReset = () => {
    setParsedResult(null);
    setPrompt("");
    setVoiceTranscript("");
    setInterimText("");
    setUploadedFile(null);
    setError("");
  };

  const combinedVoiceText = (voiceTranscript + " " + interimText).trim();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar currentPath="/ai-create" />

      <main className="flex-1 md:ml-64 p-6 md:p-10 max-w-3xl mx-auto">

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="pb-8 border-b border-slate-800">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-4">
            <Sparkles size={13} /> AI Invoice Generator
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight mb-2">
            Generate Invoice Instantly
          </h1>
          <p className="text-sm text-slate-400 max-w-xl">
            Type a description, dictate it out loud, or drop a PDF or Word document —
            the AI extracts all details and structures a ready-to-send invoice in seconds.
          </p>
        </div>

        {/* ── Mode selector ────────────────────────────────────────────────── */}
        <div className="mt-8 flex gap-2">
          {[
            { id: "text", label: "Type Prompt", icon: <FileText size={15} /> },
            { id: "voice", label: "Voice Dictate", icon: <Volume2 size={15} />, disabled: !voiceSupported },
            { id: "upload", label: "Upload Document", icon: <Upload size={15} /> },
          ].map((mode) => (
            <button
              key={mode.id}
              disabled={mode.disabled}
              onClick={() => setActiveMode(mode.id as "text" | "voice" | "upload")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-all
                ${activeMode === mode.id
                  ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20"
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white"}
                ${mode.disabled ? "opacity-40 cursor-not-allowed" : ""}
              `}
            >
              {mode.icon} {mode.label}
            </button>
          ))}
        </div>

        {/* ── Input area ───────────────────────────────────────────────────── */}
        <div className="mt-5 space-y-4">

          {/* Text mode */}
          {activeMode === "text" && (
            <div className="rounded-2xl bg-slate-900/60 border border-slate-800 focus-within:border-indigo-500/70 transition-all shadow-xl overflow-hidden">
              <textarea
                rows={5}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. Bill Acme Corp $3,500 for Mobile App Design and $500 for Cloud Hosting in USD, due in 30 days, 10% VAT…"
                className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none resize-none p-4"
              />
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800/80 bg-slate-950/40">
                <span className="text-xs text-slate-500">Natural language · any currency · any language</span>
                <button
                  onClick={() => handleGenerate()}
                  disabled={loading || !prompt.trim()}
                  className="py-2 px-5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all hover:scale-[1.02]"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {loading ? "Extracting…" : "Generate Invoice"}
                </button>
              </div>
            </div>
          )}

          {/* Voice mode */}
          {activeMode === "voice" && (
            <div className="rounded-2xl bg-slate-900/60 border border-slate-800 shadow-xl overflow-hidden">
              <div className="p-6 flex flex-col items-center gap-5">
                {/* Mic button */}
                <button
                  onClick={toggleRecording}
                  className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-2xl
                    ${isRecording
                      ? "bg-red-600 hover:bg-red-500 shadow-red-500/40 scale-110"
                      : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30 hover:scale-105"
                    }`}
                >
                  {isRecording && (
                    <span className="absolute inset-0 rounded-full bg-red-500/50 animate-ping" />
                  )}
                  {isRecording ? <MicOff size={30} className="text-white" /> : <Mic size={30} className="text-white" />}
                </button>

                <div className="text-center">
                  <p className={`text-sm font-semibold ${isRecording ? "text-red-400" : "text-slate-300"}`}>
                    {isRecording ? "Recording… speak your invoice" : "Tap to start recording"}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {isRecording ? "Tap again to stop" : "Describe client, services, amounts, and currency"}
                  </p>
                </div>

                {/* Live transcript */}
                {(combinedVoiceText || isRecording) && (
                  <div className="w-full min-h-[80px] p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-sm text-slate-300">
                    {combinedVoiceText || <span className="text-slate-600 animate-pulse">Listening…</span>}
                    {interimText && (
                      <span className="text-slate-500 italic"> {interimText}</span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800/80 bg-slate-950/40">
                <button
                  onClick={() => { setVoiceTranscript(""); setInterimText(""); }}
                  className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1"
                >
                  <RotateCcw size={12} /> Clear
                </button>
                <button
                  onClick={() => handleGenerate(combinedVoiceText)}
                  disabled={loading || !combinedVoiceText}
                  className="py-2 px-5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all hover:scale-[1.02]"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {loading ? "Extracting…" : "Generate from Voice"}
                </button>
              </div>
            </div>
          )}

          {/* Upload mode */}
          {activeMode === "upload" && (
            <div className="space-y-3">
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`rounded-2xl border-2 border-dashed transition-all cursor-pointer p-10 flex flex-col items-center gap-4
                  ${isDragging
                    ? "border-indigo-500 bg-indigo-500/5"
                    : uploadedFile
                    ? "border-emerald-500/50 bg-emerald-500/5"
                    : "border-slate-700 hover:border-slate-600 bg-slate-900/40"
                  }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,.md,.doc,.docx"
                  className="hidden"
                  onChange={(e) => { if (e.target.files?.[0]) acceptFile(e.target.files[0]); }}
                />

                {uploadedFile ? (
                  <>
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                      <FileUp size={24} className="text-emerald-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-white">{uploadedFile.name}</p>
                      <p className="text-xs text-emerald-400 mt-0.5">
                        {(uploadedFile.size / 1024).toFixed(1)} KB · Ready to extract
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setUploadedFile(null); }}
                      className="text-xs text-slate-500 hover:text-red-400 flex items-center gap-1"
                    >
                      <X size={12} /> Remove file
                    </button>
                  </>
                ) : (
                  <>
                    <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center">
                      <Upload size={24} className="text-slate-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-white">Drop your document here</p>
                      <p className="text-xs text-slate-500 mt-1">PDF, Word (.docx), or plain text — max 10 MB</p>
                    </div>
                    <span className="text-xs text-indigo-400 font-semibold border border-indigo-500/30 px-3 py-1 rounded-lg bg-indigo-500/10">
                      Browse Files
                    </span>
                  </>
                )}
              </div>

              {/* Optional extra context */}
              <div className="rounded-xl bg-slate-900/60 border border-slate-800 focus-within:border-indigo-500/60 transition-all overflow-hidden">
                <textarea
                  rows={2}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Optional: add extra context or corrections (e.g. 'Use 10% VAT, due in 14 days')"
                  className="w-full bg-transparent text-xs text-white placeholder-slate-600 focus:outline-none resize-none p-3"
                />
              </div>

              <button
                onClick={() => handleGenerate()}
                disabled={loading || !uploadedFile}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition-all hover:scale-[1.01]"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                {loading ? "Analyzing Document…" : "Extract Invoice from Document"}
              </button>
            </div>
          )}

          {/* ── Error state ─────────────────────────────────────────────────── */}
          {error && (
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-300">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* ── Parsed result preview ────────────────────────────────────────── */}
          {parsedResult && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-emerald-500/20">
                <CheckCircle2 size={18} className="text-emerald-400" />
                <div>
                  <p className="text-sm font-bold text-white">Invoice Structured Successfully</p>
                  <p className="text-xs text-slate-400">Review the extracted data below, then open the editor to finalize</p>
                </div>
              </div>

              <div className="p-5 grid grid-cols-2 gap-x-8 gap-y-3 text-xs">
                <InfoRow label="Invoice #" value={parsedResult.invoiceNumber} />
                <InfoRow label="Currency" value={parsedResult.currency} />
                <InfoRow label="Client" value={parsedResult.clientName} />
                <InfoRow label="Client Email" value={parsedResult.clientEmail} />
                {parsedResult.businessName && <InfoRow label="From" value={parsedResult.businessName} />}
                <InfoRow label="Due Date" value={parsedResult.dueDate} />
                <InfoRow label="Tax Rate" value={`${parsedResult.taxRate}%`} />
                <InfoRow label="Discount" value={`${parsedResult.discountRate}%`} />

                <div className="col-span-2 mt-1">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Line Items</p>
                  <div className="space-y-1.5">
                    {parsedResult.items.map((item, i) => (
                      <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                        <span className="text-slate-200 flex-1">{item.description}</span>
                        <span className="text-slate-400 mx-3">×{item.quantity}</span>
                        <span className="text-white font-mono font-semibold">{parsedResult.currency} {(item.quantity * item.unitPrice).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {parsedResult.notes && (
                  <div className="col-span-2">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Notes</p>
                    <p className="text-slate-300 leading-relaxed">{parsedResult.notes}</p>
                  </div>
                )}
              </div>

              <div className="px-5 py-4 border-t border-emerald-500/20 flex items-center justify-between">
                <button
                  onClick={handleReset}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors"
                >
                  <RotateCcw size={13} /> Start Over
                </button>
                <button
                  onClick={handleApplyAndEdit}
                  className="flex items-center gap-2 py-2.5 px-6 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/20 transition-all hover:scale-[1.02]"
                >
                  Open in Invoice Editor <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Sample prompts (text mode only) ─────────────────────────────── */}
        {activeMode === "text" && !parsedResult && (
          <div className="mt-8">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Lightbulb size={13} className="text-amber-400" /> Try an Example
            </p>
            <div className="space-y-2">
              {SAMPLE_PROMPTS.map((sample, idx) => (
                <button
                  key={idx}
                  onClick={() => { setPrompt(sample); }}
                  className="w-full text-left p-3 rounded-xl bg-slate-900/40 hover:bg-slate-900 border border-slate-800/80 hover:border-slate-700 text-xs text-slate-300 hover:text-white transition-all flex items-center justify-between group"
                >
                  <span>&quot;{sample}&quot;</span>
                  <ArrowRight size={13} className="text-slate-600 group-hover:text-indigo-400 transition-colors shrink-0 ml-3" />
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ── Small helper ───────────────────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
      <p className="text-slate-200 mt-0.5 font-medium truncate">{value}</p>
    </div>
  );
}

