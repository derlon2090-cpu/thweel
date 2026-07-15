"use client";

import {
  FormEvent,
  MouseEvent,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Route = "/" | "/files" | "/history" | "/features" | "/pricing" | "/login" | "/register";
type JobStatus = "completed" | "processing" | "failed" | "awaiting_confirmation" | "cancelled";
type JobType = "text" | "file";

type Job = {
  id: string;
  title: string;
  type: JobType;
  words: number;
  xp: number;
  status: JobStatus;
  createdAt: string;
  duration: string;
  input?: string;
  output?: string;
  fileName?: string;
  fileSize?: string;
  outputFormat?: string;
  beforeHumanScore?: number;
  beforeAiScore?: number;
  afterHumanScore?: number;
  afterAiScore?: number;
  scoreReasons?: string[];
};

type Transaction = {
  id: string;
  type: "debit" | "credit" | "refund" | "welcome_bonus" | "purchase";
  amount: number;
  reason: string;
  at: string;
};

type PublicUser = {
  id: string;
  email: string;
  fullName: string;
  xpBalance: number;
  xpLevel: number;
  totalXpUsed: number;
  totalXpEarned: number;
};

const routes: { path: Route; label: string }[] = [
  { path: "/", label: "ط§ظ„ط±ط¦ظٹط³ظٹط©" },
  { path: "/files", label: "ط§ظ„ظ…ظ„ظپط§طھ" },
  { path: "/history", label: "ط³ط¬ظ„ ط§ظ„طھط­ظˆظٹظ„ط§طھ" },
  { path: "/features", label: "ط§ظ„ظ…ظ…ظٹط²ط§طھ" },
  { path: "/pricing", label: "ط§ظ„ط£ط³ط¹ط§ط±" },
];

const sampleText =
  "ظٹط´ظ‡ط¯ ط§ظ„ط¹ط§ظ„ظ… ط§ظ„ظٹظˆظ… طھط·ظˆط±ط§ظ‹ ظƒط¨ظٹط±ط§ظ‹ ظپظٹ ط§ظ„ط°ظƒط§ط، ط§ظ„ط§طµط·ظ†ط§ط¹ظٹ ط­ظٹط« ط£طµط¨ط­ ط¬ط²ط،ط§ظ‹ ظ…ظ‡ظ…ط§ظ‹ ظ…ظ† ط­ظٹط§طھظ†ط§ ط§ظ„ظٹظˆظ…ظٹط©. ظˆظ…ط¹ ظ‡ط°ط§ ط§ظ„طھط·ظˆط± ط¸ظ‡ط±طھ طھط­ط¯ظٹط§طھ طھطھط¹ظ„ظ‚ ط¨ط¬ظˆط¯ط© ط§ظ„ظ…ط­طھظˆظ‰ ط§ظ„ظ…ظƒطھظˆط¨ ظˆط¯ظ‚طھظ‡طŒ ظ„ط°ظ„ظƒ ظ†ط­طھط§ط¬ ط¥ظ„ظ‰ طµظٹط§ط؛ط© ط¨ط´ط±ظٹط© ط·ط¨ظٹط¹ظٹط© طھط­ط§ظپط¸ ط¹ظ„ظ‰ ط§ظ„ظ…ط¹ظ†ظ‰ ظˆطھط¬ط¹ظ„ ط§ظ„ظ†طµ ط£ظƒط«ط± ظˆط¶ظˆط­ط§ظ‹ ظˆط³ظ„ط§ط³ط©.";

const emptyJob: Job[] = [];

function normalizeRoute(route: string): Route {
  if (["/files", "/history", "/features", "/pricing", "/login", "/register"].includes(route)) {
    return route as Route;
  }
  return "/";
}

function nowTime() {
  return new Intl.DateTimeFormat("ar-SA", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  }).format(new Date());
}

function countWords(text: string) {
  const cleaned = text
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned ? cleaned.split(" ").filter(Boolean).length : 0;
}

function calculateXp(words: number) {
  if (!words) return 0;
  return Math.max(Math.ceil(words / 100) * 3, 3);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function mapApiJob(job: any): Job {
  return {
    id: job.id,
    title: job.title || job.fileName || "طھط­ظˆظٹظ„ ط¬ط¯ظٹط¯",
    type: job.type === "file" ? "file" : "text",
    words: job.wordCount || 0,
    xp: job.xpCost || 0,
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
    createdAt: job.createdAt || new Date().toISOString(),
    duration: job.completedAt ? "ظ…ظƒطھظ…ظ„" : "ظ‚ظٹط¯ ط§ظ„ظ…ط¹ط§ظ„ط¬ط©",
    input: job.inputText,
    output: job.outputText,
    fileName: job.fileName,
    fileSize: job.fileSize ? `${(job.fileSize / 1024 / 1024).toFixed(1)} MB` : undefined,
    outputFormat: job.outputFormat || "TXT",
    beforeHumanScore: job.beforeHumanScore ?? undefined,
    beforeAiScore: job.beforeAiScore ?? undefined,
    afterHumanScore: job.afterHumanScore ?? undefined,
    afterAiScore: job.afterAiScore ?? undefined,
    scoreReasons: job.scoreReasons ?? undefined,
  };
}

function mapApiTransaction(tx: any): Transaction {
  return {
    id: tx.id,
    type: tx.amount < 0 ? "debit" : tx.type === "refund" ? "refund" : tx.type === "welcome_bonus" ? "welcome_bonus" : "credit",
    amount: tx.amount,
    reason: tx.description || tx.type,
    at: tx.createdAt || new Date().toISOString(),
  };
}

async function readApi(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "طھط¹ط°ط± طھظ†ظپظٹط° ط§ظ„ط¹ظ…ظ„ظٹط© ط§ظ„ط¢ظ†.");
  return data;
}

function cn(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
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
    <span className={compact ? "brand-logo compact" : "brand-logo"} aria-hidden="true">
      <img src="/quillora-logo.png" alt="" />
    </span>
  );
}

