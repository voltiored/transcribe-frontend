"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import type { Session } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
const MAX_UPLOAD_BYTES = 1200 * 1024 * 1024;
const UPLOAD_CHUNK_BYTES = 15 * 1024 * 1024;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

type Word = { word: string; start: number; end: number; is_emphasis?: boolean };
type Block = { id: string; start: number; end: number; text: string; words: Word[] };
type Style = {
  font: string; size: number; color: string; outline_color: string;
  bg_mode: string; bg_color: string; position: string; align: string;
  outline_w: number; shadow: number; bold: boolean; uppercase: boolean;
  karaoke: boolean; karaoke_unspoken_color: string; karaoke_emphasis_color: string;
  karaoke_emphasis_scale: number; custom_margin_v: number;
};
type Usage = { plan: string; plan_limit: number | null; videos_used: number; remaining: number | null };
type Watermark = { text: string; font: string; size: number; color: string; opacity: number; position: string };

const EMPTY_STYLE: Style = {
  font: "Bebas Neue", size: 92, color: "#FFFFFF", outline_color: "#000000",
  bg_mode: "Transparente", bg_color: "#000000", position: "Centro", align: "Centro",
  outline_w: 5, shadow: 2.5, bold: true, uppercase: true,
  karaoke: true, karaoke_unspoken_color: "#FFFFFF", karaoke_emphasis_color: "#FFD700",
  karaoke_emphasis_scale: 135, custom_margin_v: 350,
};

const PRESETS: Record<string, Partial<Style>> = {
  "Hormozi PRO 🎤✨": { ...EMPTY_STYLE },
  "MrBeast 🟡": { font: "Impact", size: 90, color: "#FFEA00", outline_color: "#000000", bg_mode: "Transparente", position: "Centro", align: "Centro", outline_w: 5, shadow: 2, bold: true, karaoke: false, uppercase: true },
  "Captions ⬛": { font: "Montserrat", size: 64, color: "#FFFFFF", outline_color: "#000000", bg_mode: "Caja negra", position: "Abajo", align: "Centro", outline_w: 0, shadow: 0, bold: true, karaoke: false, uppercase: false },
  "Hormozi Karaoke 🎤": {
    font: "Bebas Neue", size: 88, color: "#00E676", outline_color: "#000000",
    karaoke_unspoken_color: "#FFFFFF", karaoke_emphasis_color: "#FFD700",
    karaoke_emphasis_scale: 130, bg_mode: "Transparente", position: "Centro", align: "Centro",
    outline_w: 4, shadow: 2, bold: true, karaoke: true, uppercase: false,
  },
  "TikTok Pop 💜": {
    font: "Poppins", size: 70, color: "#FFFFFF", outline_color: "#8A2BE2",
    bg_mode: "Color personalizado", bg_color: "#8A2BE2", position: "Abajo", align: "Centro",
    outline_w: 2, shadow: 1, bold: true, karaoke: false, uppercase: false,
  },
  "Storytelling 📖": {
    font: "Inter", size: 56, color: "#FFFFFF", outline_color: "#000000",
    bg_mode: "Transparente", position: "Abajo", align: "Centro",
    outline_w: 1.5, shadow: 1.5, bold: false, karaoke: false, uppercase: false,
  },
  "Educativo 📚": {
    font: "Roboto", size: 60, color: "#FFFFFF", outline_color: "#0B3954",
    bg_mode: "Color personalizado", bg_color: "#0B3954", position: "Abajo", align: "Centro",
    outline_w: 1, shadow: 0, bold: true, karaoke: false, uppercase: false,
  },
  "Comedy 😂": {
    font: "Impact", size: 96, color: "#FFEA00", outline_color: "#D9001B",
    bg_mode: "Transparente", position: "Centro", align: "Centro",
    outline_w: 6, shadow: 3, bold: true, karaoke: false, uppercase: false,
  },
  "Karaoke Pink 🎶": {
    font: "Bebas Neue", size: 86, color: "#FF1F8F", outline_color: "#000000",
    karaoke_unspoken_color: "#00E5FF", karaoke_emphasis_color: "#FFD700",
    karaoke_emphasis_scale: 130, bg_mode: "Transparente", position: "Centro", align: "Centro",
    outline_w: 4, shadow: 2, bold: true, karaoke: true, uppercase: false,
  },
};

const FONTS = ["Inter", "Montserrat", "Arial", "Impact", "Bebas Neue", "Poppins", "Roboto", "Helvetica", "Verdana", "Tahoma"];
const BG_OPTS = ["Transparente", "Caja negra", "Color personalizado"];
const POS_OPTS = ["Arriba", "Centro", "Abajo", "Personalizada"];
const AL_OPTS = ["Izquierda", "Centro", "Derecha"];
const WM_POSITIONS = ["Abajo derecha", "Abajo izquierda", "Abajo centro", "Arriba derecha", "Arriba izquierda", "Arriba centro"];

const LANG_OPTS = [
  ["auto", "Detectar automáticamente"], ["es", "Español"], ["en", "English"],
  ["pt", "Português"], ["fr", "Français"], ["ca", "Català"], ["de", "Deutsch"],
  ["it", "Italiano"], ["ja", "日本語"], ["zh", "中文"],
] as const;

const TRANSLATE_OPTS = [
  ["English", "Inglés"], ["Spanish", "Español"], ["Portuguese (Brazilian)", "Portugués"],
  ["French", "Francés"], ["Catalan", "Català"], ["German", "Alemán"],
  ["Italian", "Italiano"], ["Japanese", "Japonés"], ["Chinese (Simplified)", "Chino"],
  ["Korean", "Coreano"], ["Hindi", "Hindi"], ["Arabic", "Árabe"],
] as const;

