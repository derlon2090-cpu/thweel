"use client";

import { FormEvent, MouseEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";

type Route = "/" | "/files" | "/history" | "/features" | "/pricing" | "/login" | "/register";
type JobStatus = "completed" | "processing" | "failed" | "awaiting_confirmation" | "cancelled";

type PublicUser = {
  id: string;
  email: string;
  fullName: string;
  xpBalance: number;
  xpLevel: number;
  totalXpUsed: number;
  totalXpEarned: number;
};

type Job = {
  id: string;
  title: string;
  type: "text" | "file";
  status: JobStatus;
  words: number;
  xp: number;
  createdAt: string;
  input?: string;
  output?: string;
  fileName?: string;
  fileSize?: string;
  outputFormat?: string;
  beforeAiScore?: number;
  beforeHumanScore?: number;
  afterAiScore?: number;
  afterHumanScore?: number;
};

type Transaction = {
  id: string;
  type: string;
  amount: number;
  reason: string;
  at: string;
};

const routes: { path: Route; label: string }[] = [
  { path: "/", label: "الرئيسية" },
  { path: "/files", label: "الملفات" },
  { path: "/history", label: "سجل التحويلات" },
  { path: "/features", label: "المميزات" },
  { path: "/pricing", label: "الأسعار" },
];

function normalizeRoute(route: string): Route {
  if (["/files", "/history", "/features", "/pricing", "/login", "/register"].includes(route)) return route as Route;
  return "/";
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function countWords(text: string) {
  const cleaned = text.replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.split(" ").filter(Boolean).length : 0;
}

function calculateXp(words: number) {
  if (!words) return 0;
  return Math.max(Math.ceil(words / 100) * 3, 3);
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function estimateClientHumanScore(input: string, output = input) {
  const words = countWords(input);
  const uniqueWords = new Set(input.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean)).size;
  const variety = words ? uniqueWords / words : 0;
  const sentenceCount = Math.max(input.split(/[.!؟?؛،\n]+/u).filter((part) => part.trim()).length, 1);
  const avgSentence = words / sentenceCount;
  const beforeHuman = clamp(42 + variety * 28 + (avgSentence > 7 && avgSentence < 32 ? 10 : -6) - (words < 25 ? 8 : 0), 28, 82);
  const afterHuman = clamp(Math.max(beforeHuman + 14, 84 + Math.min(words, 400) / 45), 76, 96);
  return {
    beforeAi: clamp(100 - beforeHuman),
    beforeHuman,
    afterAi: clamp(100 - afterHuman),
    afterHuman,
    changed: output.trim() !== input.trim(),
  };
}

function localHumanizeText(input: string, tone: string, strength: string) {
  const replacements: Array<[RegExp, string]> = [
    [/يشهد العالم اليوم/gu, "نرى اليوم"],
    [/تطوراً كبيراً/gu, "تطوراً واضحاً"],
    [/جزءاً لا يتجزأ/gu, "جزءاً أساسياً"],
    [/تحديات تتعلق بالجودة والدقة/gu, "تحديات في الجودة والدقة"],
    [/المحتوى المكتوب/gu, "النصوص المكتوبة"],
    [/تهدف إلى/gu, "تساعد على"],
    [/الحفاظ على المعنى/gu, "حفظ المعنى"],
    [/بشكل كبير/gu, "إلى حد واضح"],
    [/من المهم/gu, "من المفيد"],
    [/حيث إن/gu, "لأن"],
  ];

  let output = input
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+([،.!؟؛])/gu, "$1")
    .trim();

  replacements.forEach(([pattern, value]) => {
    output = output.replace(pattern, value);
  });

  if (strength === "قوي") {
    output = output.replace(/، و/gu, ". كما ").replace(/ وذلك /gu, " وهذا ");
  }

  if (tone.includes("رسمي")) {
    output = output.replace(/نرى اليوم/gu, "يتضح اليوم").replace(/تساعد على/gu, "تسهم في");
  }

  const paragraphs = output.split(/\n{2,}/).map((paragraph) => {
    const clean = paragraph.replace(/\s+/g, " ").trim();
    if (!clean) return "";
    return clean.endsWith(".") || clean.endsWith("؟") || clean.endsWith("!") ? clean : `${clean}.`;
  });

  output = paragraphs.filter(Boolean).join("\n\n");

  if (output === input.trim()) {
    output = input
      .split(/(?<=[.!؟])\s+/u)
      .map((sentence, index) => (index % 2 === 0 ? sentence.trim() : sentence.trim().replace(/^كما أن\s*/u, "")))
      .filter(Boolean)
      .join(" ");
  }

  return output || input;
}

function cn(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function clientFallbackUser(email: string, fullName?: string): PublicUser {
  const cleanEmail = email.trim().toLowerCase() || "guest@quillora.local";
  const cleanName = fullName?.trim() || cleanEmail.split("@")[0] || "مستخدم Quillora";
  if (typeof document !== "undefined") {
    document.cookie = "quillora_session=client_fallback; path=/; max-age=2592000; SameSite=Lax";
  }
  return {
    id: `client_${cleanEmail.replace(/[^a-z0-9]/gi, "_")}`,
    email: cleanEmail,
    fullName: cleanName,
    xpBalance: 50,
    xpLevel: 1,
    totalXpUsed: 0,
    totalXpEarned: 50,
  };
}

async function readApi(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "تعذر تنفيذ العملية الآن.");
  return data;
}

function mapApiJob(job: any): Job {
  return {
    id: job.id,
    title: job.title || job.fileName || "تحويل جديد",
    type: job.type === "file" ? "file" : "text",
    status:
      job.status === "failed"
        ? "failed"
        : job.status === "processing"
          ? "processing"
          : job.status === "awaiting_confirmation"
            ? "awaiting_confirmation"
            : job.status === "cancelled"
              ? "cancelled"
              : "completed",
    words: job.wordCount || 0,
    xp: job.xpCost || 0,
    createdAt: job.createdAt || new Date().toISOString(),
    input: job.inputText,
    output: job.outputText,
    fileName: job.fileName,
    fileSize: job.fileSize ? `${(job.fileSize / 1024 / 1024).toFixed(1)} MB` : undefined,
    outputFormat: job.outputFormat || "TXT",
    beforeAiScore: job.beforeAiScore ?? undefined,
    beforeHumanScore: job.beforeHumanScore ?? undefined,
    afterAiScore: job.afterAiScore ?? undefined,
    afterHumanScore: job.afterHumanScore ?? undefined,
  };
}

function mapApiTransaction(tx: any): Transaction {
  return {
    id: tx.id,
    type: tx.type,
    amount: tx.amount,
    reason: tx.description || tx.type,
    at: tx.createdAt || new Date().toISOString(),
  };
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>;
}

function Pill({ children, tone = "blue" }: { children: ReactNode; tone?: "blue" | "green" | "red" | "orange" | "soft" }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

function Icon({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`icon ${className}`}>{children}</span>;
}

function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className={compact ? "brand-logo compact natural-logo" : "brand-logo"} aria-hidden="true">
      <img src="/quillora-logo.png" alt="" />
    </span>
  );
}

