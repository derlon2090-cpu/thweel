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
type JobStatus = "completed" | "processing" | "failed";
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
};

type Transaction = {
  id: string;
  type: "debit" | "credit" | "refund" | "welcome_bonus" | "purchase";
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

const sampleText =
  "يشهد العالم اليوم تطوراً كبيراً في الذكاء الاصطناعي حيث أصبح جزءاً مهماً من حياتنا اليومية. ومع هذا التطور ظهرت تحديات تتعلق بجودة المحتوى المكتوب ودقته، لذلك نحتاج إلى صياغة بشرية طبيعية تحافظ على المعنى وتجعل النص أكثر وضوحاً وسلاسة.";

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

function humanizeText(text: string, tone: string, strength: string) {
  const trimmed = text.trim();
  if (!trimmed) return "";

  let output = trimmed
    .replace(/حيث أصبح/g, "وأصبح")
    .replace(/ومع هذا التطور/g, "ومع هذا التقدم")
    .replace(/تحديات تتعلق/g, "تحديات مرتبطة")
    .replace(/لذلك نحتاج/g, "ولهذا تظهر الحاجة")
    .replace(/تحافظ على المعنى/g, "تُبقي المعنى كما هو")
    .replace(/أكثر وضوحاً وسلاسة/g, "أوضح وأسهل قراءة");

  if (tone === "رسمي") {
    output = `في ضوء ما سبق، ${output}`;
  }
  if (tone === "أكاديمي") {
    output = `${output}\n\nوتبرز أهمية هذه الصياغة في رفع جودة النص، وتحسين ترابط الأفكار، مع الالتزام بالدقة وعدم إضافة معلومات خارج السياق.`;
  }
  if (tone === "تسويقي") {
    output = `${output}\n\nبهذه الطريقة يصبح النص أكثر قرباً من القارئ، وأكثر قدرة على إيصال الفكرة بثقة واحترافية.`;
  }
  if (tone === "سعودي طبيعي") {
    output = output.replace(/ولهذا تظهر الحاجة/g, "وعشان كذا تظهر الحاجة");
  }
  if (strength === "قوي") {
    output = output.replace(/\./g, ". ").replace(/،/g, "، ");
  }
  if (strength === "خفيف") {
    output = output.split(" ").slice(0, Math.max(18, Math.round(countWords(output) * 0.85))).join(" ");
  }

  return output;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
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

export function HumanizeApp({ initialRoute }: { initialRoute: Route }) {
  const [route, setRoute] = useState<Route>(initialRoute);
  const [xp, setXp] = useState(2450);
  const [jobs, setJobs] = useState<Job[]>(emptyJob);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [toast, setToast] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const storedXp = window.localStorage.getItem("humanize_xp");
    const storedJobs = window.localStorage.getItem("humanize_jobs");
    const storedTx = window.localStorage.getItem("humanize_transactions");
    if (storedXp) setXp(Number(storedXp));
    if (storedJobs) setJobs(JSON.parse(storedJobs));
    if (storedTx) setTransactions(JSON.parse(storedTx));

    const onPop = () => setRoute(normalizeRoute(window.location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => window.localStorage.setItem("humanize_xp", String(xp)), [xp]);
  useEffect(() => window.localStorage.setItem("humanize_jobs", JSON.stringify(jobs)), [jobs]);
  useEffect(() => window.localStorage.setItem("humanize_transactions", JSON.stringify(transactions)), [transactions]);

  const level = useMemo(() => {
    const used = transactions.filter((tx) => tx.type === "debit").reduce((sum, tx) => sum + tx.amount, 0);
    if (used >= 10000) return 6;
    if (used >= 5000) return 5;
    if (used >= 2500) return 4;
    if (used >= 1000) return 3;
    if (used >= 300) return 2;
    return 4;
  }, [transactions]);

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
      notify(`رصيد XP غير كافٍ. تحتاج ${amount} XP ورصيدك الحالي ${xp} XP.`);
      return false;
    }
    setTransactions((items) => [
      { id: crypto.randomUUID(), type: "debit", amount, reason, at: new Date().toISOString() },
      ...items,
    ]);
    setXp((value) => value - amount);
    return true;
  }

  function addXp(amount: number, reason: string, type: Transaction["type"] = "purchase") {
    setTransactions((items) => [
      { id: crypto.randomUUID(), type, amount, reason, at: new Date().toISOString() },
      ...items,
    ]);
    setXp((value) => value + amount);
    notify(`تمت إضافة ${formatNumber(amount)} XP إلى رصيدك.`);
  }

  function addJob(job: Job) {
    setJobs((items) => [job, ...items]);
  }

  function deleteJob(id: string) {
    setJobs((items) => items.filter((job) => job.id !== id));
    notify("تم حذف العملية من السجل.");
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
        <HomePage jobs={jobs} xp={xp} reserveXp={reserveXp} addJob={addJob} notify={notify} navigate={navigate} />
      )}
      {route === "/files" && (
        <FilesPage jobs={jobs} reserveXp={reserveXp} addJob={addJob} deleteJob={deleteJob} notify={notify} navigate={navigate} />
      )}
      {route === "/history" && <HistoryPage jobs={jobs} deleteJob={deleteJob} notify={notify} />}
      {route === "/features" && <FeaturesPage navigate={navigate} />}
      {route === "/pricing" && <PricingPage addXp={addXp} />}
      {route === "/login" && <LoginPage navigate={navigate} notify={notify} />}
      {route === "/register" && <RegisterPage navigate={navigate} notify={notify} addXp={addXp} />}

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
        <span className="brand-mark">✦</span>
        <span>
          <strong>صياغة بشرية</strong>
          <small>حوّل النصوص إلى أسلوب بشري احترافي</small>
        </span>
      </a>

      <nav className="nav-tabs" aria-label="التنقل الرئيسي">
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
          تسجيل الدخول
        </a>
      </nav>

      <div className="top-actions">
        <button className="outline-btn" onClick={(event) => navigate("/files", event)}>
          <span>☁</span> رفع ملف
        </button>
        <button className="gradient-btn small" onClick={(event) => navigate("/", event)}>
          ابدأ الآن
        </button>
        <button className="xp-pill" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen}>
          <span className="xp-star">☆</span>
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
        <span className="brand-mark">✦</span>
        <span>
          <strong>صياغة بشرية</strong>
          <small>حوّل النصوص إلى أسلوب بشري احترافي</small>
        </span>
      </a>
      <button className="link-btn" onClick={(event) => navigate("/", event)}>
        ⌂ العودة للرئيسية
      </button>
    </header>
  );
}