const PLAN_INFO: Record<string, { name: string; price: string; limit: string }> = {
  free: { name: "Gratis", price: "$0", limit: "3 vídeos/día" },
  basico: { name: "Básico", price: "$15/mes", limit: "20 vídeos/día" },
  pro: { name: "Pro", price: "$49/mes", limit: "100 vídeos/día" },
  for_life: { name: "For Life", price: "$199 único", limit: "Vídeos ilimitados" },
};

// ─────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────
function fmtTime(t: number): string {
  if (t < 0) t = 0;
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return `${h}:${String(m).padStart(2, "0")}:${s.toFixed(2).padStart(5, "0")}`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))} s`;
  return `${Math.floor(seconds / 60)} min`;
}

function redistributeWords(block: Block, newText: string): Block {
  const toks = newText.split(/\s+/).filter(Boolean);
  const dur = Math.max(0.001, block.end - block.start);
  const start = block.start;
  const words = toks.length
    ? toks.map((t, i) => ({ word: t, start: start + (dur / toks.length) * i, end: start + (dur / toks.length) * (i + 1) }))
    : [];
  return { ...block, text: newText, words };
}

function flattenWords(blocks: Block[]): Word[] {
  const flat: Word[] = [];
  for (const b of blocks) {
    if (b.words.length) {
      flat.push(...b.words.map((w) => ({ ...w })));
    } else {
      const toks = b.text.split(/\s+/).filter(Boolean);
      const dur = Math.max(0.001, b.end - b.start) / toks.length;
      toks.forEach((t, i) => flat.push({ word: t, start: b.start + dur * i, end: b.start + dur * (i + 1) }));
    }
  }
  return flat;
}

function groupWordsSmart(input: Word[], maxPerBlock: number): Block[] {
  const blocks: Block[] = [];
  let current: Word[] = [];
  for (let i = 0; i < input.length; i++) {
    const w = { ...input[i], is_emphasis: false };
    current.push(w);
    const nextW = i + 1 < input.length ? input[i + 1] : null;
    const gap = nextW ? nextW.start - w.end : 999;
    const token = w.word.trim();
    const endsStrong = !!token && ".!?".includes(token[token.length - 1]);
    const endsSoft = !!token && ",;:".includes(token[token.length - 1]);
    const shouldSplit =
      current.length >= maxPerBlock || !nextW || gap >= 0.35 || (endsStrong && current.length >= 1) || (endsSoft && current.length >= 2);
    if (shouldSplit && current.length) {
      const text = current.map((x) => x.word).join(" ").trim();
      if (text) {
        blocks.push({
          id: Math.random().toString(36).slice(2, 10),
          start: current[0].start,
          end: current[current.length - 1].end,
          text,
          words: current.map((x) => ({ ...x })),
        });
      }
      current = [];
    }
  }
  return blocks;
}

function downloadFile(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

function buildSrt(blocks: Block[]): string {
  const st = (t: number) => {
    const h = String(Math.floor(t / 3600)).padStart(2, "0");
    const m = String(Math.floor((t % 3600) / 60)).padStart(2, "0");
    const s = Math.floor(t % 60);
    const ms = Math.floor((t - Math.floor(t)) * 1000);
    return `${h}:${m}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
  };
  return blocks.map((b, i) => `${i + 1}\n${st(b.start)} --> ${st(b.end)}\n${b.text}\n`).join("\n");
}

function buildVtt(blocks: Block[]): string {
  const st = (t: number) => {
    const h = String(Math.floor(t / 3600)).padStart(2, "0");
    const m = String(Math.floor((t % 3600) / 60)).padStart(2, "0");
    const s = t % 60;
    return `${h}:${m}:${s.toFixed(3).padStart(6, "0")}`;
  };
  return ["WEBVTT", "", ...blocks.flatMap((b) => [`${st(b.start)} --> ${st(b.end)}`, b.text, ""])].join("\n");
}

// ─────────────────────────────────────────────────────────────
//  UI PRIMITIVES
// ─────────────────────────────────────────────────────────────
const inputCls =
  "w-full rounded-xl border border-[#394255] bg-[#1C2230]/80 px-3 py-2 text-sm text-[#E6EDF3] outline-none transition focus:border-[#F4C95D] focus:ring-1 focus:ring-[#F4C95D]/30";
const btnPrimary =
  "w-full rounded-xl bg-[#F4C95D] px-4 py-2.5 text-sm font-bold text-[#171717] shadow-[0_6px_18px_rgba(244,201,93,0.18)] transition hover:-translate-y-px hover:bg-[#FFD978] hover:shadow-[0_8px_22px_rgba(244,201,93,0.28)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0";
const btnGhost =
  "w-full rounded-xl border border-[#394255] bg-[#1C2230]/80 px-4 py-2.5 text-sm font-semibold text-[#E6EDF3] transition hover:border-[#F4C95D] hover:bg-[#252D3D] disabled:cursor-not-allowed disabled:opacity-40";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#2A3140] bg-[#161B22] p-3">
      <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[1.2px] text-[#8B949E]">
        <span className="h-2 w-2 rounded-full bg-[#8A2BE2] shadow-[0_0_8px_rgba(138,43,226,0.6)]" />
        {label}
      </div>
      {children}
    </div>
  );
}