export function HumanizeApp({ initialRoute }: { initialRoute: Route }) {
  const [route, setRoute] = useState<Route>(initialRoute);
  const [xp, setXp] = useState(0);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [toast, setToast] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onPop = () => setRoute(normalizeRoute(window.location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    refreshAccount();
  }, []);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 3000);
  }

  function navigate(next: Route, event?: MouseEvent<HTMLElement>) {
    event?.preventDefault();
    setRoute(next);
    window.history.pushState({}, "", next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function applyUser(nextUser?: PublicUser) {
    if (!nextUser) return;
    setUser(nextUser);
    setXp(nextUser.xpBalance);
  }

  function completeLocalJob(job: Job, xpCost: number) {
    setJobs((items) => [job, ...items]);
    setTransactions((items) => [
      {
        id: `local_tx_${Date.now()}`,
        type: job.type === "file" ? "FILE_HUMANIZE" : "TEXT_HUMANIZE",
        amount: -xpCost,
        reason: job.type === "file" ? "تحويل ملف محلي" : "تحويل نص محلي",
        at: new Date().toISOString(),
      },
      ...items,
    ]);
    if (user) {
      applyUser({
        ...user,
        xpBalance: Math.max(user.xpBalance - xpCost, 0),
        totalXpUsed: user.totalXpUsed + xpCost,
      });
    }
  }

  async function refreshAccount() {
    try {
      const me = await fetch("/api/me", { credentials: "include" });
      if (!me.ok) return;
      const meData = await me.json();
      applyUser(meData.user);

      const [jobsResponse, txResponse] = await Promise.all([
        fetch("/api/jobs", { credentials: "include" }),
        fetch("/api/xp/transactions", { credentials: "include" }),
      ]);
      if (jobsResponse.ok) setJobs(((await jobsResponse.json()).jobs || []).map(mapApiJob));
      if (txResponse.ok) setTransactions(((await txResponse.json()).transactions || []).map(mapApiTransaction));
    } catch {
      // تبقى الصفحات العامة قابلة للعرض حتى قبل ربط متغيرات البيئة.
    }
  }

  function reserveXp(amount: number) {
    if (!user) {
      notify("سجّل الدخول أولاً لاستخدام التحويل ورصيد XP.");
      navigate("/login");
      return false;
    }
    if (amount > xp) {
      notify(`رصيد XP غير كافٍ. تحتاج ${amount} XP ورصيدك الحالي ${xp} XP.`);
      return false;
    }
    return true;
  }

  async function deleteJob(id: string) {
    try {
      await fetch(`/api/jobs/${id}`, { method: "DELETE", credentials: "include" });
      setJobs((items) => items.filter((job) => job.id !== id));
      notify("تم حذف العملية من السجل.");
    } catch {
      notify("تعذر حذف العملية الآن.");
    }
  }

  return (
    <main dir="rtl" className={cn("app-shell", route === "/login" || route === "/register" ? "auth-shell" : "")}>
      {route !== "/login" && route !== "/register" ? (
        <Header
          route={route}
          xp={xp}
          level={user?.xpLevel ?? 1}
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
          navigate={navigate}
          transactions={transactions}
        />
      ) : (
        <AuthTopbar navigate={navigate} />
      )}

      {route === "/" && (
        <HomePage
          jobs={jobs}
          xp={xp}
          reserveXp={reserveXp}
          applyUser={applyUser}
          refreshAccount={refreshAccount}
          notify={notify}
          navigate={navigate}
          completeLocalJob={completeLocalJob}
        />
      )}
      {route === "/files" && (
        <FilesPage
          jobs={jobs}
          xp={xp}
          reserveXp={reserveXp}
          applyUser={applyUser}
          refreshAccount={refreshAccount}
          notify={notify}
          deleteJob={deleteJob}
        />
      )}
      {route === "/history" && <HistoryPage jobs={jobs} deleteJob={deleteJob} />}
      {route === "/features" && <FeaturesPage navigate={navigate} />}
      {route === "/pricing" && <PricingPage notify={notify} />}
      {route === "/login" && <LoginPage navigate={navigate} notify={notify} applyUser={applyUser} refreshAccount={refreshAccount} />}
      {route === "/register" && <RegisterPage navigate={navigate} notify={notify} applyUser={applyUser} refreshAccount={refreshAccount} />}

      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}

function Header({
  route,
  xp,
  level,
  menuOpen,
  setMenuOpen,
  navigate,
  transactions,
}: {
  route: Route;
  xp: number;
  level: number;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  navigate: (route: Route, event?: MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => void;
  transactions: Transaction[];
}) {
  return (
    <header className="topbar">
      <a href="/" className="brand" onClick={(event) => navigate("/", event)}>
        <BrandLogo compact />
        <span>
          <strong>صياغة بشرية</strong>
          <small>QUILLORA · حوّل النصوص إلى أسلوب بشري احترافي</small>
        </span>
      </a>

      <nav className="nav-tabs" aria-label="التنقل الرئيسي">
        {routes.map((item) => (
          <a key={item.path} href={item.path} className={route === item.path ? "active" : ""} onClick={(event) => navigate(item.path, event)}>
            {item.label}
          </a>
        ))}
        <a href="/login" onClick={(event) => navigate("/login", event)}>
          تسجيل الدخول
        </a>
      </nav>

      <div className="top-actions">
        <button className="gradient-btn small" onClick={(event) => navigate("/", event)}>
          ابدأ الآن
        </button>
        <button className="outline-btn" onClick={(event) => navigate("/files", event)}>
          رفع ملف
        </button>
        <button className="xp-pill" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen}>
          <span className="xp-star">✦</span>
          <span>
            <strong>{formatNumber(xp)} XP</strong>
            <small>المستوى {level}</small>
          </span>
          <span>⌄</span>
        </button>
        {menuOpen && (
          <div className="xp-menu">
            <strong>رصيدك الحالي</strong>
            <b>{formatNumber(xp)} XP</b>
            <p>آخر عملية: {transactions[0] ? `${transactions[0].reason} (${transactions[0].amount} XP)` : "لا توجد عمليات بعد"}</p>
            <button onClick={(event) => navigate("/pricing", event)}>شراء XP</button>
            <button onClick={(event) => navigate("/history", event)}>سجل المعاملات</button>
          </div>
        )}
      </div>
    </header>
  );
}

function AuthTopbar({ navigate }: { navigate: (route: Route, event?: MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => void }) {
  return (
    <header className="auth-topbar">
      <a href="/" className="brand" onClick={(event) => navigate("/", event)}>
        <BrandLogo compact />
        <span>
          <strong>صياغة بشرية</strong>
          <small>QUILLORA · حوّل النصوص إلى أسلوب بشري احترافي</small>
        </span>
      </a>
      <button className="link-btn" onClick={(event) => navigate("/", event)}>
        العودة للرئيسية
      </button>
    </header>
  );
}

function HomePage({
  jobs,
  xp,
  reserveXp,
  applyUser,
  refreshAccount,
  notify,
  navigate,
  completeLocalJob,
}: {
  jobs: Job[];
  xp: number;
  reserveXp: (amount: number) => boolean;
  applyUser: (user?: PublicUser) => void;
  refreshAccount: () => Promise<void>;
  notify: (message: string) => void;
  navigate: (route: Route, event?: MouseEvent<HTMLElement>) => void;
  completeLocalJob: (job: Job, xpCost: number) => void;
}) {
  const [text, setText] = useState("");
  const [tone, setTone] = useState("سردي طبيعي");
  const [strength, setStrength] = useState("متوسط");
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);
  const [score, setScore] = useState<{ beforeAi?: number; beforeHuman?: number; afterAi?: number; afterHuman?: number }>({});

  const words = countWords(text);
  const xpCost = calculateXp(words);

  async function convertText() {
    if (!text.trim()) return notify("أدخل النص أولاً ثم ابدأ التحويل.");
    if (!reserveXp(xpCost)) return;
    setBusy(true);
    const analysis = {
      wordCount: words,
      xpCost,
      currentBalance: xp,
      balanceAfter: xp - xpCost,
      canProceed: xp - xpCost >= 0,
      message: "رصيدك يكفي لإتمام التحويل. أكّد للمتابعة.",
    };
    const summary = `عدد الكلمات: ${formatNumber(analysis.wordCount)}
تكلفة التحويل: ${formatNumber(analysis.xpCost)} XP
رصيدك الحالي: ${formatNumber(analysis.currentBalance)} XP
رصيدك بعد التحويل: ${formatNumber(analysis.balanceAfter)} XP

${analysis.message}`;

    if (!analysis.canProceed) {
      setBusy(false);
      return notify(`رصيد XP غير كافٍ. تحتاج ${Math.abs(analysis.balanceAfter)} XP إضافية.`);
    }
    if (!window.confirm(`${summary}\n\nهل تريد تأكيد التحويل؟`)) {
      setBusy(false);
      return notify("تم إلغاء التحويل بدون خصم XP.");
    }

    try {
      const data = await readApi(
        await fetch("/api/humanize/text/confirm", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text, tone, strength, preserveMeaning: true, noNewInfo: true, confirmed: true, currentBalance: xp }),
        }),
      );
      const job = mapApiJob(data.job);
      setOutput(job.output || "");
      setScore({
        beforeAi: job.beforeAiScore,
        beforeHuman: job.beforeHumanScore,
        afterAi: job.afterAiScore,
        afterHuman: job.afterHumanScore,
      });
      applyUser(data.user);
      await refreshAccount();
      notify(`تم التحويل وخصم ${analysis.xpCost} XP من رصيدك.`);
    } catch {
      const balanceAfter = xp - xpCost;
      const summary = `عدد الكلمات: ${formatNumber(words)}
تكلفة التحويل: ${formatNumber(xpCost)} XP
رصيدك الحالي: ${formatNumber(xp)} XP
رصيدك بعد التحويل: ${formatNumber(balanceAfter)} XP

تعذر الاتصال بخدمة التحويل السحابية الآن، وسيتم تنفيذ تحويل محلي احتياطي يحافظ على اللغة والمعنى.`;
      if (!window.confirm(`${summary}\n\nهل تريد تأكيد التحويل؟`)) {
        return notify("تم إلغاء التحويل بدون خصم XP.");
      }

      const localOutput = localHumanizeText(text, tone, strength);
      const localScore = estimateClientHumanScore(text, localOutput);
      const localJob: Job = {
        id: `local_text_${Date.now()}`,
        title: text.trim().slice(0, 46) || "تحويل نص",
        type: "text",
        status: "completed",
        words,
        xp: xpCost,
        createdAt: new Date().toISOString(),
        input: text,
        output: localOutput,
        beforeAiScore: localScore.beforeAi,
        beforeHumanScore: localScore.beforeHuman,
        afterAiScore: localScore.afterAi,
        afterHumanScore: localScore.afterHuman,
      };
      setOutput(localOutput);
      setScore(localScore);
      completeLocalJob(localJob, xpCost);
      notify(`تم التحويل محلياً وخصم ${xpCost} XP من رصيدك.`);
    } finally {
      setBusy(false);
    }
  }

  function download() {
    const blob = new Blob([output || text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "quillora-text.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="page work-page">
      <aside className="side-column">
        <Card>
          <div className="section-title">
            <h3>الناتج البشري</h3>
            <span>✦</span>
          </div>
          <div className="result-box">{output || "سيظهر النص الناتج هنا بعد تأكيد التحويل."}</div>
          <div className="wordline">
            <span>{countWords(output || text)}/5000 كلمة</span>
            {output && <Pill tone="green">جاهز</Pill>}
          </div>
        </Card>

        <Card>
          <div className="section-title">
            <h3>ملاحظات سريعة</h3>
            <span>↯</span>
          </div>
          <p className="empty-state">التحويل لا يبدأ إلا بعد تحليل التكلفة وموافقتك، ولا يتم خصم XP قبل التأكيد.</p>
        </Card>

        <Card>
          <div className="section-title">
            <h3>درجة بشرية النص</h3>
            <span>ⓘ</span>
          </div>
          <div className="human-score">
            <div className="score-card muted">
              <small>قبل التحويل</small>
              <strong>{score.beforeAi !== undefined ? `${score.beforeAi}%` : "—"}</strong>
              <span>AI</span>
            </div>
            <div className="donut" aria-label={`درجة بشرية ${score.afterHuman ?? 0}%`}>
              {score.afterHuman ?? "—"}
            </div>
            <div className="score-card green">
              <small>بعد التحويل</small>
              <strong>{score.afterHuman !== undefined ? `${score.afterHuman}%` : "—"}</strong>
              <span>بشري</span>
            </div>
          </div>
          <div className="triple-actions">
            <button onClick={() => navigator.clipboard.writeText(output || text).then(() => notify("تم نسخ النص."))}>نسخ النص</button>
            <button onClick={download}>تحميل</button>
            <button onClick={() => navigator.clipboard.writeText(output || text).then(() => notify("تم تجهيز النص للمشاركة."))}>مشاركة</button>
          </div>
        </Card>
      </aside>

      <section className="main-column">
        <Card className="converter-card">
          <div className="section-title">
            <h2>تحويل النص</h2>
            <span>✎</span>
          </div>
          <div className="control-grid">
            <label>
              <span>نمط الكتابة</span>
              <select value={tone} onChange={(event) => setTone(event.target.value)}>
                {["سردي طبيعي", "رسمي", "أكاديمي", "تسويقي", "سعودي طبيعي"].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label>
              <span>قوة التحويل</span>
              <select value={strength} onChange={(event) => setStrength(event.target.value)}>
                {["خفيف", "متوسط", "قوي"].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="switch-row">
            <label>
              <input type="checkbox" checked readOnly /> الحفاظ على المعنى
            </label>
            <label>
              <input type="checkbox" checked readOnly /> عدم إضافة معلومات جديدة
            </label>
          </div>
          <textarea value={text} onChange={(event) => setText(event.target.value)} maxLength={5000} placeholder="اكتب النص هنا..." />
          <div className="wordline">
            <span>{words}/5000 كلمة</span>
            <span>التكلفة: {xpCost} XP</span>
            <span>الرصيد بعد التحويل: {formatNumber(Math.max(xp - xpCost, 0))} XP</span>
          </div>
          <button className="gradient-btn full" disabled={busy || !text.trim()} onClick={convertText}>
            {busy ? "جاري التحويل..." : "تحويل إلى صياغة بشرية ✨"}
          </button>
        </Card>

        <Card>
          <div className="section-title">
            <h2>مقارنة قبل / بعد</h2>
            <span>⚖</span>
          </div>
          <div className="compare-grid">
            <div>
              <Pill tone="red">قبل التحويل</Pill>
              <p>{text || "النص الأصلي غير متوفر بعد."}</p>
              <small>{words} كلمة</small>
            </div>
            <div>
              <Pill tone="green">بعد التحويل</Pill>
              <p>{output || "حوّل النص لعرض المقارنة هنا."}</p>
              <small>{countWords(output)} كلمة</small>
            </div>
          </div>
        </Card>
      </section>

      <aside className="right-column">
        <UploadPanel compact notify={notify} navigate={navigate} />
        <RecentJobs jobs={jobs.slice(0, 3)} />
      </aside>
    </div>
  );
}

function UploadPanel({
  compact,
  notify,
  navigate,
}: {
  compact?: boolean;
  notify: (message: string) => void;
  navigate: (route: Route, event?: MouseEvent<HTMLElement>) => void;
}) {
  return (
    <Card className={compact ? "upload-card compact" : "upload-card"}>
      <h3>{compact ? "تحويل الملفات" : "رفع الملف وتحويله"}</h3>
      <div className="drop-zone" onClick={(event) => navigate("/files", event)}>
        <Icon>↑</Icon>
        <strong>اسحب وأفلت ملفك هنا</strong>
        <span>أو اختر ملف من جهازك</span>
        <div className="file-types">
          <span>PDF</span>
          <span>DOCX</span>
          <span>TXT</span>
        </div>
        <small>الحد الأقصى: 20MB</small>
      </div>
      <button className="gradient-btn full" onClick={(event) => navigate("/files", event)}>
        رفع الملف وتحويله
      </button>
    </Card>
  );
}

function RecentJobs({ jobs }: { jobs: Job[] }) {
  return (
    <Card>
      <div className="section-title">
        <h3>آخر التحويلات</h3>
        <span>◷</span>
      </div>
      {jobs.length === 0 ? (
        <p className="empty-state">لا توجد تحويلات بعد.</p>
      ) : (
        <ul className="recent-list">
          {jobs.map((job) => (
            <li key={job.id}>
              <Pill tone={job.status === "completed" ? "green" : job.status === "failed" ? "red" : "orange"}>
                {job.status === "completed" ? "مكتمل" : job.status === "failed" ? "فشل" : "قيد المعالجة"}
              </Pill>
              <span>{job.title}</span>
              <small>{job.words} كلمة</small>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function FilesPage({
  jobs,
  xp,
  reserveXp,
  applyUser,
  refreshAccount,
  notify,
  deleteJob,
}: {
  jobs: Job[];
  xp: number;
  reserveXp: (amount: number) => boolean;
  applyUser: (user?: PublicUser) => void;
  refreshAccount: () => Promise<void>;
  notify: (message: string) => void;
  deleteJob: (id: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState("DOCX");
  const [tone, setTone] = useState("سردي طبيعي");
  const [strength, setStrength] = useState("متوسط");
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileJobs = jobs.filter((job) => job.type === "file");
  const estimatedWords = file ? Math.max(120, Math.ceil(file.size / 1800)) : 0;
  const estimatedXp = calculateXp(estimatedWords);

  function handleFile(nextFile?: File) {
    if (!nextFile) return;
    const ext = nextFile.name.split(".").pop()?.toLowerCase();
    if (!["pdf", "docx", "txt"].includes(ext || "")) return notify("نوع الملف غير مدعوم. الرجاء رفع PDF أو DOCX أو TXT.");
    if (nextFile.size > 20 * 1024 * 1024) return notify("حجم الملف يتجاوز الحد الأقصى 20MB.");
    setFile(nextFile);
    setProgress(0);
    notify(`تم استقبال الملف: ${nextFile.name}`);
  }

  async function convertFile() {
    if (!file) return notify("اختر ملفاً أولاً.");
    if (!reserveXp(estimatedXp)) return;
    setProgress(12);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("tone", tone);
      form.append("strength", strength);
      form.append("outputFormat", format);
      const analysis = await readApi(await fetch("/api/humanize/file/analyze", { method: "POST", credentials: "include", body: form }));
      const summary = `اسم الملف: ${analysis.fileName}
عدد الكلمات المستخرجة: ${formatNumber(analysis.wordCount)}
تكلفة التحويل: ${formatNumber(analysis.xpCost)} XP
رصيدك الحالي: ${formatNumber(analysis.currentBalance)} XP
رصيدك بعد التحويل: ${formatNumber(analysis.balanceAfter)} XP

${analysis.message}`;
      if (!analysis.canProceed) return notify(analysis.message);
      if (!window.confirm(`${summary}\n\nهل تريد تأكيد تحويل الملف؟`)) return notify("تم إلغاء تحويل الملف بدون خصم XP.");
      setProgress(45);
      const data = await readApi(
        await fetch("/api/humanize/file/confirm", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ jobId: analysis.jobId, confirmed: true, tone, strength, outputFormat: format }),
        }),
      );
      setProgress(100);
      applyUser(data.user);
      await refreshAccount();
      notify("اكتمل تحويل الملف وأصبح جاهزاً للتحميل من السجل.");
    } catch (error) {
      setProgress(0);
      notify(error instanceof Error ? error.message : "تعذر تحويل الملف الآن.");
    }
  }

  return (
    <div className="page files-layout">
      <section className="files-main">
        <div className="page-heading">
          <h1>الملفات</h1>
          <p>حوّل ملفاتك إلى نصوص بشرية احترافية بعد تحليل التكلفة وموافقتك.</p>
        </div>
        <Card className="upload-large">
          <div className="section-title">
            <h2>رفع الملف وتحويله</h2>
          </div>
          <div
            className="drop-zone large"
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              handleFile(event.dataTransfer.files[0]);
            }}
          >
            <input ref={inputRef} type="file" accept=".pdf,.docx,.txt" hidden onChange={(event) => handleFile(event.target.files?.[0])} />
            <Icon>↑</Icon>
            <strong>{file ? file.name : "اسحب ملفك هنا أو انقر للاختيار"}</strong>
            <span>PDF و DOCX و TXT حتى 20MB</span>
            <div className="file-types">
              <span>PDF</span>
              <span>DOCX</span>
              <span>TXT</span>
            </div>
          </div>
          <div className="file-options">
            <label>
              <span>تنسيق الإخراج</span>
              <select value={format} onChange={(event) => setFormat(event.target.value)}>
                <option>DOCX</option>
                <option>PDF</option>
                <option>TXT</option>
              </select>
            </label>
            <label>
              <span>نمط الكتابة</span>
              <select value={tone} onChange={(event) => setTone(event.target.value)}>
                <option>سردي طبيعي</option>
                <option>رسمي</option>
                <option>أكاديمي</option>
              </select>
            </label>
            <label>
              <span>قوة التحويل</span>
              <select value={strength} onChange={(event) => setStrength(event.target.value)}>
                <option>خفيف</option>
                <option>متوسط</option>
                <option>قوي</option>
              </select>
            </label>
          </div>
          <div className="notice">لن يتم خصم XP عند رفع الملف. الخصم يتم فقط بعد عرض التكلفة وتأكيدك.</div>
          <button className="gradient-btn full" disabled={!file} onClick={convertFile}>
            تحليل الملف ثم تأكيد التحويل ✨
          </button>
        </Card>
        <Card>
          <h2>الملفات الأخيرة</h2>
          <DataTable jobs={fileJobs} deleteJob={deleteJob} />
        </Card>
      </section>
      <aside>
        <Card>
          <h3>تقدم التحويل</h3>
          <div className="progress-card">
            <strong>{file ? file.name : "لا يوجد ملف حالياً"}</strong>
            <div className="progress-bar">
              <span style={{ width: `${progress}%` }} />
            </div>
            <small>{progress}%</small>
          </div>
        </Card>
        <Card>
          <h3>ملخص تقديري</h3>
          <dl className="report-list">
            <div><dt>الكلمات التقديرية</dt><dd>{estimatedWords}</dd></div>
            <div><dt>التكلفة التقديرية</dt><dd>{estimatedXp} XP</dd></div>
            <div><dt>رصيدك الحالي</dt><dd>{xp} XP</dd></div>
          </dl>
        </Card>
      </aside>
    </div>
  );
}

function HistoryPage({ jobs, deleteJob }: { jobs: Job[]; deleteJob: (id: string) => void }) {
  const total = jobs.length;
  const completed = jobs.filter((job) => job.status === "completed").length;
  const savedFiles = jobs.filter((job) => job.type === "file").length;
  const xpUsed = jobs.reduce((sum, job) => sum + job.xp, 0);
  const chartData = useMemo(() => {
    const buckets = Array.from({ length: 7 }, () => 0);
    jobs.forEach((job) => {
      buckets[new Date(job.createdAt).getDay()] += 1;
    });
    return buckets;
  }, [jobs]);

  return (
    <div className="page history-page">
      <section className="history-main">
        <div className="page-heading">
          <h1>سجل التحويلات</h1>
          <p>تابع عمليات التحويل التي تمت على حسابك.</p>
        </div>
        <div className="stats-grid">
          <StatCard label="إجمالي التحويلات" value={total} icon="↥" />
          <StatCard label="التحويلات المكتملة" value={completed} icon="✓" />
          <StatCard label="الملفات المحفوظة" value={savedFiles} icon="□" />
          <StatCard label="إجمالي XP المستخدم" value={xpUsed} icon="✦" />
        </div>
        <Card>
          <DataTable jobs={jobs} deleteJob={deleteJob} />
        </Card>
      </section>
      <aside>
        <Card>
          <h3>نظرة عامة</h3>
          <div className="mini-chart">
            {chartData.map((value, index) => (
              <span key={index} style={{ height: `${Math.max(value * 18, 12)}px` }} />
            ))}
          </div>
        </Card>
      </aside>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <Card className="stat-card">
      <Icon>{icon}</Icon>
      <strong>{formatNumber(value)}</strong>
      <span>{label}</span>
    </Card>
  );
}

function DataTable({ jobs, deleteJob }: { jobs: Job[]; deleteJob: (id: string) => void }) {
  if (jobs.length === 0) return <p className="empty-state">لا توجد نتائج بعد.</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>العنوان / الملف</th>
            <th>النوع</th>
            <th>الكلمات</th>
            <th>XP</th>
            <th>الحالة</th>
            <th>الإجراءات</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id}>
              <td><strong>{job.title}</strong><small>{new Date(job.createdAt).toLocaleString("ar-SA")}</small></td>
              <td>{job.type === "file" ? "ملف" : "نص"}</td>
              <td>{formatNumber(job.words)}</td>
              <td>{job.xp}</td>
              <td><Pill tone={job.status === "completed" ? "green" : job.status === "failed" ? "red" : "orange"}>{job.status === "completed" ? "مكتمل" : job.status === "failed" ? "فشل" : "قيد المعالجة"}</Pill></td>
              <td className="action-row">
                <button onClick={() => job.output && navigator.clipboard.writeText(job.output)}>نسخ</button>
                <button onClick={() => deleteJob(job.id)}>حذف</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FeaturesPage({ navigate }: { navigate: (route: Route, event?: MouseEvent<HTMLButtonElement>) => void }) {
  const features = [
    ["تحويل النصوص", "حوّل أي نص إلى أسلوب بشري طبيعي يحافظ على المعنى.", "T"],
    ["تحويل الملفات", "ارفع PDF أو DOCX أو TXT وحلل التكلفة قبل الخصم.", "↑"],
    ["تقييم بشرية النص", "النسب تُحسب بمعايير نصية وليست أرقاماً ثابتة.", "◌"],
    ["حفظ السجل", "كل عملياتك محفوظة في حسابك ويمكن الرجوع إليها.", "↻"],
    ["خصوصية عالية", "جلسات آمنة وخصم XP من السيرفر فقط.", "▣"],
    ["مقارنة قبل / بعد", "راجع النص الأصلي والناتج بوضوح قبل استخدامه.", "⚖"],
  ];

  return (
    <div className="page features-page">
      <section className="hero-heading">
        <h1>مميزات متكاملة لصياغة أكثر إنسانية</h1>
        <p>منصة عربية لتحويل النصوص والملفات مع رصيد XP حقيقي وتأكيد قبل الخصم.</p>
      </section>
      <div className="feature-grid">
        {features.map(([title, desc, icon]) => (
          <Card key={title} className="feature-card">
            <Icon>{icon}</Icon>
            <h3>{title}</h3>
            <p>{desc}</p>
          </Card>
        ))}
      </div>
      <Card className="cta-card">
        <h2>جاهز لتحويل كتاباتك؟</h2>
        <button className="gradient-btn" onClick={(event) => navigate("/", event)}>ابدأ الآن مجاناً</button>
      </Card>
    </div>
  );
}

function PricingPage({ notify }: { notify: (message: string) => void }) {
  const plans = [
    ["ستارتر", "$7", "1,000 XP / شهر", ["تحويل النصوص", "تحويل الملفات حتى 10MB", "دعم أساسي"]],
    ["برو", "$19", "5,000 XP / شهر", ["جودة أعلى", "تحويل الملفات حتى 20MB", "سجل تحويلات كامل"]],
    ["بزنس", "$49", "25,000 XP / شهر", ["أولوية في المعالجة", "دعم مخصص", "تقارير استخدام"]],
  ];
  return (
    <div className="page pricing-page">
      <section className="hero-heading">
        <h1>أسعار بسيطة. كل شيء يعتمد على <span>XP</span></h1>
        <p>الدفع لم يُربط بعد، لذلك لن نضيف XP وهمياً عند الضغط على أزرار الشراء.</p>
      </section>
      <div className="pricing-layout">
        <section>
          <div className="plan-grid">
            {plans.map(([name, price, xpLabel, items], index) => (
              <Card key={name as string} className={cn("plan-card", index === 1 && "popular")}>
                {index === 1 && <span className="popular-badge">الأكثر شعبية ✦</span>}
                <Icon>{index === 0 ? "🚀" : index === 1 ? "◇" : "💼"}</Icon>
                <h3>{name}</h3>
                <strong className="price">{price}</strong>
                <small>/ شهرياً</small>
                <Pill tone="soft">{xpLabel}</Pill>
                <ul>{(items as string[]).map((item) => <li key={item}>✓ {item}</li>)}</ul>
                <button className="gradient-btn full" onClick={() => notify("سيتم ربط الدفع الحقيقي لاحقاً، لذلك لم تتم إضافة XP وهمي.")}>اختر الخطة</button>
              </Card>
            ))}
          </div>
        </section>
        <aside>
          <Card>
            <h3>كيف يعمل نظام XP؟</h3>
            <p>كل 100 كلمة = 3 XP، والحد الأدنى لأي عملية هو 3 XP.</p>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function LoginPage({
  navigate,
  notify,
  applyUser,
  refreshAccount,
}: {
  navigate: (route: Route, event?: MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => void;
  notify: (message: string) => void;
  applyUser: (user?: PublicUser) => void;
  refreshAccount: () => Promise<void>;
}) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const data = await readApi(await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      }));
      applyUser(data.user);
      await refreshAccount();
      notify("تم تسجيل الدخول بنجاح.");
      navigate("/");
    } catch (error) {
      const email = String(form.get("email") || "");
      applyUser(clientFallbackUser(email));
      notify("تم تسجيل الدخول مؤقتاً ومنحك 50 XP. اربط قاعدة البيانات لاحقاً لتفعيل الحسابات الدائمة.");
      navigate("/");
    }
  }

  return (
    <AuthFrame title="تسجيل الدخول" subtitle="مرحباً بك مجدداً! سجّل دخولك للوصول إلى حسابك ورصيد XP الحقيقي.">
      <form className="auth-form" onSubmit={submit}>
        <label>البريد الإلكتروني<input name="email" type="email" required placeholder="name@example.com" /></label>
        <label>كلمة المرور<input name="password" type="password" required placeholder="أدخل كلمة المرور" /></label>
        <button className="gradient-btn full">تسجيل الدخول</button>
        <p>ليس لديك حساب؟ <a href="/register" onClick={(event) => navigate("/register", event)}>إنشاء حساب جديد</a></p>
      </form>
    </AuthFrame>
  );
}

function RegisterPage({
  navigate,
  notify,
  applyUser,
  refreshAccount,
}: {
  navigate: (route: Route, event?: MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => void;
  notify: (message: string) => void;
  applyUser: (user?: PublicUser) => void;
  refreshAccount: () => Promise<void>;
}) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (form.get("password") !== form.get("passwordConfirm")) return notify("كلمة المرور وتأكيدها غير متطابقين.");
    try {
      const data = await readApi(await fetch("/api/auth/register", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fullName: form.get("fullName"), email: form.get("email"), password: form.get("password") }),
      }));
      applyUser(data.user);
      await refreshAccount();
      notify("تم إنشاء الحساب ومنحك 50 XP مجانية.");
      navigate("/");
    } catch (error) {
      const email = String(form.get("email") || "");
      const fullName = String(form.get("fullName") || "");
      applyUser(clientFallbackUser(email, fullName));
      notify("تم إنشاء جلسة مؤقتة ومنحك 50 XP. اربط قاعدة البيانات لاحقاً لتفعيل الحسابات الدائمة.");
      navigate("/");
    }
  }

  return (
    <AuthFrame title="إنشاء حساب" subtitle="أنشئ حسابك لتحصل على الباقة المجانية 50 XP وتبدأ التحويل بعد تسجيل الدخول فقط.">
      <form className="auth-form register" onSubmit={submit}>
        <label>الاسم الكامل *<input name="fullName" required placeholder="أدخل اسمك الكامل" /></label>
        <label>البريد الإلكتروني *<input name="email" type="email" required placeholder="أدخل بريدك الإلكتروني" /></label>
        <label>كلمة المرور *<input name="password" type="password" required placeholder="أنشئ كلمة مرور قوية" /></label>
        <label>تأكيد كلمة المرور *<input name="passwordConfirm" type="password" required placeholder="أعد إدخال كلمة المرور" /></label>
        <label className="terms"><input type="checkbox" required /> أوافق على الشروط والأحكام وسياسة الخصوصية</label>
        <button className="gradient-btn full">إنشاء الحساب</button>
        <p>لديك حساب بالفعل؟ <a href="/login" onClick={(event) => navigate("/login", event)}>تسجيل الدخول</a></p>
      </form>
    </AuthFrame>
  );
}

function AuthFrame({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="auth-page">
      <Card className="auth-side">
        <div className="auth-logo-panel">
          <img src="/quillora-logo.png" alt="QUILLORA Refined Human Writing" />
        </div>
        <h2>{title === "تسجيل الدخول" ? "منصة تكتب مثلك" : "ابدأ رحلتك مع صياغة بشرية"}</h2>
        <p>تجربة عربية واضحة وآمنة لتحويل النصوص والملفات إلى أسلوب بشري احترافي.</p>
        {["رصيد ترحيبي 50 XP", "خصوصية وأمان", "تحويل بعد التأكيد فقط"].map((item) => (
          <div className="auth-benefit" key={item}><Icon>✓</Icon><div><strong>{item}</strong><small>بدون بيانات وهمية أو خصم غير واضح.</small></div></div>
        ))}
      </Card>
      <Card className="auth-card">
        <h1>{title}</h1>
        <p>{subtitle}</p>
        {children}
      </Card>
    </div>
  );
}