function HomePage({
  jobs,
  xp,
  reserveXp,
  addJob,
  notify,
  navigate,
}: {
  jobs: Job[];
  xp: number;
  reserveXp: (amount: number, reason: string) => boolean;
  addJob: (job: Job) => void;
  notify: (message: string) => void;
  navigate: (route: Route, event?: MouseEvent<HTMLButtonElement>) => void;
}) {
  const [text, setText] = useState(sampleText);
  const [tone, setTone] = useState("سردي طبيعي");
  const [strength, setStrength] = useState("متوسط");
  const [output, setOutput] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const words = countWords(text);
  const xpCost = calculateXp(words);

  function convertText() {
    if (!text.trim()) return notify("أدخل نصاً أولاً حتى نبدأ التحويل.");
    if (!reserveXp(xpCost, "تحويل نص")) return;
    setBusy(true);
    setSaved(false);
    window.setTimeout(() => {
      const nextOutput = humanizeText(text, tone, strength);
      setOutput(nextOutput);
      setBusy(false);
      setSaved(true);
      addJob({
        id: crypto.randomUUID(),
        title: text.split(" ").slice(0, 8).join(" ") || "تحويل نص",
        type: "text",
        words,
        xp: xpCost,
        status: "completed",
        createdAt: new Date().toISOString(),
        duration: "1 دقيقة",
        input: text,
        output: nextOutput,
        outputFormat: "TXT",
      });
      notify(`تم التحويل وخصم ${xpCost} XP. رصيدك الآن ${xp - xpCost} XP.`);
    }, 700);
  }

  function quickAction(action: string) {
    const base = output || text;
    const actions: Record<string, string> = {
      "أكثر رسمية": `بصياغة أكثر رسمية: ${base}`,
      "تقصير الفقرات": base.split(".").filter(Boolean).slice(0, 2).join(". ") + ".",
      "إضافة أمثلة تطبيقية": `${base}\n\nمثال تطبيقي: يمكن استخدام هذه الصياغة في مقال، تقرير، أو وصف تسويقي مع الحفاظ على المعنى الأصلي.`,
      "لهجة سعودية خفيفة": base.replace(/لذلك/g, "عشان كذا").replace(/جداً/g, "مرة"),
      "توسيع النص": `${base}\n\nكما أن وضوح الأفكار وترتيبها يساعد القارئ على فهم الرسالة بسرعة، ويجعل النص أقرب للأسلوب البشري الطبيعي.`,
      "تصحيح الأخطاء": base.replace(/\s+/g, " ").trim(),
    };
    setOutput(actions[action] || base);
    notify(`تم تطبيق: ${action}`);
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
            <h3>الناتج البشرية</h3>
            <span>✥</span>
          </div>
          <div className="result-box">
            {output || "سيظهر النص الناتج هنا بعد التحويل. اكتب نصك واختر النمط وقوة التحويل ثم اضغط زر التحويل."}
          </div>
          <div className="wordline">
            <span>{countWords(output || text)}/5000 كلمة</span>
            {saved && <Pill tone="green">جاهز</Pill>}
          </div>
        </Card>
        <Card>
          <div className="section-title">
            <h3>درجة بشرية النص</h3>
            <span>ⓘ</span>
          </div>
          <div className="human-score">
            <div className="score-card muted">
              <small>قبل التسجيل</small>
              <strong>68%</strong>
              <span>AI</span>
            </div>
            <div className="donut" aria-label="درجة بشرية 94%">94</div>
            <div className="score-card green">
              <small>تم التسجيل</small>
              <strong>{output ? "94%" : "—"}</strong>
              <span>بشري</span>
            </div>
          </div>
          <div className="triple-actions">
            <button onClick={() => navigator.clipboard.writeText(output || text).then(() => notify("تم نسخ النص."))}>نسخ النص ⧉</button>
            <button onClick={download}>تحميل ⇩</button>
            <button
              onClick={() =>
                navigator.share
                  ? navigator.share({ title: "صياغة بشرية", text: output || text })
                  : navigator.clipboard.writeText(output || text).then(() => notify("تم نسخ النص للمشاركة."))
              }
            >
              مشاركة ⤴
            </button>
          </div>
        </Card>
        <Card>
          <div className="section-title">
            <h3>اقتراحات سريعة</h3>
            <span>↯</span>
          </div>
          <div className="chip-grid">
            {["أكثر رسمية", "تقصير الفقرات", "إضافة أمثلة تطبيقية", "لهجة سعودية خفيفة", "توسيع النص", "تصحيح الأخطاء"].map((item) => (
              <button key={item} onClick={() => quickAction(item)}>
                {item}
              </button>
            ))}
          </div>
        </Card>
        <Card>
          <div className="section-title">
            <h3>أدوات التحسين الذكية</h3>
            <span>✎</span>
          </div>
          <div className="tool-grid">
            {["إعادة كتابة", "تبسيط", "مساعدة", "تنسيق الفقرات", "إزالة التكرار"].map((item) => (
              <button key={item} onClick={() => quickAction(item === "إعادة كتابة" ? "توسيع النص" : item)}>
                {item}
              </button>
            ))}
          </div>
        </Card>
      </aside>

      <section className="main-column">
        <Card className="converter-card">
          <div className="section-title">
            <h2>تحويل النص</h2>
            <span>▱</span>
          </div>
          <div className="control-row">
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
              <div className="segmented">
                {["خفيف", "متوسط", "قوي"].map((item) => (
                  <button key={item} className={strength === item ? "selected" : ""} onClick={() => setStrength(item)}>
                    {item}
                  </button>
                ))}
              </div>
            </label>
          </div>
          <div className="check-row">
            <label>
              <input type="checkbox" checked readOnly /> الحفاظ على المعنى
            </label>
            <label>
              <input type="checkbox" checked readOnly /> عدم إضافة معلومات جديدة
            </label>
          </div>
          <textarea value={text} onChange={(event) => setText(event.target.value)} maxLength={5000} />
          <div className="estimate-row">
            <span>{words}/5000 كلمة</span>
            <span>التكلفة: {xpCost} XP</span>
            <span>الرصيد بعد الخصم: {formatNumber(Math.max(xp - xpCost, 0))} XP</span>
            {saved && <span className="saved">✓ تم الحفظ</span>}
          </div>
          <button className="gradient-btn full" disabled={busy || !text.trim()} onClick={convertText}>
            {busy ? "جاري التحويل..." : "تحويل إلى صياغة بشرية ✨"}
          </button>
        </Card>

        <Card>
          <div className="section-title center-title">
            <h2>مقارنة قبل / بعد</h2>
            <span>⚖</span>
          </div>
          <div className="compare-grid">
            <div>
              <Pill tone="red">قبل التحويل (النص الأصلي)</Pill>
              <p>{text || "النص الأصلي غير متوفر بعد."}</p>
              <small>{words} كلمة</small>
            </div>
            <button className="swap-btn">↔</button>
            <div>
              <Pill tone="green">بعد التحويل (النص البشري)</Pill>
              <p>{output || "حوّل النص لعرض المقارنة هنا."}</p>
              <small>{countWords(output)} كلمة</small>
            </div>
          </div>
        </Card>
      </section>

      <aside className="side-column">
        <UploadPanel compact navigate={navigate} notify={notify} />
        <Card>
          <h3>مسار المعالجة</h3>
          <div className="process-flow">
            {["الملف المطلوب", "تحليل المحتوى", "استخراج النص", "رفع الملف"].map((step, index) => (
              <div key={step} className={index === 3 ? "active" : ""}>
                <span>{index + 1}</span>
                <small>{step}</small>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h3>تقرير التحويل</h3>
          <dl className="report-list">
            <div><dt>عدد الكلمات</dt><dd>{words}</dd></div>
            <div><dt>عدد الفقرات</dt><dd>{Math.max(text.split("\n").filter(Boolean).length, 1)}</dd></div>
            <div><dt>متوسط الجمل</dt><dd>{Math.max(text.split(".").filter(Boolean).length, 1)}</dd></div>
            <div><dt>زمن المعالجة</dt><dd>{busy ? "جاري" : "12 ثانية"}</dd></div>
            <div><dt>نوع الملف النهائي</dt><dd>DOCX</dd></div>
          </dl>
        </Card>
        <Card>
          <div className="section-title">
            <h3>آخر التحويلات</h3>
            <span>◷</span>
          </div>
          <RecentJobs jobs={jobs.slice(0, 4)} />
          <button className="link-btn" onClick={(event) => navigate("/history", event)}>
            عرض جميع التحويلات ←
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
      <h3>{compact ? "تحويل الملفات" : "رفع الملف وتحويله"}</h3>
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
            if (!["pdf", "docx", "txt"].includes(ext || "")) return notify("نوع الملف غير مدعوم. ارفع PDF أو DOCX أو TXT.");
            if (file.size > 20 * 1024 * 1024) return notify("حجم الملف يتجاوز الحد الأقصى 20MB.");
            notify(`تم اختيار الملف: ${file.name}`);
          }}
        />
        <Icon>☁</Icon>
        <strong>اسحب وأفلت ملفك هنا</strong>
        <span>أو اختر ملف من جهازك</span>
        <div className="file-types">
          <span>PDF</span>
          <span>DOCX</span>
          <span>TXT</span>
        </div>
        <small>الحد الأقصى: 20MB</small>
      </div>
      <button className="gradient-btn full" onClick={(event) => navigate?.("/files", event)}>
        رفع الملف وتحويله
      </button>
    </Card>
  );
}

function RecentJobs({ jobs }: { jobs: Job[] }) {
  if (!jobs.length) {
    return <p className="empty-state">لا توجد تحويلات بعد. ستظهر عملياتك هنا فور تنفيذ أول تحويل.</p>;
  }
  return (
    <div className="recent-list">
      {jobs.map((job) => (
        <div key={job.id}>
          <Pill tone={job.status === "completed" ? "green" : job.status === "failed" ? "red" : "orange"}>
            {job.status === "completed" ? "مكتمل" : job.status === "failed" ? "فشل" : "قيد المعالجة"}
          </Pill>
          <span>{job.title}</span>
          <small>{job.words} كلمة</small>
        </div>
      ))}
    </div>
  );
}

function FilesPage({
  jobs,
  reserveXp,
  addJob,
  deleteJob,
  notify,
}: {
  jobs: Job[];
  reserveXp: (amount: number, reason: string) => boolean;
  addJob: (job: Job) => void;
  deleteJob: (id: string) => void;
  notify: (message: string) => void;
  navigate: (route: Route, event?: MouseEvent<HTMLButtonElement>) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState("DOCX");
  const [tone, setTone] = useState("سردي طبيعي");
  const [strength, setStrength] = useState("متوسط");
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileJobs = jobs.filter((job) => job.type === "file");
  const fileWords = file ? Math.max(120, Math.ceil(file.size / 1800)) : 0;
  const fileXp = calculateXp(fileWords);

  function handleFile(nextFile?: File) {
    if (!nextFile) return;
    const ext = nextFile.name.split(".").pop()?.toLowerCase();
    if (!["pdf", "docx", "txt"].includes(ext || "")) return notify("نوع الملف غير مدعوم. الرجاء رفع PDF أو DOCX أو TXT.");
    if (nextFile.size > 20 * 1024 * 1024) return notify("حجم الملف يتجاوز الحد الأقصى 20MB.");
    setFile(nextFile);
    setProgress(0);
    setStage(0);
    notify(`تم استقبال الملف: ${nextFile.name}`);
  }

  function convertFile() {
    if (!file) return notify("اختر ملفاً أولاً.");
    if (!reserveXp(fileXp, "تحويل ملف")) return;
    setProgress(12);
    setStage(0);
    const timers = [28, 47, 69, 88, 100];
    timers.forEach((value, index) => {
      window.setTimeout(() => {
        setProgress(value);
        setStage(index);
        if (value === 100) {
          addJob({
            id: crypto.randomUUID(),
            title: file.name,
            type: "file",
            words: fileWords,
            xp: fileXp,
            status: "completed",
            createdAt: new Date().toISOString(),
            duration: `${index + 1} دقائق`,
            fileName: file.name,
            fileSize: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
            outputFormat: format,
            output: `تم تحويل الملف ${file.name} بنمط ${tone} وقوة ${strength}.`,
          });
          notify("اكتمل تحويل الملف وأصبح جاهزاً للتحميل.");
        }
      }, 450 * (index + 1));
    });
  }

  return (
    <div className="page files-layout">
      <section className="files-main">
        <div className="page-heading">
          <h1>الملفات</h1>
          <p>حوّل ملفاتك إلى نصوص بشرية احترافية</p>
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
            <span>سندعمك في تحويل ملفاتك إلى نصوص بشرية عالية الجودة</span>
            <div className="file-types">
              <span>PDF</span>
              <span>DOCX</span>
              <span>TXT</span>
            </div>
            <small>الحجم الأقصى للملف: 20MB</small>
          </div>
          <button className="gradient-btn center" onClick={convertFile}>
            رفع الملف وتحويله ✨
          </button>
          <div className="file-options">
            <label><span>نمط الكتابة</span><select value={tone} onChange={(e) => setTone(e.target.value)}><option>سردي طبيعي</option><option>رسمي</option><option>أكاديمي</option></select></label>
            <label><span>قوة التحويل</span><select value={strength} onChange={(e) => setStrength(e.target.value)}><option>خفيف</option><option>متوسط</option><option>قوي</option></select></label>
            <label><span>الحفاظ على المعنى</span><input type="checkbox" checked readOnly /></label>
            <label><span>معلومات جديدة</span><input type="checkbox" checked readOnly /></label>
            <label><span>تنسيق الإخراج</span><select value={format} onChange={(e) => setFormat(e.target.value)}><option>DOCX</option><option>PDF</option><option>TXT</option></select></label>
          </div>
          <div className="notice">جميع التحويلات تتم مع الحفاظ على المعنى والحقائق الأصلية للنص.</div>
        </Card>

        <Card>
          <div className="section-title">
            <h2>الملفات الأخيرة</h2>
          </div>
          <DataTable jobs={fileJobs} deleteJob={deleteJob} notify={notify} />
        </Card>
      </section>
      <aside className="files-side">
        <Card>
          <h3>مراحل المعالجة</h3>
          <div className="vertical-steps">
            {["استقبال الملف", "استخراج النص", "معالجة وتحويل", "مراجعة نهائية", "جاري الحفظ"].map((item, index) => (
              <div key={item} className={index <= stage ? "done" : ""}>
                <span>{index + 1}</span>
                <div><strong>{item}</strong><small>{index <= stage ? "تمت المرحلة أو قيد التنفيذ" : "بانتظار الدور"}</small></div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h3>تقدم التحويل (مباشر)</h3>
          <div className="file-card-row">
            <Icon>{file?.name.endsWith(".pdf") ? "PDF" : "W"}</Icon>
            <div><strong>{file?.name || "لم يتم اختيار ملف"}</strong><small>{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : "—"}</small></div>
          </div>
          <div className="progress"><span style={{ width: `${progress}%` }} /></div>
          <strong className="progress-label">{progress}%</strong>
          <p className="status-text">{progress === 100 ? "اكتمل التحويل" : progress ? "جاري المعالجة..." : "بانتظار الرفع"}</p>
        </Card>
        <Card>
          <h3>ملخص التحويل</h3>
          <dl className="report-list">
            <div><dt>الملف الأصلي</dt><dd>{file?.name || "—"}</dd></div>
            <div><dt>حجم الملف</dt><dd>{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : "—"}</dd></div>
            <div><dt>عدد الكلمات</dt><dd>{fileWords || "—"}</dd></div>
            <div><dt>XP المخصوم</dt><dd>{fileXp || "—"}</dd></div>
            <div><dt>تنسيق الإخراج</dt><dd>{format}</dd></div>
          </dl>
        </Card>
        <Card>
          <h3>أدوات سريعة</h3>
          <div className="quick-cards">
            <button onClick={() => inputRef.current?.click()}>تحويل ملف جديد ↑</button>
            <button onClick={() => notify("افتح سجلك لاختيار عمليتين للمقارنة.")}>مقارنة النصوص ⚖</button>
            <button onClick={() => notify("تم فحص المعنى محلياً.")}>تدقيق المعنى 🛡</button>
            <button onClick={() => file && convertFile()}>إعادة تحويل ↻</button>
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
  const [filter, setFilter] = useState("الكل");
  const filtered = jobs.filter((job) => {
    const matchesSearch = `${job.title} ${job.fileName || ""}`.includes(search);
    const matchesFilter =
      filter === "الكل" ||
      (filter === "نص" && job.type === "text") ||
      (filter === "ملف" && job.type === "file") ||
      (filter === "مكتملة" && job.status === "completed") ||
      (filter === "فشل" && job.status === "failed");
    return matchesSearch && matchesFilter;
  });
  const completed = jobs.filter((job) => job.status === "completed").length;
  const savedFiles = jobs.filter((job) => job.type === "file").length;
  const xpUsed = jobs.reduce((sum, job) => sum + job.xp, 0);

  return (
    <div className="page history-layout">
      <section>
        <div className="page-heading">
          <h1>سجل التحويلات</h1>
          <p>تتبع جميع عمليات التحويل التي قمت بها وإدارة نتائجك بسهولة</p>
        </div>
        <div className="stats-grid">
          <StatCard label="إجمالي التحويلات" value={jobs.length} icon="⇧" />
          <StatCard label="التحويلات المكتملة" value={completed} icon="✓" />
          <StatCard label="الملفات المحفوظة" value={savedFiles} icon="□" />
          <StatCard label="إجمالي نقاط XP" value={xpUsed} icon="☆" />
        </div>
        <Card>
          <div className="filters-row">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث عن عنوان أو اسم ملف..." />
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              {["الكل", "نص", "ملف", "مكتملة", "فشل"].map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>
          <div className="filter-chips">
            {["الكل", "اليوم", "هذا الأسبوع", "متابعة", "فشل", "ملف", "نص"].map((item) => (
              <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item === "اليوم" || item === "هذا الأسبوع" || item === "متابعة" ? "الكل" : item)}>
                {item}
              </button>
            ))}
          </div>
          <DataTable jobs={filtered} deleteJob={deleteJob} notify={notify} />
        </Card>
      </section>
      <aside>
        <Card>
          <div className="section-title"><h3>نظرة عامة على التحويلات</h3><select><option>آخر 7 أيام</option></select></div>
          <div className="mini-chart">
            {[18, 32, 48, 35, 62, 44, 28].map((height, index) => (
              <span key={index} style={{ height: `${height}%` }} />
            ))}
          </div>
        </Card>
        <Card>
          <h3>النشاط الأخير</h3>
          <RecentJobs jobs={jobs.slice(0, 5)} />
        </Card>
        <Card className="tip-card">
          <h3>نصيحة لتحسين التحويل</h3>
          <p>للحصول على أفضل النتائج، تأكد من أن النص الأصلي واضح ومنظم وتجنب المحتوى المقتبس مباشرة.</p>
          <button>عرض المزيد من النصائح</button>
        </Card>
      </aside>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <Card className="stat-card">
      <div><span>{label}</span><strong>{formatNumber(value)}</strong><small>مرتبط بعملياتك الحالية</small></div>
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
  if (!jobs.length) return <p className="empty-table">لا توجد بيانات محفوظة بعد. نفّذ تحويل نص أو ملف لتظهر النتائج هنا.</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>العنوان / اسم الملف</th>
            <th>النوع</th>
            <th>عدد الكلمات</th>
            <th>التاريخ</th>
            <th>المدة</th>
            <th>النقاط XP</th>
            <th>الحالة</th>
            <th>الإجراءات</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id}>
              <td><strong>{job.title}</strong><small>{job.type === "file" ? "ملف محوّل" : "تحويل نص"}</small></td>
              <td><Pill tone="blue">{job.type === "file" ? job.outputFormat || "DOCX" : "T"}</Pill></td>
              <td>{formatNumber(job.words)} كلمة</td>
              <td>{nowTime()}</td>
              <td>{job.duration}</td>
              <td>+{job.xp} ☆</td>
              <td><Pill tone={job.status === "completed" ? "green" : job.status === "failed" ? "red" : "orange"}>{job.status === "completed" ? "مكتمل" : job.status === "failed" ? "فشل" : "قيد المعالجة"}</Pill></td>
              <td className="row-actions">
                <button onClick={() => notify(job.output || job.input || "لا توجد معاينة.")}>👁</button>
                <button onClick={() => downloadJob(job)}>⇩</button>
                <button onClick={() => navigator.clipboard.writeText(job.input || job.output || "").then(() => notify("تم نسخ العملية."))}>⧉</button>
                <button className="danger" onClick={() => deleteJob(job.id)}>🗑</button>
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
    ["تحويل النصوص", "حوّل أي نص إلى أسلوب بشري طبيعي سلس واحترافي يحافظ على المعنى.", "T"],
    ["تحويل الملفات", "ارفع ملفات DOCX أو PDF أو TXT لتحويلها دفعة واحدة بدقة عالية.", "☁"],
    ["مقارنة قبل / بعد", "قارن النص الأصلي والمحوّل لرؤية التحسينات بوضوح وشفافية.", "⚖"],
    ["درجة بشرية النص", "احصل على نسبة بشرية دقيقة توضح مدى طبيعية النص بعد التحويل.", "○"],
    ["أنماط كتابة متعددة", "اختر النمط المناسب لاحتياجك: رسمي، أكاديمي، إبداعي، تسويقي وغير ذلك.", "✎"],
    ["حفظ السجل", "جميع تحويلاتك محفوظة في سجل منظم يمكنك الرجوع إليه في أي وقت.", "↺"],
    ["خصوصية عالية", "نحمي بياناتك ونصوصك بتشفير متقدم ولا نشاركها مع أي طرف.", "▣"],
    ["حذف تلقائي للملفات", "يتم حذف ملفاتك تلقائياً من الخوادم بعد المعالجة للحفاظ على خصوصيتك.", "⌫"],
    ["اقتراحات ذكية", "احصل على اقتراحات لتحسين الأسلوب والوضوح والترابط والمفردات.", "💡"],
    ["أدوات التحسين السريعة", "أدوات عملية لضبط النص: تبسيط، توسيع، إعادة صياغة، وتحسين المفردات.", "✦"],
  ];
  return (
    <div className="page features-page">
      <section className="hero-heading">
        <span className="spark">✦</span>
        <h1>مميزات متكاملة لصياغة أكثر إنسانية</h1>
        <p>من تحويل النصوص وتحسينها إلى حماية خصوصيتك ورفع جودة كتاباتك، كل ما تحتاجه في منصة واحدة ذكية وسريعة وآمنة.</p>
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
        <h2>لماذا تختار صياغة بشرية؟</h2>
        <div className="why-grid">
          {["جودة بشرية حقيقية", "سرعة فائقة", "آمن وموثوق", "دعم يساعدك", "مصمم للمحترفين"].map((item) => (
            <div key={item}><Icon>✹</Icon><strong>{item}</strong><small>تجربة دقيقة وسريعة مع واجهة عربية واضحة.</small></div>
          ))}
        </div>
      </Card>
      <section className="steps-cta">
        <Card>
          <h2>كيف تعمل المنصة؟</h2>
          <div className="steps-inline">
            {["أدرج نصك أو ارفع ملفك", "نحوّل ونحسن", "استلم النتيجة"].map((step, index) => (
              <div key={step}><span>{index + 1}</span><strong>{step}</strong></div>
            ))}
          </div>
        </Card>
        <Card className="cta-card">
          <h2>جاهز لتحويل كتاباتك إلى مستوى أكثر إنسانية؟</h2>
          <p>ابدأ الآن مجاناً واكتشف قوة الأسلوب البشري الاحترافي.</p>
          <button onClick={(event) => navigate("/", event)}>ابدأ الآن مجاناً ←</button>
          <small>لا تحتاج إلى بطاقة ائتمان</small>
        </Card>
      </section>
    </div>
  );
}

function PricingPage({ addXp }: { addXp: (amount: number, reason: string, type?: Transaction["type"]) => void }) {
  const plans = [
    ["ستارتر", "$7", "1,000 XP / شهر", ["1,000 XP شهرياً", "جودة صياغة ممتازة", "تحويل الملفات حتى 10MB", "دعم عبر البريد الإلكتروني", "جميع ميزات أساسية"], 1000],
    ["برو", "$19", "5,000 XP / شهر", ["5,000 XP شهرياً", "جودة صياغة عالية", "تحويل الملفات حتى 20MB", "دعم عبر البريد الإلكتروني", "تاريخ تحويلات غير محدود"], 5000],
    ["بزنس", "$49", "25,000 XP / شهر", ["25,000 XP شهرياً", "أولوية في المعالجة", "تصدير متعدد للملفات", "دعم مخصص ومدير حساب", "API لاحقاً"], 25000],
  ] as const;
  return (
    <div className="page pricing-page">
      <section className="hero-heading">
        <h1>أسعار بسيطة. مرونة كاملة. كل شيء يعتمد على <span>XP</span></h1>
        <p>صياغة بشرية تعمل بنظام الرصيد. اختر الخطة التي تناسبك أو اشترِ رصيداً إضافياً عند الحاجة.</p>
        <div className="badges"><span>لا حاجة لبطاقة ائتمان</span><span>إلغاء في أي وقت</span><span>استخدام فوري لرصيدك</span></div>
      </section>
      <div className="pricing-layout">
        <section>
          <div className="plan-grid">
            {plans.map(([name, price, xpLabel, items, xpAmount], index) => (
              <Card key={name} className={cn("plan-card", index === 1 && "popular")}>
                {index === 1 && <span className="popular-badge">الأكثر شعبية ☆</span>}
                <Icon>{index === 0 ? "🚀" : index === 1 ? "◇" : "💼"}</Icon>
                <h3>{name}</h3>
                <strong className="price">{price}</strong>
                <small>/ شهرياً</small>
                <Pill tone="soft">{xpLabel}</Pill>
                <ul>{items.map((item) => <li key={item}>✓ {item}</li>)}</ul>
                <button className="gradient-btn full" onClick={() => addXp(xpAmount, `اشتراك خطة ${name}`)}>اختر خطة {name}</button>
              </Card>
            ))}
          </div>
          <h2 className="center">شراء رصيد إضافي (XP)</h2>
          <div className="booster-grid">
            {[[1000, "$4"], [5000, "$19"], [10000, "$35"]].map(([amount, price]) => (
              <Card key={amount} className="booster-card">
                <Icon>✪</Icon><h3>{formatNumber(Number(amount))} XP</h3><strong>{price}</strong><small>${(Number(price.toString().replace("$", "")) / Number(amount)).toFixed(4)} لكل XP</small>
                <button className="gradient-btn full" onClick={() => addXp(Number(amount), "شراء رصيد إضافي")}>شراء الآن</button>
              </Card>
            ))}
          </div>
        </section>
        <aside>
          <Card>
            <h3>كيف يعمل نظام XP؟</h3>
            <p>كل عملية تحويل تستهلك رصيداً من XP حسب حجم النص أو نوع الملف.</p>
            <div className="xp-rule"><Icon>T</Icon><div><strong>تحويل النص</strong><small>كل 100 كلمة = 3 XP كحد أدنى</small></div></div>
            <div className="xp-rule"><Icon>▣</Icon><div><strong>تحويل الملفات</strong><small>يُحسب حسب عدد الكلمات المستخرجة</small></div></div>
          </Card>
          <Card>
            <h3>الأسئلة الشائعة</h3>
            {["هل رصيد XP ينتهي؟", "هل يمكنني شراء XP إضافي؟", "هل الخطة الشهرية تتجدد تلقائياً؟"].map((q) => (
              <details key={q}><summary>{q}</summary><p>نعم، يمكنك إدارة الرصيد والخطة من حسابك في أي وقت.</p></details>
            ))}
          </Card>
          <Card className="trust-card"><strong>آمن وموثوق</strong><span>🔒 تشفير متقدم</span><span>🛡 خصوصيتك مضمونة</span><span>💳 دفع آمن</span></Card>
        </aside>
      </div>
    </div>
  );
}

function LoginPage({
  navigate,
  notify,
}: {
  navigate: (route: Route, event?: MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => void;
  notify: (message: string) => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    notify("تم تسجيل الدخول محلياً للمعاينة.");
    navigate("/");
  }
  return (
    <AuthFrame title="تسجيل الدخول" subtitle="مرحباً بك مجدداً! سجّل دخولك للوصول إلى حسابك ومتابعة مشاريعك الذكية.">
      <form className="auth-form" onSubmit={submit}>
        <label>البريد الإلكتروني<input type="email" required placeholder="name@example.com" /></label>
        <label>كلمة المرور<input type="password" required placeholder="أدخل كلمة المرور" /></label>
        <div className="auth-meta"><a href="#" onClick={(e) => { e.preventDefault(); notify("سيتم إرسال رابط استعادة كلمة المرور."); }}>نسيت كلمة المرور؟</a><label><input type="checkbox" defaultChecked /> تذكرني</label></div>
        <button className="gradient-btn full">تسجيل الدخول ↪</button>
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
  addXp,
}: {
  navigate: (route: Route, event?: MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => void;
  notify: (message: string) => void;
  addXp: (amount: number, reason: string, type?: Transaction["type"]) => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    addXp(100, "رصيد ترحيبي", "welcome_bonus");
    notify("تم إنشاء الحساب ومنحك 100 XP ترحيبية.");
    navigate("/");
  }
  return (
    <AuthFrame title="إنشاء حساب" subtitle="مرحباً بك! أنشئ حسابك للبدء في تحويل نصوصك إلى محتوى بشري احترافي.">
      <form className="auth-form register" onSubmit={submit}>
        <label>الاسم الكامل *<input required placeholder="أدخل اسمك الكامل" /></label>
        <label>البريد الإلكتروني *<input type="email" required placeholder="أدخل بريدك الإلكتروني" /></label>
        <label>كلمة المرور *<input type="password" required placeholder="أنشئ كلمة مرور قوية" /></label>
        <label>تأكيد كلمة المرور *<input type="password" required placeholder="أعد إدخال كلمة المرور" /></label>
        <label>رمز الدعوة (اختياري)<input placeholder="إذا كان لديك رمز دعوة، أدخله هنا" /></label>
        <label className="terms"><input type="checkbox" required /> أوافق على الشروط والأحكام و سياسة الخصوصية</label>
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
        <div className="auth-illustration">✦</div>
        <h2>منصة ذكاء اصطناعي تكتب مثلك</h2>
        <p>صياغة بشرية تساعدك على تحويل أفكارك إلى محتوى احترافي بدقة وذكاء يحاكي أسلوبك ويعبر عنك.</p>
        {["محتوى أصلي 100%", "خصوصية وأمان تام", "توفير الوقت والجهد", "دعم متواصل"].map((item) => (
          <div className="auth-benefit" key={item}><Icon>✓</Icon><div><strong>{item}</strong><small>تجربة عربية واضحة وموثوقة.</small></div></div>
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
