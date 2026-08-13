import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileQuestion,
  Info,
  Lock,
  MapPin,
  MinusCircle,
  MonitorSmartphone,
  ShieldCheck,
  Target,
  UserRound,
} from "lucide-react";
import { getQuestionCount, isExamOpen } from "@/lib/queries";
import { isAdminAuthenticated } from "@/lib/admin";
import { EXAM_DURATION_MINUTES, EXAM_QUESTION_COUNT } from "@/lib/examConfig";
import { getPresentations } from "@/lib/presentations";
import PptLibrary from "@/components/PptLibrary";

/**
 * Home page — official landing for the Viksit Bharat - G RAM G
 * training examination portal.
 */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [questionCount, examOpen, isAdmin] = await Promise.all([
    getQuestionCount(),
    isExamOpen(),
    isAdminAuthenticated(),
  ]);

  // Training PPTs dropped into public/ppt/ — shown at the bottom of the page.
  const presentations = getPresentations();

  const examFacts = [
    { icon: <FileQuestion className="h-5 w-5" />, label: "Total Questions", value: `${EXAM_QUESTION_COUNT} MCQs` },
    { icon: <BadgeCheck className="h-5 w-5" />, label: "Total Marks", value: `${EXAM_QUESTION_COUNT} (1 each)` },
    { icon: <Clock3 className="h-5 w-5" />, label: "Time Limit", value: `${EXAM_DURATION_MINUTES} Minutes` },
    { icon: <MinusCircle className="h-5 w-5" />, label: "Negative Marking", value: "None" },
    { icon: <Target className="h-5 w-5" />, label: "Passing Score", value: "≥ 40%" },
  ];

  const steps = [
    {
      icon: <UserRound className="h-6 w-6" />,
      title: "1 · Register",
      text: "Enter your name, designation, block and mobile (email optional). One attempt per participant.",
    },
    {
      icon: <MonitorSmartphone className="h-6 w-6" />,
      title: "2 · Take the Exam",
      text: `Answer ${EXAM_QUESTION_COUNT} MCQs on your mobile or computer within ${EXAM_DURATION_MINUTES} minutes. Full-screen, monitored session.`,
    },
    {
      icon: <CheckCircle2 className="h-6 w-6" />,
      title: "3 · See Your Result",
      text: "Your score is computed instantly on submission and shown on the result page.",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:py-10">
      {/* ---------- Exam window status banner ---------- */}
      <div
        className={`mb-6 rounded-md border px-4 py-3 ${
          examOpen
            ? "border-indiaGreen bg-indiaGreen-light text-indiaGreen-dark"
            : "border-red-200 bg-red-50 text-red-700"
        }`}
      >
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-sm font-medium sm:items-center">
            {examOpen ? (
              <span className="relative mt-1.5 flex h-2.5 w-2.5 shrink-0 sm:mt-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indiaGreen opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-indiaGreen" />
              </span>
            ) : (
              <Lock className="mt-0.5 h-4 w-4 shrink-0 sm:mt-0" />
            )}
            <span className="min-w-0 break-words">
              {examOpen ? (
                <>
                  Exam window is <strong>LIVE</strong> — registration and the exam
                  are open now.
                </>
              ) : (
                <>
                  Exam window is currently <strong>closed</strong> — it opens when
                  the administrator starts the exam.
                </>
              )}
            </span>
          </p>
          {isAdmin && (
            <Link
              href="/admin"
              className="btn-outline shrink-0 self-start px-3 py-1.5 text-xs sm:self-auto"
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Open Admin Dashboard
            </Link>
          )}
        </div>
      </div>

      {/* ---------- Hero ---------- */}
      <section className="gov-card mb-8 overflow-hidden p-6 md:p-8">
        <div className="mb-4 flex items-center gap-2" aria-hidden="true">
          <span className="h-2 w-10 rounded bg-saffron" />
          <span className="h-2 w-10 rounded bg-indiaGreen" />
        </div>

        <p className="text-xs font-semibold uppercase tracking-widest text-saffron-dark">
          District Level Workshop cum Training Program
        </p>
        <h1 className="mt-2 text-2xl font-bold leading-tight text-navy md:text-3xl">
          Viksit Bharat — Guarantee for Rozgar and Ajeevika Mission (Gramin)
        </h1>
        <p className="mt-2 text-sm font-medium text-gray-600">
          Module for Block Level Officials Serving as Master Trainers ·{" "}
          <span className="text-navy">Post-Training Evaluation Sheet</span>
          <span className="ml-1 text-gray-500">(पोस्ट-टेस्ट मूल्यांकन पत्रक)</span>
        </p>

        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-gray-600 md:text-base">
          Welcome to the official online assessment platform conducted by the{" "}
          <strong className="text-navy">District Rural Development Section (DRDS), Deoghar</strong>,
          Government of Jharkhand. Registered participants may appear for the
          objective examination from the Participant Portal below — on mobile
          or desktop.
        </p>

        {/* Program meta */}
        <div className="mt-5 grid gap-2.5 text-sm text-gray-700 sm:grid-cols-2 sm:max-w-xl">
          <p className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 shrink-0 text-saffron-dark" />
            <span>
              <strong>Date:</strong> 13th August, 2026
            </span>
          </p>
          <p className="flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0 text-saffron-dark" />
            <span>
              <strong>Venue:</strong> DRDS Training Hall, Deoghar
            </span>
          </p>
        </div>
      </section>

      {/* ---------- Exam facts strip ---------- */}
      <section className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-5">
        {examFacts.map((f) => (
          <div key={f.label} className="gov-card flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-saffron-light text-saffron-dark">
              {f.icon}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight text-navy md:text-base">
                {f.value}
              </p>
              <p className="text-[11px] text-gray-500">{f.label}</p>
            </div>
          </div>
        ))}
      </section>

      {/* ---------- Instructions ---------- */}
      <section className="gov-card mb-8 p-6 md:p-8">
        <h3 className="gov-heading mb-1">मुख्य दिशा-निर्देश एवं शर्तें</h3>
        <p className="mb-5 text-sm font-medium text-gray-500">
          Exam Guidelines &amp; Terms
        </p>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Exam facts */}
          <div>
            <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-saffron-dark">
              <Info className="h-4 w-4" /> परीक्षा निर्देश · Exam Format
            </h4>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-indiaGreen" />
                <span>
                  <strong>कुल प्रश्न:</strong> {EXAM_QUESTION_COUNT}{" "}
                  बहुविकल्पीय प्रश्न (MCQs) · <strong>Total:</strong>{" "}
                  {EXAM_QUESTION_COUNT} questions
                </span>
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-indiaGreen" />
                <span>
                  <strong>कुल अंक:</strong> {EXAM_QUESTION_COUNT} अंक (प्रत्येक
                  प्रश्न 1 अंक) · <strong>Total Marks:</strong>{" "}
                  {EXAM_QUESTION_COUNT} (1 mark each)
                </span>
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-indiaGreen" />
                <span>
                  <strong>समय सीमा:</strong> {EXAM_DURATION_MINUTES} मिनट ·{" "}
                  <strong>Time Limit:</strong> {EXAM_DURATION_MINUTES} minutes
                </span>
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-indiaGreen" />
                <span>
                  <strong>नेगेटिव मार्किंग:</strong> नहीं है ·{" "}
                  <strong>Negative Marking:</strong> No negative marking
                </span>
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-indiaGreen" />
                <span>
                  उत्तीर्ण हेतु न्यूनतम <strong>40%</strong> अंक आवश्यक · Passing score:{" "}
                  <strong>≥ 40%</strong>
                </span>
              </li>
            </ul>
          </div>

          {/* Technical rules */}
          <div>
            <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-saffron-dark">
              <ShieldCheck className="h-4 w-4" /> तकनीकी एवं सबमिशन नियम · Technical Rules
            </h4>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-saffron-dark" />
                परीक्षा के दौरान इंटरनेट कनेक्शन चालू रखें। Keep your internet
                connection active throughout the exam.
              </li>
              <li className="flex gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-saffron-dark" />
                ब्राउज़र बंद न करें और पेज रीफ्रेश न करें — ऐसा करने पर परीक्षा
                अपने-आप सबमिट हो सकती है। Don&apos;t close or refresh the browser —
                the exam may auto-submit.
              </li>
              <li className="flex gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-saffron-dark" />
                टैब स्विचिंग / दूसरे ऐप पर जाने की अनुमति नहीं है। Tab switching is
                not allowed and is monitored.
              </li>
              <li className="flex gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-saffron-dark" />
                समय समाप्त होते ही टेस्ट अपने-आप सबमिट हो जाएगा। The exam
                auto-submits when the timer reaches zero.
              </li>
              <li className="flex gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-saffron-dark" />
                एक प्रतिभागी केवल एक बार परीक्षा दे सकता है। Only one attempt is
                allowed per participant.
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* ---------- Participant CTA ---------- */}
      <section className="gov-card mb-8 flex flex-col items-center gap-6 p-6 text-center md:flex-row md:p-8 md:text-left">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-saffron-light text-saffron-dark">
          <ClipboardList className="h-10 w-10" />
        </div>
        <div className="flex-1">
          <h2 className="gov-heading">Participant Portal</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-600">
            Register with your official details (Name, Designation, Block,
            Mobile — Email optional) and immediately begin the objective
            examination.
            The exam runs in a monitored full-screen session —{" "}
            <strong>please read the guidelines above first.</strong>
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3 md:justify-start">
            <Link
              href="/register"
              className="btn-primary"
              aria-disabled={!examOpen}
            >
              {examOpen ? (
                <>
                  Register &amp; Start Exam <ArrowRight className="h-4 w-4" />
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" /> View Registration Status
                </>
              )}
            </Link>
          </div>
          {!examOpen && (
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-red-600">
              <AlertCircle className="h-3.5 w-3.5" />
              Registration opens when the administrator starts the exam.
            </p>
          )}
        </div>

        <div className="w-full max-w-xs rounded-md border border-gray-200 bg-parchment p-4 text-left sm:mx-auto md:mx-0">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Quick Facts
          </p>
          <ul className="space-y-1.5 text-sm text-gray-700">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-indiaGreen" />
              {questionCount > 0
                ? `${questionCount} question${questionCount > 1 ? "s" : ""} published`
                : "Questions not yet published"}
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-indiaGreen" />
              Single attempt per participant
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-indiaGreen" />
              Works on mobile &amp; desktop
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-indiaGreen" />
              Instant score after submission
            </li>
          </ul>
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section className="mb-8 grid gap-4 md:grid-cols-3">
        {steps.map((s) => (
          <div key={s.title} className="gov-card p-5">
            <div className="mb-3 inline-flex rounded-full bg-indiaGreen-light p-2.5 text-indiaGreen-dark">
              {s.icon}
            </div>
            <h3 className="font-bold text-navy">{s.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{s.text}</p>
          </div>
        ))}
      </section>

      {/* ---------- Session Presentations (bottom of page, above footer) ---------- */}
      <PptLibrary presentations={presentations} />
    </div>
  );
}