export function HumanizeApp({ initialRoute }: { initialRoute: Route }) {
  const [route, setRoute] = useState<Route>(initialRoute);
  const [xp, setXp] = useState(2450);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [jobs, setJobs] = useState<Job[]>(emptyJob);
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

  const level = user?.xpLevel ?? 1;

  async function refreshAccount() {
    try {
      const me = await fetch("/api/me", { credentials: "include" });
      if (!me.ok) return;
      const meData = await me.json();
      setUser(meData.user);
      setXp(meData.user.xpBalance);

      const [jobsResponse, txResponse] = await Promise.all([
        fetch("/api/jobs", { credentials: "include" }),
        fetch("/api/xp/transactions", { credentials: "include" }),
      ]);
      if (jobsResponse.ok) {
        const data = await jobsResponse.json();
        setJobs((data.jobs || []).map(mapApiJob));
      }
      if (txResponse.ok) {
        const data = await txResponse.json();
        setTransactions((data.transactions || []).map(mapApiTransaction));
      }
    } catch {
      // Keep pages renderable if deployment environment variables are not configured yet.
    }
  }

  function applyUser(nextUser?: PublicUser) {
    if (!nextUser) return;
    setUser(nextUser);
    setXp(nextUser.xpBalance);
  }

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  function navigate(next: Route, event?: MouseEvent<HTMLAnchorElement | HTMLButtonElement>) {
    event?.preventDefault();
    setRoute(next);
    window.history.pushState({}, "", next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function reserveXp(amount: number, reason: string) {
    if (amount > xp) {
      notify(`ط±طµظٹط¯ XP ط؛ظٹط± ظƒط§ظپظچ. طھط­طھط§ط¬ ${amount} XP ظˆط±طµظٹط¯ظƒ ط§ظ„ط­ط§ظ„ظٹ ${xp} XP.`);
      return false;
    }
    return true;
  }

  function addJob(job: Job) {
    setJobs((items) => [job, ...items]);
  }

  function deleteJob(id: string) {
    setJobs((items) => items.filter((job) => job.id !== id));
    notify("طھظ… ط­ط°ظپ ط§ظ„ط¹ظ…ظ„ظٹط© ظ…ظ† ط§ظ„ط³ط¬ظ„.");
  }

  return (
    <main dir="rtl" className={cn("app-shell", route === "/login" || route === "/register" ? "auth-shell" : "")}>
      {route !== "/login" && route !== "/register" ? (
        <Header
          route={route}
          xp={xp}
          level={level}
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
          navigate={navigate}
          transactions={transactions}
        />
      ) : (
        <AuthTopbar navigate={navigate} />
      )}

      {route === "/" && (
        <HomePage jobs={jobs} xp={xp} reserveXp={reserveXp} addJob={addJob} applyUser={applyUser} notify={notify} navigate={navigate} refreshAccount={refreshAccount} />
      )}
      {route === "/files" && (
        <FilesPage jobs={jobs} reserveXp={reserveXp} addJob={addJob} applyUser={applyUser} deleteJob={deleteJob} notify={notify} navigate={navigate} refreshAccount={refreshAccount} />
      )}
      {route === "/history" && <HistoryPage jobs={jobs} deleteJob={deleteJob} notify={notify} />}
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
          <strong>طµظٹط§ط؛ط© ط¨ط´ط±ظٹط©</strong>
          <small>QUILLORA آ· ط­ظˆظ‘ظ„ ط§ظ„ظ†طµظˆطµ ط¥ظ„ظ‰ ط£ط³ظ„ظˆط¨ ط¨ط´ط±ظٹ ط§ط­طھط±ط§ظپظٹ</small>
        </span>
      </a>

      <nav className="nav-tabs" aria-label="ط§ظ„طھظ†ظ‚ظ„ ط§ظ„ط±ط¦ظٹط³ظٹ">
        {routes.map((item) => (
          <a
            key={item.path}
            href={item.path}
            className={route === item.path ? "active" : ""}
            onClick={(event) => navigate(item.path, event)}
          >
            {item.label}
          </a>
        ))}
        <a href="/login" onClick={(event) => navigate("/login", event)}>
          طھط³ط¬ظٹظ„ ط§ظ„ط¯ط®ظˆظ„
        </a>
      </nav>

      <div className="top-actions">
        <button className="gradient-btn small" onClick={(event) => navigate("/", event)}>
          ط§ط¨ط¯ط£ ط§ظ„ط¢ظ†
        </button>
        <button className="outline-btn" onClick={(event) => navigate("/files", event)}>
          <span>âکپ</span> ط±ظپط¹ ظ…ظ„ظپ
        </button>
        <button className="xp-pill" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen}>
          <span className="xp-star">âک†</span>
          <span>
            <strong>{formatNumber(xp)} XP</strong>
            <small>ط§ظ„ظ…ط³طھظˆظ‰ {level}</small>
          </span>
          <span>âŒ„</span>
        </button>
        {menuOpen && (
          <div className="xp-menu">
            <strong>ط±طµظٹط¯ظƒ ط§ظ„ط­ط§ظ„ظٹ</strong>
            <b>{formatNumber(xp)} XP</b>
            <p>ط¢ط®ط± ط¹ظ…ظ„ظٹط©: {transactions[0] ? `${transactions[0].reason} (${transactions[0].amount} XP)` : "ظ„ط§ طھظˆط¬ط¯ ط¹ظ…ظ„ظٹط§طھ ط¨ط¹ط¯"}</p>
            <button onClick={(event) => navigate("/pricing", event)}>ط´ط±ط§ط، XP</button>
            <button onClick={(event) => navigate("/history", event)}>ط³ط¬ظ„ ط§ظ„ظ…ط¹ط§ظ…ظ„ط§طھ</button>
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
          <strong>طµظٹط§ط؛ط© ط¨ط´ط±ظٹط©</strong>
          <small>QUILLORA آ· ط­ظˆظ‘ظ„ ط§ظ„ظ†طµظˆطµ ط¥ظ„ظ‰ ط£ط³ظ„ظˆط¨ ط¨ط´ط±ظٹ ط§ط­طھط±ط§ظپظٹ</small>
        </span>
      </a>
      <button className="link-btn" onClick={(event) => navigate("/", event)}>
        âŒ‚ ط§ظ„ط¹ظˆط¯ط© ظ„ظ„ط±ط¦ظٹط³ظٹط©
      </button>
    </header>
  );
}

function HomePage({
  jobs,
  xp,
  reserveXp,
  addJob,
  applyUser,
  notify,
  navigate,
  refreshAccount,
}: {
  jobs: Job[];
  xp: number;
  reserveXp: (amount: number, reason: string) => boolean;
  addJob: (job: Job) => void;
  applyUser: (user?: PublicUser) => void;
  notify: (message: string) => void;
  navigate: (route: Route, event?: MouseEvent<HTMLButtonElement>) => void;
  refreshAccount: () => Promise<void>;
}) {
  const [text, setText] = useState(sampleText);
  const [tone, setTone] = useState("ط³ط±ط¯ظٹ ط·ط¨ظٹط¹ظٹ");
  const [strength, setStrength] = useState("ظ…طھظˆط³ط·");
  const [output, setOutput] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [score, setScore] = useState<{ beforeHuman?: number; beforeAi?: number; afterHuman?: number; afterAi?: number }>({});

  const words = countWords(text);
  const xpCost = calculateXp(words);

  async function convertText() {
    if (!text.trim()) return notify("ط£ط¯ط®ظ„ ظ†طµط§ظ‹ ط£ظˆظ„ط§ظ‹ ط­طھظ‰ ظ†ط¨ط¯ط£ ط§ظ„طھط­ظˆظٹظ„.");
    if (!reserveXp(xpCost, "طھط­ظˆظٹظ„ ظ†طµ")) return;
    setBusy(true);
    setSaved(false);
    try {
      const analysis = await readApi(
        await fetch("/api/humanize/text/analyze", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text, tone, strength, preserveMeaning: true, noNewInfo: true }),
        }),
      );
      const summary = `ط¹ط¯ط¯ ط§ظ„ظƒظ„ظ…ط§طھ: ${formatNumber(analysis.wordCount)}
طھظƒظ„ظپط© ط§ظ„طھط­ظˆظٹظ„: ${formatNumber(analysis.xpCost)} XP
ط±طµظٹط¯ظƒ ط§ظ„ط­ط§ظ„ظٹ: ${formatNumber(analysis.currentBalance)} XP
ط±طµظٹط¯ظƒ ط¨ط¹ط¯ ط§ظ„طھط­ظˆظٹظ„: ${formatNumber(analysis.balanceAfter)} XP

${analysis.message}`;
      if (!analysis.canProceed) {
        notify(analysis.message);
        return;
      }
      if (!window.confirm(`${summary}\n\nظ‡ظ„ طھط±ظٹط¯ طھط£ظƒظٹط¯ ط§ظ„طھط­ظˆظٹظ„طں`)) {
        notify("طھظ… ط¥ظ„ط؛ط§ط، ط§ظ„طھط­ظˆظٹظ„ ط¨ط¯ظˆظ† ط®طµظ… XP.");
        return;
      }
      const data = await readApi(
        await fetch("/api/humanize/text/confirm", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text, tone, strength, preserveMeaning: true, noNewInfo: true, confirmed: true }),
        }),
      );
      const nextJob = mapApiJob(data.job);
      setOutput(nextJob.output || "");
      setScore({
        beforeHuman: nextJob.beforeHumanScore,
        beforeAi: nextJob.beforeAiScore,
        afterHuman: nextJob.afterHumanScore,
        afterAi: nextJob.afterAiScore,
      });
      setSaved(true);
      addJob(nextJob);
      applyUser(data.user);
      await refreshAccount();
      notify(`طھظ… ط§ظ„طھط­ظˆظٹظ„ ظˆط®طµظ… ${xpCost} XP ظ…ظ† ط±طµظٹط¯ظƒ ط§ظ„ط­ظ‚ظٹظ‚ظٹ.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "طھط¹ط°ط± طھط­ظˆظٹظ„ ط§ظ„ظ†طµ ط§ظ„ط¢ظ†.");
    } finally {
      setBusy(false);
    }
  }

  function quickAction(action: string) {
    const base = output || text;
    const actions: Record<string, string> = {
      "ط£ظƒط«ط± ط±ط³ظ…ظٹط©": `ط¨طµظٹط§ط؛ط© ط£ظƒط«ط± ط±ط³ظ…ظٹط©: ${base}`,
      "طھظ‚طµظٹط± ط§ظ„ظپظ‚ط±ط§طھ": base.split(".").filter(Boolean).slice(0, 2).join(". ") + ".",
      "ط¥ط¶ط§ظپط© ط£ظ…ط«ظ„ط© طھط·ط¨ظٹظ‚ظٹط©": `${base}\n\nظ…ط«ط§ظ„ طھط·ط¨ظٹظ‚ظٹ: ظٹظ…ظƒظ† ط§ط³طھط®ط¯ط§ظ… ظ‡ط°ظ‡ ط§ظ„طµظٹط§ط؛ط© ظپظٹ ظ…ظ‚ط§ظ„طŒ طھظ‚ط±ظٹط±طŒ ط£ظˆ ظˆطµظپ طھط³ظˆظٹظ‚ظٹ ظ…ط¹ ط§ظ„ط­ظپط§ط¸ ط¹ظ„ظ‰ ط§ظ„ظ…ط¹ظ†ظ‰ ط§ظ„ط£طµظ„ظٹ.`,
      "ظ„ظ‡ط¬ط© ط³ط¹ظˆط¯ظٹط© ط®ظپظٹظپط©": base.replace(/ظ„ط°ظ„ظƒ/g, "ط¹ط´ط§ظ† ظƒط°ط§").replace(/ط¬ط¯ط§ظ‹/g, "ظ…ط±ط©"),
      "طھظˆط³ظٹط¹ ط§ظ„ظ†طµ": `${base}\n\nظƒظ…ط§ ط£ظ† ظˆط¶ظˆط­ ط§ظ„ط£ظپظƒط§ط± ظˆطھط±طھظٹط¨ظ‡ط§ ظٹط³ط§ط¹ط¯ ط§ظ„ظ‚ط§ط±ط¦ ط¹ظ„ظ‰ ظپظ‡ظ… ط§ظ„ط±ط³ط§ظ„ط© ط¨ط³ط±ط¹ط©طŒ ظˆظٹط¬ط¹ظ„ ط§ظ„ظ†طµ ط£ظ‚ط±ط¨ ظ„ظ„ط£ط³ظ„ظˆط¨ ط§ظ„ط¨ط´ط±ظٹ ط§ظ„ط·ط¨ظٹط¹ظٹ.`,
      "طھطµط­ظٹط­ ط§ظ„ط£ط®ط·ط§ط،": base.replace(/\s+/g, " ").trim(),
    };
    setOutput(actions[action] || base);
    notify(`طھظ… طھط·ط¨ظٹظ‚: ${action}`);
  }

  function download() {
    const blob = new Blob([output || text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "humanized-text.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="page work-page">
      <aside className="side-column">
        <Card>
          <div className="section-title">
            <h3>ط§ظ„ظ†ط§طھط¬ ط§ظ„ط¨ط´ط±ظٹط©</h3>
            <span>âœ¥</span>
          </div>
          <div className="result-box">
            {output || "ط³ظٹط¸ظ‡ط± ط§ظ„ظ†طµ ط§ظ„ظ†ط§طھط¬ ظ‡ظ†ط§ ط¨ط¹ط¯ ط§ظ„طھط­ظˆظٹظ„. ط§ظƒطھط¨ ظ†طµظƒ ظˆط§ط®طھط± ط§ظ„ظ†ظ…ط· ظˆظ‚ظˆط© ط§ظ„طھط­ظˆظٹظ„ ط«ظ… ط§ط¶ط؛ط· ط²ط± ط§ظ„طھط­ظˆظٹظ„."}
          </div>
          <div className="wordline">
            <span>{countWords(output || text)}/5000 ظƒظ„ظ…ط©</span>
            {saved && <Pill tone="green">ط¬ط§ظ‡ط²</Pill>}
          </div>
        </Card>
        <Card>
          <div className="section-title">
            <h3>ط¯ط±ط¬ط© ط¨ط´ط±ظٹط© ط§ظ„ظ†طµ</h3>
            <span>â“ک</span>
          </div>
          <div className="human-score">
            <div className="score-card muted">
              <small>ظ‚ط¨ظ„ ط§ظ„طھط³ط¬ظٹظ„</small>
              <strong>{score.beforeAi !== undefined ? `${score.beforeAi}%` : "â€”"}</strong>
              <span>AI</span>
            </div>
            <div className="donut" aria-label={`ط¯ط±ط¬ط© ط¨ط´ط±ظٹط© ${score.afterHuman ?? 0}%`}>{score.afterHuman ?? "â€”"}</div>
            <div className="score-card green">
              <small>طھظ… ط§ظ„طھط³ط¬ظٹظ„</small>
              <strong>{score.afterHuman !== undefined ? `${score.afterHuman}%` : "â€”"}</strong>
              <span>ط¨ط´ط±ظٹ</span>
            </div>
          </div>
          <div className="triple-actions">
            <button onClick={() => navigator.clipboard.writeText(output || text).then(() => notify("طھظ… ظ†ط³ط® ط§ظ„ظ†طµ."))}>ظ†ط³ط® ط§ظ„ظ†طµ â§‰</button>
            <button onClick={download}>طھط­ظ…ظٹظ„ â‡©</button>
            <button
              onClick={() =>
                navigator.share
                  ? navigator.share({ title: "طµظٹط§ط؛ط© ط¨ط´ط±ظٹط©", text: output || text })
                  : navigator.clipboard.writeText(output || text).then(() => notify("طھظ… ظ†ط³ط® ط§ظ„ظ†طµ ظ„ظ„ظ…ط´ط§ط±ظƒط©."))
              }
            >
              ظ…ط´ط§ط±ظƒط© â¤´
            </button>
          </div>
        </Card>
        <Card>
          <div className="section-title">
            <h3>ط§ظ‚طھط±ط§ط­ط§طھ ط³ط±ظٹط¹ط©</h3>
            <span>â†¯</span>
          </div>
          <div className="chip-grid">
            {["ط£ظƒط«ط± ط±ط³ظ…ظٹط©", "طھظ‚طµظٹط± ط§ظ„ظپظ‚ط±ط§طھ", "ط¥ط¶ط§ظپط© ط£ظ…ط«ظ„ط© طھط·ط¨ظٹظ‚ظٹط©", "ظ„ظ‡ط¬ط© ط³ط¹ظˆط¯ظٹط© ط®ظپظٹظپط©", "طھظˆط³ظٹط¹ ط§ظ„ظ†طµ", "طھطµط­ظٹط­ ط§ظ„ط£ط®ط·ط§ط،"].map((item) => (
              <button key={item} onClick={() => quickAction(item)}>
                {item}
              </button>
            ))}
          </div>
        </Card>
        <Card>
          <div className="section-title">
            <h3>ط£ط¯ظˆط§طھ ط§ظ„طھط­ط³ظٹظ† ط§ظ„ط°ظƒظٹط©</h3>
            <span>âœژ</span>
          </div>
          <div className="tool-grid">
            {["ط¥ط¹ط§ط¯ط© ظƒطھط§ط¨ط©", "طھط¨ط³ظٹط·", "ظ…ط³ط§ط¹ط¯ط©", "طھظ†ط³ظٹظ‚ ط§ظ„ظپظ‚ط±ط§طھ", "ط¥ط²ط§ظ„ط© ط§ظ„طھظƒط±ط§ط±"].map((item) => (
              <button key={item} onClick={() => quickAction(item === "ط¥ط¹ط§ط¯ط© ظƒطھط§ط¨ط©" ? "طھظˆط³ظٹط¹ ط§ظ„ظ†طµ" : item)}>
                {item}
              </button>
            ))}
          </div>
        </Card>
      </aside>

      <section className="main-column">
        <Card className="converter-card">
          <div className="section-title">
            <h2>طھط­ظˆظٹظ„ ط§ظ„ظ†طµ</h2>
            <span>â–±</span>
          </div>
          <div className="control-row">
            <label>
              <span>ظ†ظ…ط· ط§ظ„ظƒطھط§ط¨ط©</span>
              <select value={tone} onChange={(event) => setTone(event.target.value)}>
                {["ط³ط±ط¯ظٹ ط·ط¨ظٹط¹ظٹ", "ط±ط³ظ…ظٹ", "ط£ظƒط§ط¯ظٹظ…ظٹ", "طھط³ظˆظٹظ‚ظٹ", "ط³ط¹ظˆط¯ظٹ ط·ط¨ظٹط¹ظٹ"].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label>
              <span>ظ‚ظˆط© ط§ظ„طھط­ظˆظٹظ„</span>
              <div className="segmented">
                {["ط®ظپظٹظپ", "ظ…طھظˆط³ط·", "ظ‚ظˆظٹ"].map((item) => (
                  <button key={item} className={strength === item ? "selected" : ""} onClick={() => setStrength(item)}>
                    {item}
                  </button>
                ))}
              </div>
            </label>
          </div>
          <div className="check-row">
            <label>
              <input type="checkbox" checked readOnly /> ط§ظ„ط­ظپط§ط¸ ط¹ظ„ظ‰ ط§ظ„ظ…ط¹ظ†ظ‰
            </label>
            <label>
              <input type="checkbox" checked readOnly /> ط¹ط¯ظ… ط¥ط¶ط§ظپط© ظ…ط¹ظ„ظˆظ…ط§طھ ط¬ط¯ظٹط¯ط©
            </label>
          </div>
          <textarea value={text} onChange={(event) => setText(event.target.value)} maxLength={5000} />
          <div className="estimate-row">
            <span>{words}/5000 ظƒظ„ظ…ط©</span>
            <span>ط§ظ„طھظƒظ„ظپط©: {xpCost} XP</span>
            <span>ط§ظ„ط±طµظٹط¯ ط¨ط¹ط¯ ط§ظ„ط®طµظ…: {formatNumber(Math.max(xp - xpCost, 0))} XP</span>
            {saved && <span className="saved">âœ“ طھظ… ط§ظ„ط­ظپط¸</span>}
          </div>
          <button className="gradient-btn full" disabled={busy || !text.trim()} onClick={convertText}>
            {busy ? "ط¬ط§ط±ظٹ ط§ظ„طھط­ظˆظٹظ„..." : "طھط­ظˆظٹظ„ ط¥ظ„ظ‰ طµظٹط§ط؛ط© ط¨ط´ط±ظٹط© âœ¨"}
          </button>
        </Card>

        <Card>
          <div className="section-title center-title">
            <h2>ظ…ظ‚ط§ط±ظ†ط© ظ‚ط¨ظ„ / ط¨ط¹ط¯</h2>
            <span>âڑ–</span>
          </div>
          <div className="compare-grid">
            <div>
              <Pill tone="red">ظ‚ط¨ظ„ ط§ظ„طھط­ظˆظٹظ„ (ط§ظ„ظ†طµ ط§ظ„ط£طµظ„ظٹ)</Pill>
              <p>{text || "ط§ظ„ظ†طµ ط§ظ„ط£طµظ„ظٹ ط؛ظٹط± ظ…طھظˆظپط± ط¨ط¹ط¯."}</p>
              <small>{words} ظƒظ„ظ…ط©</small>
            </div>
            <button className="swap-btn">â†”</button>
            <div>
              <Pill tone="green">ط¨ط¹ط¯ ط§ظ„طھط­ظˆظٹظ„ (ط§ظ„ظ†طµ ط§ظ„ط¨ط´ط±ظٹ)</Pill>
              <p>{output || "ط­ظˆظ‘ظ„ ط§ظ„ظ†طµ ظ„ط¹ط±ط¶ ط§ظ„ظ…ظ‚ط§ط±ظ†ط© ظ‡ظ†ط§."}</p>
              <small>{countWords(output)} ظƒظ„ظ…ط©</small>
            </div>
          </div>
        </Card>
      </section>

      <aside className="side-column">
        <UploadPanel compact navigate={navigate} notify={notify} />
        <Card>
          <h3>ظ…ط³ط§ط± ط§ظ„ظ…ط¹ط§ظ„ط¬ط©</h3>
          <div className="process-flow">
            {["ط§ظ„ظ…ظ„ظپ ط§ظ„ظ…ط·ظ„ظˆط¨", "طھط­ظ„ظٹظ„ ط§ظ„ظ…ط­طھظˆظ‰", "ط§ط³طھط®ط±ط§ط¬ ط§ظ„ظ†طµ", "ط±ظپط¹ ط§ظ„ظ…ظ„ظپ"].map((step, index) => (
              <div key={step} className={index === 3 ? "active" : ""}>
                <span>{index + 1}</span>
                <small>{step}</small>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h3>طھظ‚ط±ظٹط± ط§ظ„طھط­ظˆظٹظ„</h3>
          <dl className="report-list">
            <div><dt>ط¹ط¯ط¯ ط§ظ„ظƒظ„ظ…ط§طھ</dt><dd>{words}</dd></div>
            <div><dt>ط¹ط¯ط¯ ط§ظ„ظپظ‚ط±ط§طھ</dt><dd>{Math.max(text.split("\n").filter(Boolean).length, 1)}</dd></div>
            <div><dt>ظ…طھظˆط³ط· ط§ظ„ط¬ظ…ظ„</dt><dd>{Math.max(text.split(".").filter(Boolean).length, 1)}</dd></div>
            <div><dt>ط²ظ…ظ† ط§ظ„ظ…ط¹ط§ظ„ط¬ط©</dt><dd>{busy ? "ط¬ط§ط±ظٹ" : "12 ط«ط§ظ†ظٹط©"}</dd></div>
            <div><dt>ظ†ظˆط¹ ط§ظ„ظ…ظ„ظپ ط§ظ„ظ†ظ‡ط§ط¦ظٹ</dt><dd>DOCX</dd></div>
          </dl>
        </Card>
        <Card>
          <div className="section-title">
            <h3>ط¢ط®ط± ط§ظ„طھط­ظˆظٹظ„ط§طھ</h3>
            <span>â—·</span>
          </div>
          <RecentJobs jobs={jobs.slice(0, 4)} />
          <button className="link-btn" onClick={(event) => navigate("/history", event)}>
            ط¹ط±ط¶ ط¬ظ…ظٹط¹ ط§ظ„طھط­ظˆظٹظ„ط§طھ â†گ
          </button>
        </Card>
      </aside>
    </div>
  );
}

function UploadPanel({
  compact = false,
  navigate,
  notify,
}: {
  compact?: boolean;
  navigate?: (route: Route, event?: MouseEvent<HTMLButtonElement>) => void;
  notify: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <Card className={compact ? "upload-card compact" : "upload-card"}>
      <h3>{compact ? "طھط­ظˆظٹظ„ ط§ظ„ظ…ظ„ظپط§طھ" : "ط±ظپط¹ ط§ظ„ظ…ظ„ظپ ظˆطھط­ظˆظٹظ„ظ‡"}</h3>
      <div className="drop-zone" onClick={() => inputRef.current?.click()}>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.txt"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            const ext = file.name.split(".").pop()?.toLowerCase();
            if (!["pdf", "docx", "txt"].includes(ext || "")) return notify("ظ†ظˆط¹ ط§ظ„ظ…ظ„ظپ ط؛ظٹط± ظ…ط¯ط¹ظˆظ…. ط§ط±ظپط¹ PDF ط£ظˆ DOCX ط£ظˆ TXT.");
            if (file.size > 20 * 1024 * 1024) return notify("ط­ط¬ظ… ط§ظ„ظ…ظ„ظپ ظٹطھط¬ط§ظˆط² ط§ظ„ط­ط¯ ط§ظ„ط£ظ‚طµظ‰ 20MB.");
            notify(`طھظ… ط§ط®طھظٹط§ط± ط§ظ„ظ…ظ„ظپ: ${file.name}`);
          }}
        />
        <Icon>âکپ</Icon>
        <strong>ط§ط³ط­ط¨ ظˆط£ظپظ„طھ ظ…ظ„ظپظƒ ظ‡ظ†ط§</strong>
        <span>ط£ظˆ ط§ط®طھط± ظ…ظ„ظپ ظ…ظ† ط¬ظ‡ط§ط²ظƒ</span>
        <div className="file-types">
          <span>PDF</span>
          <span>DOCX</span>
          <span>TXT</span>
        </div>
        <small>ط§ظ„ط­ط¯ ط§ظ„ط£ظ‚طµظ‰: 20MB</small>
      </div>
      <button className="gradient-btn full" onClick={(event) => navigate?.("/files", event)}>
        ط±ظپط¹ ط§ظ„ظ…ظ„ظپ ظˆطھط­ظˆظٹظ„ظ‡
      </button>
    </Card>
  );
}

function RecentJobs({ jobs }: { jobs: Job[] }) {
  if (!jobs.length) {
    return <p className="empty-state">ظ„ط§ طھظˆط¬ط¯ طھط­ظˆظٹظ„ط§طھ ط¨ط¹ط¯. ط³طھط¸ظ‡ط± ط¹ظ…ظ„ظٹط§طھظƒ ظ‡ظ†ط§ ظپظˆط± طھظ†ظپظٹط° ط£ظˆظ„ طھط­ظˆظٹظ„.</p>;
  }
  return (
    <div className="recent-list">
      {jobs.map((job) => (
        <div key={job.id}>
          <Pill tone={job.status === "completed" ? "green" : job.status === "failed" ? "red" : "orange"}>
            {job.status === "completed" ? "ظ…ظƒطھظ…ظ„" : job.status === "failed" ? "ظپط´ظ„" : "ظ‚ظٹط¯ ط§ظ„ظ…ط¹ط§ظ„ط¬ط©"}
          </Pill>
          <span>{job.title}</span>
          <small>{job.words} ظƒظ„ظ…ط©</small>
        </div>
      ))}
    </div>
  );
}

function FilesPage({
  jobs,
  reserveXp,
  addJob,
  applyUser,
  deleteJob,
  notify,
  refreshAccount,
}: {
  jobs: Job[];
  reserveXp: (amount: number, reason: string) => boolean;
  addJob: (job: Job) => void;
  applyUser: (user?: PublicUser) => void;
  deleteJob: (id: string) => void;
  notify: (message: string) => void;
  navigate: (route: Route, event?: MouseEvent<HTMLButtonElement>) => void;
  refreshAccount: () => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState("DOCX");
  const [tone, setTone] = useState("ط³ط±ط¯ظٹ ط·ط¨ظٹط¹ظٹ");
  const [strength, setStrength] = useState("ظ…طھظˆط³ط·");
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileJobs = jobs.filter((job) => job.type === "file");
  const fileWords = file ? Math.max(120, Math.ceil(file.size / 1800)) : 0;
  const fileXp = calculateXp(fileWords);

  function handleFile(nextFile?: File) {
    if (!nextFile) return;
    const ext = nextFile.name.split(".").pop()?.toLowerCase();
    if (!["pdf", "docx", "txt"].includes(ext || "")) return notify("ظ†ظˆط¹ ط§ظ„ظ…ظ„ظپ ط؛ظٹط± ظ…ط¯ط¹ظˆظ…. ط§ظ„ط±ط¬ط§ط، ط±ظپط¹ PDF ط£ظˆ DOCX ط£ظˆ TXT.");
    if (nextFile.size > 20 * 1024 * 1024) return notify("ط­ط¬ظ… ط§ظ„ظ…ظ„ظپ ظٹطھط¬ط§ظˆط² ط§ظ„ط­ط¯ ط§ظ„ط£ظ‚طµظ‰ 20MB.");
    setFile(nextFile);
    setProgress(0);
    setStage(0);
    notify(`طھظ… ط§ط³طھظ‚ط¨ط§ظ„ ط§ظ„ظ…ظ„ظپ: ${nextFile.name}`);
  }

  async function convertFile() {
    if (!file) return notify("ط§ط®طھط± ظ…ظ„ظپط§ظ‹ ط£ظˆظ„ط§ظ‹.");
    if (!reserveXp(fileXp, "طھط­ظˆظٹظ„ ظ…ظ„ظپ")) return;
    setProgress(12);
    setStage(0);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("tone", tone);
      form.append("strength", strength);
      form.append("outputFormat", format);
      setProgress(30);
      const analysis = await readApi(await fetch("/api/humanize/file/analyze", { method: "POST", credentials: "include", body: form }));
      const summary = `ط§ط³ظ… ط§ظ„ظ…ظ„ظپ: ${analysis.fileName}
ط¹ط¯ط¯ ط§ظ„ظƒظ„ظ…ط§طھ ط§ظ„ظ…ط³طھط®ط±ط¬ط©: ${formatNumber(analysis.wordCount)}
طھظƒظ„ظپط© ط§ظ„طھط­ظˆظٹظ„: ${formatNumber(analysis.xpCost)} XP
ط±طµظٹط¯ظƒ ط§ظ„ط­ط§ظ„ظٹ: ${formatNumber(analysis.currentBalance)} XP
ط±طµظٹط¯ظƒ ط¨ط¹ط¯ ط§ظ„طھط­ظˆظٹظ„: ${formatNumber(analysis.balanceAfter)} XP

${analysis.message}`;
      if (!analysis.canProceed) {
        notify(analysis.message);
        return;
      }
      if (!window.confirm(`${summary}\n\nظ‡ظ„ طھط±ظٹط¯ طھط£ظƒظٹط¯ طھط­ظˆظٹظ„ ط§ظ„ظ…ظ„ظپطں`)) {
        notify("طھظ… ط¥ظ„ط؛ط§ط، طھط­ظˆظٹظ„ ط§ظ„ظ…ظ„ظپ ط¨ط¯ظˆظ† ط®طµظ… XP.");
        return;
      }
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
      setStage(4);
      addJob(mapApiJob(data.job));
      applyUser(data.user);
      await refreshAccount();
      notify("ط§ظƒطھظ…ظ„ طھط­ظˆظٹظ„ ط§ظ„ظ…ظ„ظپ ظˆط£طµط¨ط­ ط¬ط§ظ‡ط²ط§ظ‹ ظ„ظ„طھط­ظ…ظٹظ„ ظ…ظ† ط§ظ„ط³ط¬ظ„.");
    } catch (error) {
      setProgress(0);
      notify(error instanceof Error ? error.message : "طھط¹ط°ط± طھط­ظˆظٹظ„ ط§ظ„ظ…ظ„ظپ ط§ظ„ط¢ظ†.");
    }
  }

  return (
    <div className="page files-layout">
      <section className="files-main">
        <div className="page-heading">
          <h1>ط§ظ„ظ…ظ„ظپط§طھ</h1>
          <p>ط­ظˆظ‘ظ„ ظ…ظ„ظپط§طھظƒ ط¥ظ„ظ‰ ظ†طµظˆطµ ط¨ط´ط±ظٹط© ط§ط­طھط±ط§ظپظٹط©</p>
        </div>
        <Card className="upload-large">
          <div className="section-title">
            <h2>ط±ظپط¹ ط§ظ„ظ…ظ„ظپ ظˆطھط­ظˆظٹظ„ظ‡</h2>
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
            <Icon>â†‘</Icon>
            <strong>{file ? file.name : "ط§ط³ط­ط¨ ظ…ظ„ظپظƒ ظ‡ظ†ط§ ط£ظˆ ط§ظ†ظ‚ط± ظ„ظ„ط§ط®طھظٹط§ط±"}</strong>
            <span>ط³ظ†ط¯ط¹ظ…ظƒ ظپظٹ طھط­ظˆظٹظ„ ظ…ظ„ظپط§طھظƒ ط¥ظ„ظ‰ ظ†طµظˆطµ ط¨ط´ط±ظٹط© ط¹ط§ظ„ظٹط© ط§ظ„ط¬ظˆط¯ط©</span>
            <div className="file-types">
              <span>PDF</span>
              <span>DOCX</span>
              <span>TXT</span>
            </div>
            <small>ط§ظ„ط­ط¬ظ… ط§ظ„ط£ظ‚طµظ‰ ظ„ظ„ظ…ظ„ظپ: 20MB</small>
          </div>
          <button className="gradient-btn center" onClick={convertFile}>
            ط±ظپط¹ ط§ظ„ظ…ظ„ظپ ظˆطھط­ظˆظٹظ„ظ‡ âœ¨
          </button>
          <div className="file-options">
            <label><span>ظ†ظ…ط· ط§ظ„ظƒطھط§ط¨ط©</span><select value={tone} onChange={(e) => setTone(e.target.value)}><option>ط³ط±ط¯ظٹ ط·ط¨ظٹط¹ظٹ</option><option>ط±ط³ظ…ظٹ</option><option>ط£ظƒط§ط¯ظٹظ…ظٹ</option></select></label>
            <label><span>ظ‚ظˆط© ط§ظ„طھط­ظˆظٹظ„</span><select value={strength} onChange={(e) => setStrength(e.target.value)}><option>ط®ظپظٹظپ</option><option>ظ…طھظˆط³ط·</option><option>ظ‚ظˆظٹ</option></select></label>
            <label><span>ط§ظ„ط­ظپط§ط¸ ط¹ظ„ظ‰ ط§ظ„ظ…ط¹ظ†ظ‰</span><input type="checkbox" checked readOnly /></label>
            <label><span>ظ…ط¹ظ„ظˆظ…ط§طھ ط¬ط¯ظٹط¯ط©</span><input type="checkbox" checked readOnly /></label>
            <label><span>طھظ†ط³ظٹظ‚ ط§ظ„ط¥ط®ط±ط§ط¬</span><select value={format} onChange={(e) => setFormat(e.target.value)}><option>DOCX</option><option>PDF</option><option>TXT</option></select></label>
          </div>
          <div className="notice">ط¬ظ…ظٹط¹ ط§ظ„طھط­ظˆظٹظ„ط§طھ طھطھظ… ظ…ط¹ ط§ظ„ط­ظپط§ط¸ ط¹ظ„ظ‰ ط§ظ„ظ…ط¹ظ†ظ‰ ظˆط§ظ„ط­ظ‚ط§ط¦ظ‚ ط§ظ„ط£طµظ„ظٹط© ظ„ظ„ظ†طµ.</div>
        </Card>

        <Card>
          <div className="section-title">
            <h2>ط§ظ„ظ…ظ„ظپط§طھ ط§ظ„ط£ط®ظٹط±ط©</h2>
          </div>
          <DataTable jobs={fileJobs} deleteJob={deleteJob} notify={notify} />
        </Card>
      </section>
      <aside className="files-side">
        <Card>
          <h3>ظ…ط±ط§ط­ظ„ ط§ظ„ظ…ط¹ط§ظ„ط¬ط©</h3>
          <div className="vertical-steps">
            {["ط§ط³طھظ‚ط¨ط§ظ„ ط§ظ„ظ…ظ„ظپ", "ط§ط³طھط®ط±ط§ط¬ ط§ظ„ظ†طµ", "ظ…ط¹ط§ظ„ط¬ط© ظˆطھط­ظˆظٹظ„", "ظ…ط±ط§ط¬ط¹ط© ظ†ظ‡ط§ط¦ظٹط©", "ط¬ط§ط±ظٹ ط§ظ„ط­ظپط¸"].map((item, index) => (
              <div key={item} className={index <= stage ? "done" : ""}>
                <span>{index + 1}</span>
                <div><strong>{item}</strong><small>{index <= stage ? "طھظ…طھ ط§ظ„ظ…ط±ط­ظ„ط© ط£ظˆ ظ‚ظٹط¯ ط§ظ„طھظ†ظپظٹط°" : "ط¨ط§ظ†طھط¸ط§ط± ط§ظ„ط¯ظˆط±"}</small></div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h3>طھظ‚ط¯ظ… ط§ظ„طھط­ظˆظٹظ„ (ظ…ط¨ط§ط´ط±)</h3>
          <div className="file-card-row">
            <Icon>{file?.name.endsWith(".pdf") ? "PDF" : "W"}</Icon>
            <div><strong>{file?.name || "ظ„ظ… ظٹطھظ… ط§ط®طھظٹط§ط± ظ…ظ„ظپ"}</strong><small>{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : "â€”"}</small></div>
          </div>
          <div className="progress"><span style={{ width: `${progress}%` }} /></div>
          <strong className="progress-label">{progress}%</strong>
          <p className="status-text">{progress === 100 ? "ط§ظƒطھظ…ظ„ ط§ظ„طھط­ظˆظٹظ„" : progress ? "ط¬ط§ط±ظٹ ط§ظ„ظ…ط¹ط§ظ„ط¬ط©..." : "ط¨ط§ظ†طھط¸ط§ط± ط§ظ„ط±ظپط¹"}</p>
        </Card>
        <Card>
          <h3>ظ…ظ„ط®طµ ط§ظ„طھط­ظˆظٹظ„</h3>
          <dl className="report-list">
            <div><dt>ط§ظ„ظ…ظ„ظپ ط§ظ„ط£طµظ„ظٹ</dt><dd>{file?.name || "â€”"}</dd></div>
            <div><dt>ط­ط¬ظ… ط§ظ„ظ…ظ„ظپ</dt><dd>{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : "â€”"}</dd></div>
            <div><dt>ط¹ط¯ط¯ ط§ظ„ظƒظ„ظ…ط§طھ</dt><dd>{fileWords || "â€”"}</dd></div>
            <div><dt>XP ط§ظ„ظ…ط®طµظˆظ…</dt><dd>{fileXp || "â€”"}</dd></div>
            <div><dt>طھظ†ط³ظٹظ‚ ط§ظ„ط¥ط®ط±ط§ط¬</dt><dd>{format}</dd></div>
          </dl>
        </Card>
        <Card>
          <h3>ط£ط¯ظˆط§طھ ط³ط±ظٹط¹ط©</h3>
          <div className="quick-cards">
            <button onClick={() => inputRef.current?.click()}>طھط­ظˆظٹظ„ ظ…ظ„ظپ ط¬ط¯ظٹط¯ â†‘</button>
            <button onClick={() => notify("ط§ظپطھط­ ط³ط¬ظ„ظƒ ظ„ط§ط®طھظٹط§ط± ط¹ظ…ظ„ظٹطھظٹظ† ظ„ظ„ظ…ظ‚ط§ط±ظ†ط©.")}>ظ…ظ‚ط§ط±ظ†ط© ط§ظ„ظ†طµظˆطµ âڑ–</button>
            <button onClick={() => notify("طھظ… ظپط­طµ ط§ظ„ظ…ط¹ظ†ظ‰ ظ…ط­ظ„ظٹط§ظ‹.")}>طھط¯ظ‚ظٹظ‚ ط§ظ„ظ…ط¹ظ†ظ‰ ًں›،</button>
            <button onClick={() => file && convertFile()}>ط¥ط¹ط§ط¯ط© طھط­ظˆظٹظ„ â†»</button>
          </div>
        </Card>
      </aside>
    </div>
  );
}

function HistoryPage({
  jobs,
  deleteJob,
  notify,
}: {
  jobs: Job[];
  deleteJob: (id: string) => void;
  notify: (message: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ط§ظ„ظƒظ„");
  const filtered = jobs.filter((job) => {
    const matchesSearch = `${job.title} ${job.fileName || ""}`.includes(search);
    const matchesFilter =
      filter === "ط§ظ„ظƒظ„" ||
      (filter === "ظ†طµ" && job.type === "text") ||
      (filter === "ظ…ظ„ظپ" && job.type === "file") ||
      (filter === "ظ…ظƒطھظ…ظ„ط©" && job.status === "completed") ||
      (filter === "ظپط´ظ„" && job.status === "failed");
    return matchesSearch && matchesFilter;
  });
  const completed = jobs.filter((job) => job.status === "completed").length;
  const savedFiles = jobs.filter((job) => job.type === "file").length;
  const xpUsed = jobs.reduce((sum, job) => sum + job.xp, 0);
  const chartData = useMemo(() => {
    const buckets = Array.from({ length: 7 }, () => 0);
    jobs.forEach((job) => {
      const dayIndex = new Date(job.createdAt).getDay();
      buckets[dayIndex] += 1;
    });
    const max = Math.max(...buckets, 1);
    return buckets.map((value) => Math.max(6, Math.round((value / max) * 86)));
  }, [jobs]);

  return (
    <div className="page history-layout">
      <section>
        <div className="page-heading">
          <h1>ط³ط¬ظ„ ط§ظ„طھط­ظˆظٹظ„ط§طھ</h1>
          <p>طھطھط¨ط¹ ط¬ظ…ظٹط¹ ط¹ظ…ظ„ظٹط§طھ ط§ظ„طھط­ظˆظٹظ„ ط§ظ„طھظٹ ظ‚ظ…طھ ط¨ظ‡ط§ ظˆط¥ط¯ط§ط±ط© ظ†طھط§ط¦ط¬ظƒ ط¨ط³ظ‡ظˆظ„ط©</p>
        </div>
        <div className="stats-grid">
          <StatCard label="ط¥ط¬ظ…ط§ظ„ظٹ ط§ظ„طھط­ظˆظٹظ„ط§طھ" value={jobs.length} icon="â‡§" />
          <StatCard label="ط§ظ„طھط­ظˆظٹظ„ط§طھ ط§ظ„ظ…ظƒطھظ…ظ„ط©" value={completed} icon="âœ“" />
          <StatCard label="ط§ظ„ظ…ظ„ظپط§طھ ط§ظ„ظ…ط­ظپظˆط¸ط©" value={savedFiles} icon="â–،" />
          <StatCard label="ط¥ط¬ظ…ط§ظ„ظٹ ظ†ظ‚ط§ط· XP" value={xpUsed} icon="âک†" />
        </div>
        <Card>
          <div className="filters-row">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ط§ط¨ط­ط« ط¹ظ† ط¹ظ†ظˆط§ظ† ط£ظˆ ط§ط³ظ… ظ…ظ„ظپ..." />
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              {["ط§ظ„ظƒظ„", "ظ†طµ", "ظ…ظ„ظپ", "ظ…ظƒطھظ…ظ„ط©", "ظپط´ظ„"].map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>
          <div className="filter-chips">
            {["ط§ظ„ظƒظ„", "ط§ظ„ظٹظˆظ…", "ظ‡ط°ط§ ط§ظ„ط£ط³ط¨ظˆط¹", "ظ…طھط§ط¨ط¹ط©", "ظپط´ظ„", "ظ…ظ„ظپ", "ظ†طµ"].map((item) => (
              <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item === "ط§ظ„ظٹظˆظ…" || item === "ظ‡ط°ط§ ط§ظ„ط£ط³ط¨ظˆط¹" || item === "ظ…طھط§ط¨ط¹ط©" ? "ط§ظ„ظƒظ„" : item)}>
                {item}
              </button>
            ))}
          </div>
          <DataTable jobs={filtered} deleteJob={deleteJob} notify={notify} />
        </Card>
      </section>
      <aside>
        <Card>
          <div className="section-title"><h3>ظ†ط¸ط±ط© ط¹ط§ظ…ط© ط¹ظ„ظ‰ ط§ظ„طھط­ظˆظٹظ„ط§طھ</h3><select><option>ط¢ط®ط± 7 ط£ظٹط§ظ…</option></select></div>
          <div className="mini-chart">
            {chartData.map((height, index) => (
              <span key={index} style={{ height: `${height}%` }} />
            ))}
          </div>
        </Card>
        <Card>
          <h3>ط§ظ„ظ†ط´ط§ط· ط§ظ„ط£ط®ظٹط±</h3>
          <RecentJobs jobs={jobs.slice(0, 5)} />
        </Card>
        <Card className="tip-card">
          <h3>ظ†طµظٹط­ط© ظ„طھط­ط³ظٹظ† ط§ظ„طھط­ظˆظٹظ„</h3>
          <p>ظ„ظ„ط­طµظˆظ„ ط¹ظ„ظ‰ ط£ظپط¶ظ„ ط§ظ„ظ†طھط§ط¦ط¬طŒ طھط£ظƒط¯ ظ…ظ† ط£ظ† ط§ظ„ظ†طµ ط§ظ„ط£طµظ„ظٹ ظˆط§ط¶ط­ ظˆظ…ظ†ط¸ظ… ظˆطھط¬ظ†ط¨ ط§ظ„ظ…ط­طھظˆظ‰ ط§ظ„ظ…ظ‚طھط¨ط³ ظ…ط¨ط§ط´ط±ط©.</p>
          <button>ط¹ط±ط¶ ط§ظ„ظ…ط²ظٹط¯ ظ…ظ† ط§ظ„ظ†طµط§ط¦ط­</button>
        </Card>
      </aside>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <Card className="stat-card">
      <div><span>{label}</span><strong>{formatNumber(value)}</strong><small>ظ…ط±طھط¨ط· ط¨ط¹ظ…ظ„ظٹط§طھظƒ ط§ظ„ط­ط§ظ„ظٹط©</small></div>
      <Icon>{icon}</Icon>
    </Card>
  );
}

function DataTable({
  jobs,
  deleteJob,
  notify,
}: {
  jobs: Job[];
  deleteJob: (id: string) => void;
  notify: (message: string) => void;
}) {
  if (!jobs.length) return <p className="empty-table">ظ„ط§ طھظˆط¬ط¯ ط¨ظٹط§ظ†ط§طھ ظ…ط­ظپظˆط¸ط© ط¨ط¹ط¯. ظ†ظپظ‘ط° طھط­ظˆظٹظ„ ظ†طµ ط£ظˆ ظ…ظ„ظپ ظ„طھط¸ظ‡ط± ط§ظ„ظ†طھط§ط¦ط¬ ظ‡ظ†ط§.</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>ط§ظ„ط¹ظ†ظˆط§ظ† / ط§ط³ظ… ط§ظ„ظ…ظ„ظپ</th>
            <th>ط§ظ„ظ†ظˆط¹</th>
            <th>ط¹ط¯ط¯ ط§ظ„ظƒظ„ظ…ط§طھ</th>
            <th>ط§ظ„طھط§ط±ظٹط®</th>
            <th>ط§ظ„ظ…ط¯ط©</th>
            <th>ط§ظ„ظ†ظ‚ط§ط· XP</th>
            <th>ط§ظ„ط­ط§ظ„ط©</th>
            <th>ط§ظ„ط¥ط¬ط±ط§ط،ط§طھ</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id}>
              <td><strong>{job.title}</strong><small>{job.type === "file" ? "ظ…ظ„ظپ ظ…ط­ظˆظ‘ظ„" : "طھط­ظˆظٹظ„ ظ†طµ"}</small></td>
              <td><Pill tone="blue">{job.type === "file" ? job.outputFormat || "DOCX" : "T"}</Pill></td>
              <td>{formatNumber(job.words)} ظƒظ„ظ…ط©</td>
              <td>{nowTime()}</td>
              <td>{job.duration}</td>
              <td>+{job.xp} âک†</td>
              <td><Pill tone={job.status === "completed" ? "green" : job.status === "failed" ? "red" : "orange"}>{job.status === "completed" ? "ظ…ظƒطھظ…ظ„" : job.status === "failed" ? "ظپط´ظ„" : "ظ‚ظٹط¯ ط§ظ„ظ…ط¹ط§ظ„ط¬ط©"}</Pill></td>
              <td className="row-actions">
                <button onClick={() => notify(job.output || job.input || "ظ„ط§ طھظˆط¬ط¯ ظ…ط¹ط§ظٹظ†ط©.")}>ًں‘پ</button>
                <button onClick={() => downloadJob(job)}>â‡©</button>
                <button onClick={() => navigator.clipboard.writeText(job.input || job.output || "").then(() => notify("طھظ… ظ†ط³ط® ط§ظ„ط¹ظ…ظ„ظٹط©."))}>â§‰</button>
                <button className="danger" onClick={() => deleteJob(job.id)}>ًں—‘</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function downloadJob(job: Job) {
  const blob = new Blob([job.output || job.input || job.title], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${job.title.slice(0, 20) || "humanize"}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

function FeaturesPage({ navigate }: { navigate: (route: Route, event?: MouseEvent<HTMLButtonElement>) => void }) {
  const features = [
    ["طھط­ظˆظٹظ„ ط§ظ„ظ†طµظˆطµ", "ط­ظˆظ‘ظ„ ط£ظٹ ظ†طµ ط¥ظ„ظ‰ ط£ط³ظ„ظˆط¨ ط¨ط´ط±ظٹ ط·ط¨ظٹط¹ظٹ ط³ظ„ط³ ظˆط§ط­طھط±ط§ظپظٹ ظٹط­ط§ظپط¸ ط¹ظ„ظ‰ ط§ظ„ظ…ط¹ظ†ظ‰.", "T"],
    ["طھط­ظˆظٹظ„ ط§ظ„ظ…ظ„ظپط§طھ", "ط§ط±ظپط¹ ظ…ظ„ظپط§طھ DOCX ط£ظˆ PDF ط£ظˆ TXT ظ„طھط­ظˆظٹظ„ظ‡ط§ ط¯ظپط¹ط© ظˆط§ط­ط¯ط© ط¨ط¯ظ‚ط© ط¹ط§ظ„ظٹط©.", "âکپ"],
    ["ظ…ظ‚ط§ط±ظ†ط© ظ‚ط¨ظ„ / ط¨ط¹ط¯", "ظ‚ط§ط±ظ† ط§ظ„ظ†طµ ط§ظ„ط£طµظ„ظٹ ظˆط§ظ„ظ…ط­ظˆظ‘ظ„ ظ„ط±ط¤ظٹط© ط§ظ„طھط­ط³ظٹظ†ط§طھ ط¨ظˆط¶ظˆط­ ظˆط´ظپط§ظپظٹط©.", "âڑ–"],
    ["ط¯ط±ط¬ط© ط¨ط´ط±ظٹط© ط§ظ„ظ†طµ", "ط§ط­طµظ„ ط¹ظ„ظ‰ ظ†ط³ط¨ط© ط¨ط´ط±ظٹط© ط¯ظ‚ظٹظ‚ط© طھظˆط¶ط­ ظ…ط¯ظ‰ ط·ط¨ظٹط¹ظٹط© ط§ظ„ظ†طµ ط¨ط¹ط¯ ط§ظ„طھط­ظˆظٹظ„.", "â—‹"],
    ["ط£ظ†ظ…ط§ط· ظƒطھط§ط¨ط© ظ…طھط¹ط¯ط¯ط©", "ط§ط®طھط± ط§ظ„ظ†ظ…ط· ط§ظ„ظ…ظ†ط§ط³ط¨ ظ„ط§ط­طھظٹط§ط¬ظƒ: ط±ط³ظ…ظٹطŒ ط£ظƒط§ط¯ظٹظ…ظٹطŒ ط¥ط¨ط¯ط§ط¹ظٹطŒ طھط³ظˆظٹظ‚ظٹ ظˆط؛ظٹط± ط°ظ„ظƒ.", "âœژ"],
    ["ط­ظپط¸ ط§ظ„ط³ط¬ظ„", "ط¬ظ…ظٹط¹ طھط­ظˆظٹظ„ط§طھظƒ ظ…ط­ظپظˆط¸ط© ظپظٹ ط³ط¬ظ„ ظ…ظ†ط¸ظ… ظٹظ…ظƒظ†ظƒ ط§ظ„ط±ط¬ظˆط¹ ط¥ظ„ظٹظ‡ ظپظٹ ط£ظٹ ظˆظ‚طھ.", "â†؛"],
    ["ط®طµظˆطµظٹط© ط¹ط§ظ„ظٹط©", "ظ†ط­ظ…ظٹ ط¨ظٹط§ظ†ط§طھظƒ ظˆظ†طµظˆطµظƒ ط¨طھط´ظپظٹط± ظ…طھظ‚ط¯ظ… ظˆظ„ط§ ظ†ط´ط§ط±ظƒظ‡ط§ ظ…ط¹ ط£ظٹ ط·ط±ظپ.", "â–£"],
    ["ط­ط°ظپ طھظ„ظ‚ط§ط¦ظٹ ظ„ظ„ظ…ظ„ظپط§طھ", "ظٹطھظ… ط­ط°ظپ ظ…ظ„ظپط§طھظƒ طھظ„ظ‚ط§ط¦ظٹط§ظ‹ ظ…ظ† ط§ظ„ط®ظˆط§ط¯ظ… ط¨ط¹ط¯ ط§ظ„ظ…ط¹ط§ظ„ط¬ط© ظ„ظ„ط­ظپط§ط¸ ط¹ظ„ظ‰ ط®طµظˆطµظٹطھظƒ.", "âŒ«"],
    ["ط§ظ‚طھط±ط§ط­ط§طھ ط°ظƒظٹط©", "ط§ط­طµظ„ ط¹ظ„ظ‰ ط§ظ‚طھط±ط§ط­ط§طھ ظ„طھط­ط³ظٹظ† ط§ظ„ط£ط³ظ„ظˆط¨ ظˆط§ظ„ظˆط¶ظˆط­ ظˆط§ظ„طھط±ط§ط¨ط· ظˆط§ظ„ظ…ظپط±ط¯ط§طھ.", "ًں’،"],
    ["ط£ط¯ظˆط§طھ ط§ظ„طھط­ط³ظٹظ† ط§ظ„ط³ط±ظٹط¹ط©", "ط£ط¯ظˆط§طھ ط¹ظ…ظ„ظٹط© ظ„ط¶ط¨ط· ط§ظ„ظ†طµ: طھط¨ط³ظٹط·طŒ طھظˆط³ظٹط¹طŒ ط¥ط¹ط§ط¯ط© طµظٹط§ط؛ط©طŒ ظˆطھط­ط³ظٹظ† ط§ظ„ظ…ظپط±ط¯ط§طھ.", "âœ¦"],
  ];
  return (
    <div className="page features-page">
      <section className="hero-heading">
        <span className="spark">âœ¦</span>
        <h1>ظ…ظ…ظٹط²ط§طھ ظ…طھظƒط§ظ…ظ„ط© ظ„طµظٹط§ط؛ط© ط£ظƒط«ط± ط¥ظ†ط³ط§ظ†ظٹط©</h1>
        <p>ظ…ظ† طھط­ظˆظٹظ„ ط§ظ„ظ†طµظˆطµ ظˆطھط­ط³ظٹظ†ظ‡ط§ ط¥ظ„ظ‰ ط­ظ…ط§ظٹط© ط®طµظˆطµظٹطھظƒ ظˆط±ظپط¹ ط¬ظˆط¯ط© ظƒطھط§ط¨ط§طھظƒطŒ ظƒظ„ ظ…ط§ طھط­طھط§ط¬ظ‡ ظپظٹ ظ…ظ†طµط© ظˆط§ط­ط¯ط© ط°ظƒظٹط© ظˆط³ط±ظٹط¹ط© ظˆط¢ظ…ظ†ط©.</p>
      </section>
      <section className="feature-grid">
        {features.map(([title, text, icon]) => (
          <Card key={title} className="feature-card">
            <Icon>{icon}</Icon>
            <div><h3>{title}</h3><p>{text}</p></div>
          </Card>
        ))}
      </section>
      <Card className="why-card">
        <h2>ظ„ظ…ط§ط°ط§ طھط®طھط§ط± طµظٹط§ط؛ط© ط¨ط´ط±ظٹط©طں</h2>
        <div className="why-grid">
          {["ط¬ظˆط¯ط© ط¨ط´ط±ظٹط© ط­ظ‚ظٹظ‚ظٹط©", "ط³ط±ط¹ط© ظپط§ط¦ظ‚ط©", "ط¢ظ…ظ† ظˆظ…ظˆط«ظˆظ‚", "ط¯ط¹ظ… ظٹط³ط§ط¹ط¯ظƒ", "ظ…طµظ…ظ… ظ„ظ„ظ…ط­طھط±ظپظٹظ†"].map((item) => (
            <div key={item}><Icon>âœ¹</Icon><strong>{item}</strong><small>طھط¬ط±ط¨ط© ط¯ظ‚ظٹظ‚ط© ظˆط³ط±ظٹط¹ط© ظ…ط¹ ظˆط§ط¬ظ‡ط© ط¹ط±ط¨ظٹط© ظˆط§ط¶ط­ط©.</small></div>
          ))}
        </div>
      </Card>
      <section className="steps-cta">
        <Card>
          <h2>ظƒظٹظپ طھط¹ظ…ظ„ ط§ظ„ظ…ظ†طµط©طں</h2>
          <div className="steps-inline">
            {["ط£ط¯ط±ط¬ ظ†طµظƒ ط£ظˆ ط§ط±ظپط¹ ظ…ظ„ظپظƒ", "ظ†ط­ظˆظ‘ظ„ ظˆظ†ط­ط³ظ†", "ط§ط³طھظ„ظ… ط§ظ„ظ†طھظٹط¬ط©"].map((step, index) => (
              <div key={step}><span>{index + 1}</span><strong>{step}</strong></div>
            ))}
          </div>
        </Card>
        <Card className="cta-card">
          <h2>ط¬ط§ظ‡ط² ظ„طھط­ظˆظٹظ„ ظƒطھط§ط¨ط§طھظƒ ط¥ظ„ظ‰ ظ…ط³طھظˆظ‰ ط£ظƒط«ط± ط¥ظ†ط³ط§ظ†ظٹط©طں</h2>
          <p>ط§ط¨ط¯ط£ ط§ظ„ط¢ظ† ظ…ط¬ط§ظ†ط§ظ‹ ظˆط§ظƒطھط´ظپ ظ‚ظˆط© ط§ظ„ط£ط³ظ„ظˆط¨ ط§ظ„ط¨ط´ط±ظٹ ط§ظ„ط§ط­طھط±ط§ظپظٹ.</p>
          <button onClick={(event) => navigate("/", event)}>ط§ط¨ط¯ط£ ط§ظ„ط¢ظ† ظ…ط¬ط§ظ†ط§ظ‹ â†گ</button>
          <small>ظ„ط§ طھط­طھط§ط¬ ط¥ظ„ظ‰ ط¨ط·ط§ظ‚ط© ط§ط¦طھظ…ط§ظ†</small>
        </Card>
      </section>
    </div>
  );
}

function PricingPage({ notify }: { notify: (message: string) => void }) {
  const plans = [
    ["ط³طھط§ط±طھط±", "$7", "1,000 XP / ط´ظ‡ط±", ["1,000 XP ط´ظ‡ط±ظٹط§ظ‹", "ط¬ظˆط¯ط© طµظٹط§ط؛ط© ظ…ظ…طھط§ط²ط©", "طھط­ظˆظٹظ„ ط§ظ„ظ…ظ„ظپط§طھ ط­طھظ‰ 10MB", "ط¯ط¹ظ… ط¹ط¨ط± ط§ظ„ط¨ط±ظٹط¯ ط§ظ„ط¥ظ„ظƒطھط±ظˆظ†ظٹ", "ط¬ظ…ظٹط¹ ظ…ظٹط²ط§طھ ط£ط³ط§ط³ظٹط©"], 1000],
    ["ط¨ط±ظˆ", "$19", "5,000 XP / ط´ظ‡ط±", ["5,000 XP ط´ظ‡ط±ظٹط§ظ‹", "ط¬ظˆط¯ط© طµظٹط§ط؛ط© ط¹ط§ظ„ظٹط©", "طھط­ظˆظٹظ„ ط§ظ„ظ…ظ„ظپط§طھ ط­طھظ‰ 20MB", "ط¯ط¹ظ… ط¹ط¨ط± ط§ظ„ط¨ط±ظٹط¯ ط§ظ„ط¥ظ„ظƒطھط±ظˆظ†ظٹ", "طھط§ط±ظٹط® طھط­ظˆظٹظ„ط§طھ ط؛ظٹط± ظ…ط­ط¯ظˆط¯"], 5000],
    ["ط¨ط²ظ†ط³", "$49", "25,000 XP / ط´ظ‡ط±", ["25,000 XP ط´ظ‡ط±ظٹط§ظ‹", "ط£ظˆظ„ظˆظٹط© ظپظٹ ط§ظ„ظ…ط¹ط§ظ„ط¬ط©", "طھطµط¯ظٹط± ظ…طھط¹ط¯ط¯ ظ„ظ„ظ…ظ„ظپط§طھ", "ط¯ط¹ظ… ظ…ط®طµطµ ظˆظ…ط¯ظٹط± ط­ط³ط§ط¨", "API ظ„ط§ط­ظ‚ط§ظ‹"], 25000],
  ] as const;
  return (
    <div className="page pricing-page">
      <section className="hero-heading">
        <h1>ط£ط³ط¹ط§ط± ط¨ط³ظٹط·ط©. ظ…ط±ظˆظ†ط© ظƒط§ظ…ظ„ط©. ظƒظ„ ط´ظٹط، ظٹط¹طھظ…ط¯ ط¹ظ„ظ‰ <span>XP</span></h1>
        <p>طµظٹط§ط؛ط© ط¨ط´ط±ظٹط© طھط¹ظ…ظ„ ط¨ظ†ط¸ط§ظ… ط§ظ„ط±طµظٹط¯. ط§ط®طھط± ط§ظ„ط®ط·ط© ط§ظ„طھظٹ طھظ†ط§ط³ط¨ظƒ ط£ظˆ ط§ط´طھط±ظگ ط±طµظٹط¯ط§ظ‹ ط¥ط¶ط§ظپظٹط§ظ‹ ط¹ظ†ط¯ ط§ظ„ط­ط§ط¬ط©.</p>
        <div className="badges"><span>ظ„ط§ ط­ط§ط¬ط© ظ„ط¨ط·ط§ظ‚ط© ط§ط¦طھظ…ط§ظ†</span><span>ط¥ظ„ط؛ط§ط، ظپظٹ ط£ظٹ ظˆظ‚طھ</span><span>ط§ط³طھط®ط¯ط§ظ… ظپظˆط±ظٹ ظ„ط±طµظٹط¯ظƒ</span></div>
      </section>
      <div className="pricing-layout">
        <section>
          <div className="plan-grid">
            {plans.map(([name, price, xpLabel, items, xpAmount], index) => (
              <Card key={name} className={cn("plan-card", index === 1 && "popular")}>
                {index === 1 && <span className="popular-badge">ط§ظ„ط£ظƒط«ط± ط´ط¹ط¨ظٹط© âک†</span>}
                <Icon>{index === 0 ? "ًںڑ€" : index === 1 ? "â—‡" : "ًں’¼"}</Icon>
                <h3>{name}</h3>
                <strong className="price">{price}</strong>
                <small>/ ط´ظ‡ط±ظٹط§ظ‹</small>
                <Pill tone="soft">{xpLabel}</Pill>
                <ul>{items.map((item) => <li key={item}>âœ“ {item}</li>)}</ul>
                <button className="gradient-btn full" onClick={() => notify("ط³ظٹطھظ… ط±ط¨ط· ط§ظ„ط¯ظپط¹ ط§ظ„ط­ظ‚ظٹظ‚ظٹ ظ„ط§ط­ظ‚ط§ظ‹طŒ ظ„ط°ظ„ظƒ ظ„ظ… طھطھظ… ط¥ط¶ط§ظپط© XP ظˆظ‡ظ…ظٹ.")}>ط§ط®طھط± ط®ط·ط© {name}</button>
              </Card>
            ))}
          </div>
          <h2 className="center">ط´ط±ط§ط، ط±طµظٹط¯ ط¥ط¶ط§ظپظٹ (XP)</h2>
          <div className="booster-grid">
            {[[1000, "$4"], [5000, "$19"], [10000, "$35"]].map(([amount, price]) => (
              <Card key={amount} className="booster-card">
                <Icon>âœھ</Icon><h3>{formatNumber(Number(amount))} XP</h3><strong>{price}</strong><small>${(Number(price.toString().replace("$", "")) / Number(amount)).toFixed(4)} ظ„ظƒظ„ XP</small>
                <button className="gradient-btn full" onClick={() => notify("ط³ظٹطھظ… ط±ط¨ط· ط§ظ„ط¯ظپط¹ ط§ظ„ط­ظ‚ظٹظ‚ظٹ ظ„ط§ط­ظ‚ط§ظ‹طŒ ظ„ط°ظ„ظƒ ظ„ظ… طھطھظ… ط¥ط¶ط§ظپط© XP ظˆظ‡ظ…ظٹ.")}>ط´ط±ط§ط، ط§ظ„ط¢ظ†</button>
              </Card>
            ))}
          </div>
        </section>
        <aside>
          <Card>
            <h3>ظƒظٹظپ ظٹط¹ظ…ظ„ ظ†ط¸ط§ظ… XPطں</h3>
            <p>ظƒظ„ ط¹ظ…ظ„ظٹط© طھط­ظˆظٹظ„ طھط³طھظ‡ظ„ظƒ ط±طµظٹط¯ط§ظ‹ ظ…ظ† XP ط­ط³ط¨ ط­ط¬ظ… ط§ظ„ظ†طµ ط£ظˆ ظ†ظˆط¹ ط§ظ„ظ…ظ„ظپ.</p>
            <div className="xp-rule"><Icon>T</Icon><div><strong>طھط­ظˆظٹظ„ ط§ظ„ظ†طµ</strong><small>ظƒظ„ 100 ظƒظ„ظ…ط© = 3 XP ظƒط­ط¯ ط£ط¯ظ†ظ‰</small></div></div>
            <div className="xp-rule"><Icon>â–£</Icon><div><strong>طھط­ظˆظٹظ„ ط§ظ„ظ…ظ„ظپط§طھ</strong><small>ظٹظڈط­ط³ط¨ ط­ط³ط¨ ط¹ط¯ط¯ ط§ظ„ظƒظ„ظ…ط§طھ ط§ظ„ظ…ط³طھط®ط±ط¬ط©</small></div></div>
          </Card>
          <Card>
            <h3>ط§ظ„ط£ط³ط¦ظ„ط© ط§ظ„ط´ط§ط¦ط¹ط©</h3>
            {["ظ‡ظ„ ط±طµظٹط¯ XP ظٹظ†طھظ‡ظٹطں", "ظ‡ظ„ ظٹظ…ظƒظ†ظ†ظٹ ط´ط±ط§ط، XP ط¥ط¶ط§ظپظٹطں", "ظ‡ظ„ ط§ظ„ط®ط·ط© ط§ظ„ط´ظ‡ط±ظٹط© طھطھط¬ط¯ط¯ طھظ„ظ‚ط§ط¦ظٹط§ظ‹طں"].map((q) => (
              <details key={q}><summary>{q}</summary><p>ظ†ط¹ظ…طŒ ظٹظ…ظƒظ†ظƒ ط¥ط¯ط§ط±ط© ط§ظ„ط±طµظٹط¯ ظˆط§ظ„ط®ط·ط© ظ…ظ† ط­ط³ط§ط¨ظƒ ظپظٹ ط£ظٹ ظˆظ‚طھ.</p></details>
            ))}
          </Card>
          <Card className="trust-card"><strong>ط¢ظ…ظ† ظˆظ…ظˆط«ظˆظ‚</strong><span>ًں”’ طھط´ظپظٹط± ظ…طھظ‚ط¯ظ…</span><span>ًں›، ط®طµظˆطµظٹطھظƒ ظ…ط¶ظ…ظˆظ†ط©</span><span>ًں’³ ط¯ظپط¹ ط¢ظ…ظ†</span></Card>
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
      const data = await readApi(
        await fetch("/api/auth/login", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
        }),
      );
      applyUser(data.user);
      await refreshAccount();
      notify("تم تسجيل الدخول بنجاح.");
      navigate("/");
    } catch (error) {
      notify(error instanceof Error ? error.message : "تعذر تسجيل الدخول.");
    }
  }

  return (
    <AuthFrame title="تسجيل الدخول" subtitle="مرحباً بك مجدداً! سجّل دخولك للوصول إلى حسابك ورصيد XP الحقيقي.">
      <form className="auth-form" onSubmit={submit}>
        <label>البريد الإلكتروني<input name="email" type="email" required placeholder="name@example.com" /></label>
        <label>كلمة المرور<input name="password" type="password" required placeholder="أدخل كلمة المرور" /></label>
        <div className="auth-meta"><a href="#" onClick={(e) => { e.preventDefault(); notify("سيتم ربط استعادة كلمة المرور لاحقاً."); }}>نسيت كلمة المرور؟</a><label><input type="checkbox" defaultChecked /> تذكرني</label></div>
        <button className="gradient-btn full">تسجيل الدخول ↩</button>
        <div className="divider">أو</div>
        <div className="social-row"><button type="button">Google</button><button type="button">Microsoft</button><button type="button">Apple</button></div>
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
    if (form.get("password") !== form.get("passwordConfirm")) {
      notify("كلمة المرور وتأكيدها غير متطابقين.");
      return;
    }

    try {
      const data = await readApi(
        await fetch("/api/auth/register", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ fullName: form.get("fullName"), email: form.get("email"), password: form.get("password") }),
        }),
      );
      applyUser(data.user);
      await refreshAccount();
      notify("تم إنشاء الحساب ومنحك 50 XP مجانية.");
      navigate("/");
    } catch (error) {
      notify(error instanceof Error ? error.message : "تعذر إنشاء الحساب.");
    }
  }

  return (
    <AuthFrame title="إنشاء حساب" subtitle="أنشئ حسابك لتحصل على الباقة المجانية 50 XP وتبدأ التحويل بعد تسجيل الدخول فقط.">
      <form className="auth-form register" onSubmit={submit}>
        <label>الاسم الكامل *<input name="fullName" required placeholder="أدخل اسمك الكامل" /></label>
        <label>البريد الإلكتروني *<input name="email" type="email" required placeholder="أدخل بريدك الإلكتروني" /></label>
        <label>كلمة المرور *<input name="password" type="password" required placeholder="أنشئ كلمة مرور قوية" /></label>
        <label>تأكيد كلمة المرور *<input name="passwordConfirm" type="password" required placeholder="أعد إدخال كلمة المرور" /></label>
        <label>رمز الدعوة (اختياري)<input name="inviteCode" placeholder="إذا كان لديك رمز دعوة، أدخله هنا" /></label>
        <label className="terms"><input type="checkbox" required /> أوافق على الشروط والأحكام وسياسة الخصوصية</label>
        <button className="gradient-btn full">إنشاء الحساب ♙</button>
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
        <h2>{title === "طھط³ط¬ظٹظ„ ط§ظ„ط¯ط®ظˆظ„" ? "ظ…ظ†طµط© ط°ظƒط§ط، ط§طµط·ظ†ط§ط¹ظٹ طھظƒطھط¨ ظ…ط«ظ„ظƒ" : "ط§ط¨ط¯ط£ ط±ط­ظ„طھظƒ ظ…ط¹ طµظٹط§ط؛ط© ط¨ط´ط±ظٹط©"}</h2>
        <p>
          {title === "طھط³ط¬ظٹظ„ ط§ظ„ط¯ط®ظˆظ„"
            ? "طµظٹط§ط؛ط© ط¨ط´ط±ظٹط© طھط³ط§ط¹ط¯ظƒ ط¹ظ„ظ‰ طھط­ظˆظٹظ„ ط£ظپظƒط§ط±ظƒ ط¥ظ„ظ‰ ظ…ط­طھظˆظ‰ ط§ط­طھط±ط§ظپظٹ ط¨ط¯ظ‚ط© ظˆط°ظƒط§ط، ظٹط­ط§ظƒظٹ ط£ط³ظ„ظˆط¨ظƒ ظˆظٹط¹ط¨ط± ط¹ظ†ظƒ."
            : "ط£ظ†ط´ط¦ ط­ط³ط§ط¨ظƒ ط§ظ„ط¢ظ† ظˆط§ط³طھظ…طھط¹ ط¨ظƒظ„ ط§ظ„ط£ط¯ظˆط§طھ ظ„طھط­ظˆظٹظ„ ظƒطھط§ط¨ط§طھظƒ ط¥ظ„ظ‰ ظ…ط­طھظˆظ‰ ط¨ط´ط±ظٹ ط§ط­طھط±ط§ظپظٹ."}
        </p>
        {["ظ…ط­طھظˆظ‰ ط£طµظ„ظٹ 100%", "ط®طµظˆطµظٹط© ظˆط£ظ…ط§ظ† طھط§ظ…", "طھظˆظپظٹط± ط§ظ„ظˆظ‚طھ ظˆط§ظ„ط¬ظ‡ط¯", "ط¯ط¹ظ… ظ…طھظˆط§طµظ„"].map((item) => (
          <div className="auth-benefit" key={item}><Icon>âœ“</Icon><div><strong>{item}</strong><small>طھط¬ط±ط¨ط© ط¹ط±ط¨ظٹط© ظˆط§ط¶ط­ط© ظˆظ…ظˆط«ظˆظ‚ط©.</small></div></div>
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