function SelectField({ label, value, onChange, options, disabled }: {
  label: string; value: string; onChange: (v: string) => void; options: readonly string[]; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function closeOnOutsideClick(event: MouseEvent) {
      if (!selectRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [open]);

  return (
    <Field label={label}>
      <div ref={selectRef} className={`select-shell custom-select ${open ? "is-open" : ""}`}>
        <button
          type="button"
          className={`${inputCls} select-control custom-select-trigger`}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((visible) => !visible)}
        >
          <span>{optionLabel(value)}</span>
          <span className="custom-select-chevron">⌄</span>
        </button>
        {open && (
          <div className="custom-select-menu" role="listbox" aria-label={label}>
            {options.map((o) => (
              <button
                key={o}
                type="button"
                role="option"
                aria-selected={o === value}
                className={`custom-select-option ${o === value ? "is-selected" : ""}`}
                onClick={() => { onChange(o); setOpen(false); }}
              >
                {optionLabel(o)}
              </button>
            ))}
          </div>
        )}
        <select className="sr-only" tabIndex={-1} value={value} onChange={(e) => onChange(e.target.value)} aria-hidden="true">
          {options.map((o) => (
            <option key={o} value={o}>{optionLabel(o)}</option>
          ))}
        </select>
      </div>
    </Field>
  );
}

function Slider({ label, value, onChange, min, max, step, suffix }: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; suffix?: string;
}) {
  return (
    <Field label={`${label}${suffix ? ` · ${value}${suffix}` : ` · ${value}`}`}>
      <input
        type="range" min={min} max={max} step={step ?? 1} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#8A2BE2]"
      />
    </Field>
  );
}

const OPTION_LABELS: Record<string, string> = {
  auto: "Auto", openai: "OpenAI", local: "Local", free: "Free", claude: "Claude",
  es: "Español", en: "English", pt: "Português", fr: "Français", ca: "Català",
  de: "Deutsch", it: "Italiano", ja: "日本語", zh: "中文",
};

function optionLabel(option: string): string {
  if (!option) return "Traducir a...";
  return OPTION_LABELS[option] ?? (option ? option[0].toUpperCase() + option.slice(1) : option);
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded border border-[#2A3140] bg-transparent" />
        <input className={inputCls} value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </Field>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[#2A3140] bg-[#161B22] p-3">
      <span className="text-sm font-semibold text-[#E6EDF3]">{label}</span>
      <button
        type="button" onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition ${checked ? "bg-[#8A2BE2]" : "bg-[#2A3140]"}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  AUTH
// ─────────────────────────────────────────────────────────────
function AuthCard() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError("");
    setLoading(true);
    const { error: err } = mode === "login"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (err) setError(err.message);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0E1117] px-4 text-[#E6EDF3]">
      <div className="w-full max-w-md rounded-2xl border border-[#2A3140] bg-[#161B22] p-6">
        <h1 className="text-2xl font-extrabold">TranscribeThat</h1>
        <p className="mt-1 text-sm text-[#8B949E]">Subtítulos automáticos para tus vídeos</p>
        <div className="mt-6 space-y-3">
          <input className={inputCls} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className={inputCls} type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button className={btnPrimary} disabled={loading || !email || !password} onClick={submit}>
            {loading ? "Procesando..." : mode === "login" ? "Entrar" : "Crear cuenta"}
          </button>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button className={`${btnGhost} mt-2`} onClick={() => setMode(mode === "login" ? "register" : "login")}>
            {mode === "login" ? "Crear una cuenta" : "Ya tengo una cuenta"}
          </button>
        </div>
      </div>
    </div>
  );
}

const PRICING_PLANS = [
  { key: "basico", name: "Básico", price: "$15", period: "/mes", limit: "20 vídeos al día", features: ["Todo lo del plan gratis", "Hasta 20 vídeos/día", "Todos los presets y estilos"] },
  { key: "pro", name: "Pro", price: "$49", period: "/mes", limit: "100 vídeos al día", features: ["Todo lo de Básico", "Hasta 100 vídeos/día", "Transcripción por OpenAI", "Emphasis por Claude Haiku"] },
  { key: "for_life", name: "For Life", price: "$199", period: "único pago", limit: "Vídeos infinitos", features: ["Todo lo de Pro", "Vídeos ilimitados para siempre", "Sin cuotas recurrentes"] },
] as const;

function PricingCards({ current, onSelect, busy }: { current: string; onSelect: (plan: string) => void; busy: string }) {
  return (
    <div className="mb-6 rounded-2xl border border-[#8A2BE2]/40 bg-gradient-to-br from-[#1A1230] to-[#161B22] p-6">
      <h2 className="text-lg font-extrabold text-[#E6EDF3]">Elige tu plan</h2>
      <p className="mb-5 mt-1 text-sm text-[#8B949E]">Haz upgrade cuando quieras para seguir generando vídeos.</p>
      <div className="grid gap-4 sm:grid-cols-3">
        {PRICING_PLANS.map((p) => (
          <div key={p.key} className={`flex flex-col rounded-xl border p-5 ${current === p.key ? "border-[#8A2BE2] bg-[#8A2BE2]/10" : "border-[#2A3140] bg-[#161B22]"}`}>
            <div className="text-sm font-bold uppercase tracking-wide text-[#8A2BE2]">{p.name}</div>
            <div className="mt-2 text-3xl font-extrabold text-[#E6EDF3]">{p.price}<span className="text-sm font-medium text-[#8B949E]">{p.period}</span></div>
            <div className="mt-1 text-xs font-semibold text-[#E6EDF3]">{p.limit}</div>
            <ul className="mt-4 flex-1 space-y-1.5 text-xs text-[#8B949E]">{p.features.map((f) => <li key={f}>• {f}</li>)}</ul>
            <button className={`${btnPrimary} mt-5`} disabled={busy === p.key} onClick={() => onSelect(p.key)}>
              {busy === p.key ? "Abriendo Stripe..." : current === p.key ? "Plan actual" : "Mejorar plan"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function UsageBadge({ usage }: { usage: Usage | null }) {
  if (!usage) return null;
  const label = PLAN_INFO[usage.plan]?.name ?? usage.plan;
  const isUnlimited = usage.remaining === null;
  return (
    <div className="flex items-center gap-3 rounded-full border border-[#8A2BE2]/50 bg-[#8A2BE2]/10 px-4 py-1.5 text-xs font-semibold text-[#9D4BFF]">
      <span>{label}</span>
      <span className="h-3 w-px bg-[#8A2BE2]/40" />
      <span>{isUnlimited ? "∞ vídeos" : `${usage.remaining}/${usage.plan_limit} hoy`}</span>
    </div>
  );
}

function SectionTitle({ n, title }: { n: string; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[1.5px] text-[#8B949E]">
      <span className="flex h-[22px] w-[22px] items-center justify-center rounded-md bg-[#8A2BE2] text-xs font-bold text-white">{n}</span>
      {title}
      <span className="h-px flex-1 bg-[#2A3140]" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  MAIN PAGE
// ─────────────────────────────────────────────────────────────
export default function Page() {
  const [session, setSession] = useState<Session | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [transcribing, setTranscribing] = useState(false);
  const [transcriptionProgress, setTranscriptionProgress] = useState(0);
  const [transcriptionStage, setTranscriptionStage] = useState("");
  const [transcriptionEta, setTranscriptionEta] = useState(0);
  const [previewing, setPreviewing] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const [engineInfo, setEngineInfo] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [fullScreenDrop, setFullScreenDrop] = useState(false);
  const [showPlans, setShowPlans] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [language, setLanguage] = useState("auto");
  const [wordsPerBlock, setWordsPerBlock] = useState(3);
  const [engine, setEngine] = useState("auto");
  const [stripPunct, setStripPunct] = useState(false);
  const [emphasis, setEmphasis] = useState(true);
  const [emphasisEngine, setEmphasisEngine] = useState("auto");
  const [translateTo, setTranslateTo] = useState("");

  const [presetName, setPresetName] = useState("Hormozi PRO 🎤✨");
  const [style, setStyle] = useState<Style>(EMPTY_STYLE);
  const [wmOn, setWmOn] = useState(false);
  const [wm, setWm] = useState<Watermark>({ text: "@tu_usuario", font: "Inter", size: 36, color: "#FFFFFF", opacity: 0.7, position: "Abajo derecha" });

  const token = session?.access_token ?? "";
  const userId = session?.user?.id ?? "";

  function setStylePatch(patch: Partial<Style>) {
    setStyle((s) => ({ ...s, ...patch }));
    setPresetName("Personalizado");
  }

  const refreshUsage = useCallback(async () => {
    if (!userId || !token) return;
    try {
      const res = await fetch(`${BACKEND_URL}/usage/${userId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setUsage((await res.json()) as Usage);
    } catch {
      setUsage(null);
    }
  }, [userId, token]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => { if (session) void refreshUsage(); }, [session, refreshUsage]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success" && session) {
      const t = setTimeout(() => void refreshUsage().then(() => {
        window.history.replaceState({}, "", window.location.pathname);
      }), 2500);
      return () => clearTimeout(t);
    }
  }, [session, refreshUsage]);

  const limitReached = usage ? usage.remaining === 0 : false;
  const watermark = wmOn && wm.text.trim() ? wm : null;

  async function api(path: string, opts: RequestInit = {}) {
  const token = session?.access_token ?? "";
  let res: Response | undefined;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      res = await fetch(`${BACKEND_URL}${path}`, {
        ...opts,
        headers: {
          ...(opts.headers ?? {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      break;
    } catch {
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
  if (!res) {
    throw new Error(`No se puede conectar con el backend (${BACKEND_URL}). La conexión falló después de 3 intentos. Comprueba que FastAPI y cloudflared estén iniciados.`);
  }
  if (!res.ok) {
    const text = await res.text();
    let message = text || `Error ${res.status}`;
    try {
      const payload = JSON.parse(text) as { detail?: string };
      message = payload.detail || message;
    } catch {
      // Keep the raw response when the server did not return JSON.
    }
    throw new Error(message);
  }
  return res;
}

  function clearEditor() {
    setBlocks([]);
    setVideoId(null);
    setPreviewUrl("");
    setResultUrl("");
    setEngineInfo("");
    setTranscriptionProgress(0);
    setTranscriptionStage("");
    setTranscriptionEta(0);
  }

  function onFile(f: File | null) {
    if (!f) return;
    if (f.size > MAX_UPLOAD_BYTES) {
      setError("El vídeo supera 1200 MB");
      return;
    }
    if (!/\.(mp4|mov|mkv|webm)$/i.test(f.name)) {
      setError("Formato no soportado (mp4, mov, mkv, webm)");
      return;
    }
    setFile(f);
    clearEditor();
    setError("");
  }

  async function doTranscribe() {
    setError("");
    if (!file) return;
    setTranscribing(true);
    setTranscriptionProgress(2);
    setTranscriptionStage("Preparando la subida...");
    setTranscriptionEta(Math.max(30, Math.round(file.size / (1024 * 1024) * 1.5)));
    let progressTimer: ReturnType<typeof setInterval> | undefined;
    try {
      const init = new FormData();
      init.append("filename", file.name);
      init.append("user_id", userId);
      const initRes = await api("/upload/init", { method: "POST", body: init });
      const { video_id: uploadedVideoId } = await initRes.json() as { video_id: string };
      const totalChunks = Math.ceil(file.size / UPLOAD_CHUNK_BYTES);
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
        setTranscriptionStage(`Subiendo vídeo (${chunkIndex + 1}/${totalChunks})...`);
        setTranscriptionProgress(5 + Math.round(((chunkIndex + 1) / totalChunks) * 40));
        const chunk = file.slice(chunkIndex * UPLOAD_CHUNK_BYTES, (chunkIndex + 1) * UPLOAD_CHUNK_BYTES);
        const chunkForm = new FormData();
        chunkForm.append("chunk", chunk, file.name);
        chunkForm.append("video_id", uploadedVideoId);
        chunkForm.append("chunk_index", String(chunkIndex));
        chunkForm.append("total_chunks", String(totalChunks));
        chunkForm.append("user_id", userId);
        await api("/upload/chunk", { method: "POST", body: chunkForm });
      }
      const complete = new FormData();
      complete.append("video_id", uploadedVideoId);
      complete.append("total_chunks", String(totalChunks));
      complete.append("user_id", userId);
      setTranscriptionStage("Uniendo fragmentos...");
      setTranscriptionProgress(48);
      await api("/upload/complete", { method: "POST", body: complete });

      const transcription = new FormData();
      transcription.append("video_id", uploadedVideoId);
      transcription.append("user_id", userId);
      transcription.append("language", language);
      transcription.append("words_per_block", String(wordsPerBlock));
      transcription.append("strip_punctuation", String(stripPunct));
      transcription.append("emphasis", String(emphasis));
      transcription.append("emphasis_engine", emphasisEngine);
      transcription.append("engine", engine);
      if (translateTo) transcription.append("translate_to", translateTo);
      setTranscriptionStage("Transcribiendo audio...");
      setTranscriptionProgress(52);
      const estimatedSeconds = Math.max(30, Math.round(file.size / (1024 * 1024) * 1.5));
      const transcriptionStartedAt = Date.now();
      progressTimer = setInterval(() => {
        const elapsed = (Date.now() - transcriptionStartedAt) / 1000;
        const ratio = Math.min(0.95, elapsed / estimatedSeconds);
        setTranscriptionProgress(52 + Math.round(ratio * 40));
        setTranscriptionEta(Math.max(1, Math.round(estimatedSeconds - elapsed)));
      }, 1000);
      const res = await api("/transcribe", { method: "POST", body: transcription });
      const data = await res.json();
      setTranscriptionProgress(100);
      setTranscriptionStage("Transcripción completada");
      setTranscriptionEta(0);
      setVideoId(data.video_id);
      setBlocks(data.blocks);
      setEngineInfo(data.engine);
      setPreviewUrl("");
      setResultUrl("");
    } catch (e) {
      setTranscriptionProgress(0);
      setTranscriptionStage("");
      setTranscriptionEta(0);
      setError(e instanceof Error ? e.message : "Error transcribiendo");
    } finally {
      if (progressTimer) clearInterval(progressTimer);
      setTranscribing(false);
    }
  }

  async function doPreview() {
    setError("");
    if (!videoId || !blocks.length) return;
    setPreviewing(true);
    try {
      const res = await api("/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, video_id: videoId, blocks, style, watermark }),
      });
      const blob = await res.blob();
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error generando preview");
    } finally {
      setPreviewing(false);
    }
  }

  async function doRender() {
    setError("");
    if (!videoId || !blocks.length) return;
    if (limitReached) return;
    setRendering(true);
    try {
      const res = await api("/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, video_id: videoId, blocks, style, watermark, filename: `${(file?.name ?? "video").replace(/\.[^.]+$/, "")}_subs.mp4` }),
      });
      const remaining = res.headers.get("X-Remaining");
      const blob = await res.blob();
      setResultUrl(URL.createObjectURL(blob));
      if (remaining !== null && remaining === "inf") {
        setUsage((u) => (u ? { ...u, remaining: null } : u));
      } else if (remaining) {
        setUsage((u) => (u ? { ...u, remaining: Number(remaining) } : u));
      }
      void refreshUsage();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error renderizando");
    } finally {
      setRendering(false);
    }
  }

  async function doCheckout(plan: string) {
    setError("");
    setBusy(plan);
    try {
      const res = await api("/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, plan }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error abriendo Stripe");
    } finally {
      setBusy("");
    }
  }

  function doRegroup() {
    setBlocks(groupWordsSmart(flattenWords(blocks), wordsPerBlock));
    setPreviewUrl("");
    setResultUrl("");
  }

  function doClearEmphasis() {
    setBlocks((bs) => bs.map((b) => ({ ...b, words: b.words.map((w) => ({ ...w, is_emphasis: false })) })));
    setPreviewUrl("");
    setResultUrl("");
  }

  async function doTranslate() {
    setError("");
    if (!blocks.length || !translateTo) return;
    setTranslating(true);
    try {
      const res = await api("/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, blocks, target_language: translateTo, source_language: language }),
      });
      const data = await res.json();
      setBlocks(data.blocks);
      setPreviewUrl("");
      setResultUrl("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error traduciendo");
    } finally {
      setTranslating(false);
    }
  }

  function updateBlockWordList(idx: number, newText: string) {
    setBlocks((bs) => bs.map((b, i) => (i === idx ? redistributeWords(b, newText) : b)));
    setPreviewUrl("");
    setResultUrl("");
  }

  if (!session) return <AuthCard />;

  return (
    <div
      className="min-h-screen bg-[#0E1117] text-[#E6EDF3]"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          setFullScreenDrop(true);
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setFullScreenDrop(false);
      }}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        setFullScreenDrop(false);
        onFile(e.dataTransfer.files[0]);
      }}
    >
      {fullScreenDrop && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-[#0E1117]/90 p-6">
          <div className="w-full max-w-xl rounded-3xl border-2 border-dashed border-[#F4C95D] bg-[#161B22] px-8 py-16 text-center shadow-[0_0_60px_rgba(244,201,93,0.18)]">
            <div className="text-5xl">🎬</div>
            <div className="mt-4 text-xl font-bold text-[#F4C95D]">Suelta el vídeo aquí</div>
            <div className="mt-2 text-sm text-[#8B949E]">MP4, MOV, MKV o WEBM</div>
          </div>
        </div>
      )}
      <header className="mx-4 mt-5 mb-6 flex max-w-[1468px] flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#2A3140] bg-gradient-to-br from-[#161B22] to-[#1A1230] px-6 py-4 lg:mx-auto">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#8A2BE2] to-[#4A1A8A] text-lg font-extrabold text-white shadow-[0_6px_20px_rgba(138,43,226,0.4)]">TT</div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">TranscribeThat</h1>
            <p className="text-xs text-[#8B949E]">Subtítulos automáticos · karaoke · traducción · presets virales</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <UsageBadge usage={usage} />
          <button
            className={`${btnPrimary} !w-auto !px-3 !py-1.5 text-xs`}
            onClick={() => setShowPlans((visible) => !visible)}
          >
            {showPlans ? "Ocultar planes" : "Actualizar plan"}
          </button>
          <span className="text-xs text-[#8B949E]">{session.user.email}</span>
          <button className={`${btnGhost} !w-auto !px-3 !py-1.5`} onClick={() => supabase.auth.signOut()}>Salir</button>
        </div>
      </header>

      {(showPlans || limitReached) && usage && (
        <div className="mx-auto mb-6 max-w-[1500px] px-4">
          <PricingCards current={usage.plan} onSelect={doCheckout} busy={busy} />
        </div>
      )}

      <main className="mx-auto grid max-w-[1500px] gap-6 px-4 lg:grid-cols-[300px_minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <section>
            <SectionTitle n="1" title="Vídeo y transcripción" />
            <details className="control-group mt-3" open>
              <summary>Opciones de transcripción</summary>
              <div className="mt-3 space-y-3">
                <SelectField label="Idioma del audio" value={language} onChange={setLanguage}
                  options={LANG_OPTS.map((l) => l[0]) as unknown as string[]} />
                <SelectField label="Palabras por subtítulo" value={String(wordsPerBlock)} onChange={(v) => setWordsPerBlock(Number(v))}
                  options={["2", "3", "4", "5", "6", "7", "8", "10", "12"]} />
                <SelectField label="Motor de transcripción" value={engine} onChange={setEngine}
                  options={["auto", "openai", "local"]} />
                <Toggle label="Quitar signos de puntuación" checked={stripPunct} onChange={setStripPunct} />
                <Toggle label="Detectar palabras clave (Hormozi PRO)" checked={emphasis} onChange={setEmphasis} />
                {emphasis && <SelectField label="Motor de emphasis" value={emphasisEngine} onChange={setEmphasisEngine}
                  options={["auto", "free", "claude"]} />}
              </div>
            </details>
            {blocks.length > 0 && <div className="mt-3 space-y-2">
              <button className={`${btnGhost} w-full`} onClick={doRegroup}>🔁 Reagrupar bloques</button>
              <button className={`${btnGhost} w-full`} onClick={doClearEmphasis} disabled={!blocks.some((b) => b.words.some((w) => w.is_emphasis))}>
                  🗑 Quitar énfasis
              </button>
              <div>
                  <SelectField label="Traducción" value={translateTo} onChange={setTranslateTo}
                    options={["", ...TRANSLATE_OPTS.map(([code]) => code)]} />
              </div>
              <button className={`${btnGhost} w-full`} disabled={!translateTo || translating} onClick={doTranslate}>
                  {translating ? "Traduciendo..." : "Traducir"}
              </button>
            </div>}
            <button className={`${btnPrimary} mt-3`} disabled={!file || transcribing} onClick={doTranscribe}>
              {transcribing ? "Transcribiendo... (puede tardar)" : "Transcribir"}
            </button>
            {(transcribing || transcriptionProgress === 100) && <div className="mt-3 rounded-xl border border-[#2A3140] bg-[#161B22] p-3" role="status" aria-live="polite">
              <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                <span className="font-semibold text-[#E6EDF3]">{transcriptionStage}</span>
                <span className="font-mono text-[#F4C95D]">{transcriptionProgress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#2A3140]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={transcriptionProgress}>
                <div className="h-full rounded-full bg-[#F4C95D] transition-[width] duration-500" style={{ width: `${transcriptionProgress}%` }} />
              </div>
              {transcribing && <p className="mt-2 text-[11px] text-[#8B949E]">
                Tiempo restante aproximado: {transcriptionEta > 0 ? formatDuration(transcriptionEta) : "calculando..."}
              </p>}
            </div>}
            {engineInfo && <p className="mt-2 text-center text-[11px] text-[#8B949E]">Motor: {engineInfo}</p>}
          </section>

          <section className="hidden">
            <SectionTitle n="3" title="Estilo y render" />
            <div className="space-y-3">
              <SelectField label="Preset viral" value={presetName}
                onChange={(v) => { setPresetName(v); if (PRESETS[v]) setStyle((s) => ({ ...s, ...PRESETS[v] })); }}
                options={["Personalizado", ...Object.keys(PRESETS)]} />
              <div className="grid grid-cols-2 gap-3">
                <SelectField label="Tipografía" value={style.font} onChange={(v) => setStylePatch({ font: v })} options={FONTS} />
                <Slider label="Tamaño" value={style.size} onChange={(v) => setStylePatch({ size: v })} min={24} max={120} step={2} suffix="px" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <ColorInput label="Color de texto" value={style.color} onChange={(v) => setStylePatch({ color: v })} />
                <ColorInput label="Color contorno" value={style.outline_color} onChange={(v) => setStylePatch({ outline_color: v })} />
              </div>
              <SelectField label="Fondo del texto" value={style.bg_mode}
                onChange={(v) => setStylePatch({ bg_mode: v })} options={BG_OPTS} />
              {style.bg_mode === "Color personalizado" && (
                <ColorInput label="Color de fondo" value={style.bg_color} onChange={(v) => setStylePatch({ bg_color: v })} />
              )}
              <SelectField label="Posición vertical" value={style.position}
                onChange={(v) => setStylePatch({ position: v })} options={POS_OPTS} />
              {style.position === "Personalizada" && (
                <Slider label="Margen vertical" value={style.custom_margin_v} onChange={(v) => setStylePatch({ custom_margin_v: v })} min={0} max={900} step={10} suffix="px" />
              )}
              <SelectField label="Alineación" value={style.align} onChange={(v) => setStylePatch({ align: v })} options={AL_OPTS} />
              <Toggle label="Negrita" checked={style.bold} onChange={(v) => setStylePatch({ bold: v })} />
              <Toggle label="TODO MAYÚSCULAS" checked={style.uppercase} onChange={(v) => setStylePatch({ uppercase: v })} />
              <Toggle label="Animación karaoke" checked={style.karaoke} onChange={(v) => setStylePatch({ karaoke: v })} />
              {style.karaoke && (
                <div className="space-y-3">
                  <ColorInput label="Color sin hablar" value={style.karaoke_unspoken_color} onChange={(v) => setStylePatch({ karaoke_unspoken_color: v })} />
                  <ColorInput label="Color énfasis" value={style.karaoke_emphasis_color} onChange={(v) => setStylePatch({ karaoke_emphasis_color: v })} />
                  <Slider label="Tamaño énfasis" value={style.karaoke_emphasis_scale} onChange={(v) => setStylePatch({ karaoke_emphasis_scale: v })} min={100} max={200} step={5} suffix="%" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Slider label="Grosor contorno" value={style.outline_w} onChange={(v) => setStylePatch({ outline_w: v })} min={0} max={6} step={0.5} />
                <Slider label="Sombra" value={style.shadow} onChange={(v) => setStylePatch({ shadow: v })} min={0} max={6} step={0.5} />
              </div>
            </div>
          </section>

          <section className="hidden">
            <SectionTitle n="4" title="Marca de agua" />
            <Toggle label="Añadir marca de agua" checked={wmOn} onChange={setWmOn} />
            {wmOn && (
              <div className="mt-3 space-y-3">
                <Field label="Texto">
                  <input className={inputCls} value={wm.text} onChange={(e) => setWm({ ...wm, text: e.target.value })} />
                </Field>
                <SelectField label="Posición" value={wm.position} onChange={(v) => setWm({ ...wm, position: v })} options={WM_POSITIONS} />
                <div className="grid grid-cols-2 gap-3">
                  <Slider label="Tamaño" value={wm.size} onChange={(v) => setWm({ ...wm, size: v })} min={18} max={80} step={2} suffix="px" />
                  <Slider label="Opacidad" value={Math.round(wm.opacity * 100)} onChange={(v) => setWm({ ...wm, opacity: v / 100 })} min={10} max={100} suffix="%" />
                </div>
                <ColorInput label="Color" value={wm.color} onChange={(v) => setWm({ ...wm, color: v })} />
              </div>
            )}
          </section>
        </div>

        <div className="space-y-5">
          <section>
            <SectionTitle n="2" title="Preview y editor" />
            <div className="overflow-hidden rounded-2xl border border-[#2A3140] bg-[#161B22] p-4">
              {previewUrl ? (
                <img src={previewUrl} alt="Preview" className="mx-auto max-h-[480px] rounded-lg" />
              ) : (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); setFullScreenDrop(false); onFile(e.dataTransfer.files?.[0] ?? null); }}
                  onClick={() => fileRef.current?.click()}
                  className={`flex min-h-[320px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed text-center transition ${dragOver ? "border-[#F4C95D] bg-[#F4C95D]/10" : "border-[#2A3140] bg-gradient-to-b from-[#1C2230] to-[#0E1117] hover:border-[#F4C95D]"}`}
                >
                  <input ref={fileRef} type="file" accept=".mp4,.mov,.mkv,.webm" className="hidden"
                    onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
                  <div className="text-4xl opacity-70">{file ? (blocks.length ? "🖼️" : "⏳") : "🎬"}</div>
                  <div className="mt-2 text-sm font-bold text-[#E6EDF3]">
                    {!file ? "Sube un vídeo para empezar" : !blocks.length ? "Transcribe para generar subtítulos" : "Sin vista previa todavía"}
                  </div>
                  <div className="mt-1 text-xs text-[#8B949E]">Haz clic o arrastra un MP4, MOV, MKV o WEBM</div>
                </div>
              )}
              <button className={`${btnGhost} mt-3`} disabled={!videoId || !blocks.length || previewing} onClick={doPreview}>
                {previewing ? "Generando preview..." : "🔄 Actualizar preview"}
              </button>
            </div>
          </section>

          {blocks.length > 0 && (
            <section>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-[#8B949E]">📝 {blocks.length} bloques · edita el texto si hay errores</span>
              </div>
              <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                {blocks.map((b, i) => (
                  <div key={b.id} className="rounded-xl border border-[#2A3140] bg-[#161B22] p-3">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="font-mono text-[11px] font-semibold text-[#9D4BFF]">▸ {fmtTime(b.start)} → {fmtTime(b.end)}</span>
                      <span className="font-mono text-[11px] text-[#8B949E]">#{i + 1}</span>
                    </div>
                    <textarea
                      className="min-h-[44px] w-full resize-y rounded-lg border border-[#2A3140] bg-[#1C2230] px-3 py-2 font-mono text-[13px] text-[#E6EDF3] outline-none focus:border-[#8A2BE2]"
                      value={b.text}
                      onChange={(e) => updateBlockWordList(i, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="space-y-5">
          <details className="control-group" open>
            <summary>Estilo de subtítulos</summary>
          <section>
            <SectionTitle n="3" title="Estilo y render" />
            <div className="space-y-3">
              <SelectField label="Preset viral" value={presetName}
                onChange={(v) => { setPresetName(v); if (PRESETS[v]) setStyle((s) => ({ ...s, ...PRESETS[v] })); }}
                options={["Personalizado", ...Object.keys(PRESETS)]} />
              <div className="grid grid-cols-2 gap-3">
                <SelectField label="Tipografía" value={style.font} onChange={(v) => setStylePatch({ font: v })} options={FONTS} />
                <Slider label="Tamaño" value={style.size} onChange={(v) => setStylePatch({ size: v })} min={24} max={120} step={2} suffix="px" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <ColorInput label="Color de texto" value={style.color} onChange={(v) => setStylePatch({ color: v })} />
                <ColorInput label="Color contorno" value={style.outline_color} onChange={(v) => setStylePatch({ outline_color: v })} />
              </div>
              <SelectField label="Fondo del texto" value={style.bg_mode} onChange={(v) => setStylePatch({ bg_mode: v })} options={BG_OPTS} />
              {style.bg_mode === "Color personalizado" && <ColorInput label="Color de fondo" value={style.bg_color} onChange={(v) => setStylePatch({ bg_color: v })} />}
              <SelectField label="Posición vertical" value={style.position} onChange={(v) => setStylePatch({ position: v })} options={POS_OPTS} />
              {style.position === "Personalizada" && <Slider label="Margen vertical" value={style.custom_margin_v} onChange={(v) => setStylePatch({ custom_margin_v: v })} min={0} max={900} step={10} suffix="px" />}
              <SelectField label="Alineación" value={style.align} onChange={(v) => setStylePatch({ align: v })} options={AL_OPTS} />
              <Toggle label="Negrita" checked={style.bold} onChange={(v) => setStylePatch({ bold: v })} />
              <Toggle label="TODO MAYÚSCULAS" checked={style.uppercase} onChange={(v) => setStylePatch({ uppercase: v })} />
              <Toggle label="Animación karaoke" checked={style.karaoke} onChange={(v) => setStylePatch({ karaoke: v })} />
              {style.karaoke && <div className="space-y-3">
                <ColorInput label="Color sin hablar" value={style.karaoke_unspoken_color} onChange={(v) => setStylePatch({ karaoke_unspoken_color: v })} />
                <ColorInput label="Color énfasis" value={style.karaoke_emphasis_color} onChange={(v) => setStylePatch({ karaoke_emphasis_color: v })} />
                <Slider label="Tamaño énfasis" value={style.karaoke_emphasis_scale} onChange={(v) => setStylePatch({ karaoke_emphasis_scale: v })} min={100} max={200} step={5} suffix="%" />
              </div>}
              <div className="grid grid-cols-2 gap-3">
                <Slider label="Grosor contorno" value={style.outline_w} onChange={(v) => setStylePatch({ outline_w: v })} min={0} max={6} step={0.5} />
                <Slider label="Sombra" value={style.shadow} onChange={(v) => setStylePatch({ shadow: v })} min={0} max={6} step={0.5} />
              </div>
            </div>
          </section>
          </details>

          <details className="control-group" open>
            <summary>Marca de agua</summary>
          <section>
            <SectionTitle n="4" title="Marca de agua" />
            <Toggle label="Añadir marca de agua" checked={wmOn} onChange={setWmOn} />
            {wmOn && <div className="mt-3 space-y-3">
              <Field label="Texto"><input className={inputCls} value={wm.text} onChange={(e) => setWm({ ...wm, text: e.target.value })} /></Field>
              <SelectField label="Posición" value={wm.position} onChange={(v) => setWm({ ...wm, position: v })} options={WM_POSITIONS} />
              <div className="grid grid-cols-2 gap-3">
                <Slider label="Tamaño" value={wm.size} onChange={(v) => setWm({ ...wm, size: v })} min={18} max={80} step={2} suffix="px" />
                <Slider label="Opacidad" value={Math.round(wm.opacity * 100)} onChange={(v) => setWm({ ...wm, opacity: v / 100 })} min={10} max={100} suffix="%" />
              </div>
              <ColorInput label="Color" value={wm.color} onChange={(v) => setWm({ ...wm, color: v })} />
            </div>}
          </section>
          </details>

          <details className="control-group" open>
            <summary>Exportación y resultado</summary>
          <section>
            <SectionTitle n="5" title="Resultado" />
            <div className="rounded-2xl border border-[#2A3140] bg-[#161B22] p-4">
              {!limitReached ? <button className={btnPrimary} disabled={!videoId || !blocks.length || rendering} onClick={doRender}>
                {rendering ? "Renderizando con FFmpeg..." : "🎬 Renderizar vídeo final"}
              </button> : <p className="rounded-xl border border-[#8A2BE2]/40 bg-[#8A2BE2]/10 p-4 text-center text-sm text-[#9D4BFF]">
                Límite diario alcanzado. Haz upgrade arriba para seguir renderizando.
              </p>}
              {resultUrl && <div className="mt-4 space-y-3">
                <video src={resultUrl} controls className="mx-auto max-h-[480px] w-auto rounded-lg" />
                <div className="grid gap-2 sm:grid-cols-2">
                  <a className={`${btnPrimary} !text-center`} href={resultUrl} download={`${(file?.name ?? "video").replace(/\.[^.]+$/, "")}_subs.mp4`}>⬇️ Descargar MP4</a>
                  <div className="grid grid-cols-2 gap-2">
                    <button className={`${btnGhost} !w-auto`} onClick={() => downloadFile("subtitulos.srt", buildSrt(blocks), "application/x-subrip")}>SRT</button>
                    <button className={`${btnGhost} !w-auto`} onClick={() => downloadFile("subtitulos.vtt", buildVtt(blocks), "text/vtt")}>VTT</button>
                  </div>
                </div>
              </div>}
            </div>
          </section>

          {error && <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-400">{error}</div>}
          </details>
        </div>
      </main>
    </div>
  );
}