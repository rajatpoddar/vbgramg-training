"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Info,
  ListChecks,
  Loader2,
  Maximize2,
  Play,
  Send,
  ShieldAlert,
  Timer,
  XCircle,
} from "lucide-react";
import { heartbeat, submitExam } from "@/lib/actions/exam";
import { EXAM_DURATION_MINUTES, EXAM_DURATION_SECONDS } from "@/lib/examConfig";
import type { ExamQuestion } from "@/lib/queries";

type Props = {
  userId: string;
  questions: ExamQuestion[];
  /** Previously saved answers (from a resumed session), keyed by question id. */
  initialAnswers?: Record<string, string>;
  /** Remaining seconds on resume (server-computed from the session start). */
  initialTimeLeft?: number;
};

type Phase = "start" | "exam" | "submitting";

/** Maximum number of anti-cheat violations before auto-submission. */
const MAX_STRIKES = 3;

/** How often the exam client reports its live status to the server. */
const HEARTBEAT_INTERVAL_MS = 20_000;

/**
 * Fisher–Yates shuffle — returns a new array with the same items in a
 * random order (used to vary the exam per session).
 */
function shuffleArray<T>(items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * ExamInterface — the participant-facing examination.
 *
 * Anti-cheat (low level):
 *  - Runs in full-screen (Fullscreen API).
 *  - `visibilitychange`, window `blur` and `fullscreenchange` are tracked.
 *  - Each violation shows a strictly-worded modal warning; on the 3rd
 *    violation the exam is auto-submitted.
 *
 * Real-time feedback:
 *  - Clicking an option instantly colours it green (correct) or red
 *    (wrong, with the correct option highlighted green).
 *  - The live score counter updates immediately; questions lock once answered.
 */
export default function ExamInterface({
  userId,
  questions,
  initialAnswers,
  initialTimeLeft,
}: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("start");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>(
    initialAnswers ?? {}
  );
  const [strikes, setStrikes] = useState(0);
  const [warning, setWarning] = useState<{ show: boolean; message: string }>({
    show: false,
    message: "",
  });
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Question palette is collapsed on phones so the screen stays focused on
  // the timer + question + options (toggled via the status bar).
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState(
    initialTimeLeft ?? EXAM_DURATION_SECONDS
  );
  // Candidate must tick the consent declaration before the exam can start.
  const [consent, setConsent] = useState(false);

  /**
   * Randomised session view: question order AND option order are shuffled
   * per session so candidates sitting together cannot compare answers by
   * question number or option letter. Answers are keyed by question id, so
   * scoring and submission remain unaffected.
   */
  const sessionQuestions = useMemo(
    () =>
      shuffleArray(questions).map((q) => ({
        ...q,
        options: shuffleArray(q.options),
      })),
    [questions]
  );

  // Mobile browsers (esp. iOS) do not support the Fullscreen API — on such
  // devices we skip the full-screen requirement and only monitor tab switches.
  const isMobile = useMemo(
    () => /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || ""),
    []
  );

  // ---- Refs mirroring state, so event listeners never read stale values ----
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const strikesRef = useRef(strikes);
  strikesRef.current = strikes;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const submittingRef = useRef(false);
  const fullscreenActiveRef = useRef(false);
  // Set once when the timer expires, so a failed submission does not trigger
  // an endless auto-submit retry loop (phase returns to "exam" on error).
  const timeExpiredRef = useRef(false);
  // Simple throttle for the per-answer heartbeat (max 1 write / 3s).
  const lastHeartbeatRef = useRef(0);
  // When the last anti-cheat violation was recorded — used to collapse the
  // blur + visibilitychange pair that a single interruption (incoming call,
  // screen-off) fires back-to-back into one violation.
  const lastViolationAtRef = useRef(0);

  /** Live score — recomputed instantly as options are selected. */
  const liveScore = useMemo(
    () =>
      questions.filter(
        (q) => answers[q.id] && answers[q.id] === q.correctAnswer
      ).length,
    [answers, questions]
  );

  const answeredCount = useMemo(
    () => questions.filter((q) => answers[q.id]).length,
    [answers, questions]
  );

  /**
   * Submit the exam (used by both the manual button and the 3rd-strike
   * auto-submit). Score is recomputed server-side for integrity.
   *
   * Retry up to 3 times with a short backoff so a transient network blip or
   * a slow NAS response does not strand the candidate on the "submitting"
   * screen. If the server says the exam is already submitted (e.g. the
   * server-side auto-finalise in the heartbeat ran first), just go to the
   * result page. If every attempt fails, return to the exam with a clear
   * error and let the candidate tap Submit again.
   */
  const finalizeExam = useCallback(
    async () => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      setPhase("submitting");

      const maxAttempts = 3;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const res = await submitExam(userId, answersRef.current);
          if (res.ok) {
            router.replace(`/result?userId=${userId}`);
            return;
          }
          // Already submitted (e.g. the server auto-finalised it when the
          // clock ran out) → the exam is over, take them to their result.
          if (res.message && /already/i.test(res.message)) {
            router.replace(`/result?userId=${userId}`);
            return;
          }
          if (attempt < maxAttempts) {
            await new Promise((r) => setTimeout(r, 1000 * attempt));
            continue;
          }
          submittingRef.current = false;
          setPhase("exam");
          setError(res.message ?? "Unable to submit the exam. Please try again.");
          return;
        } catch {
          if (attempt < maxAttempts) {
            await new Promise((r) => setTimeout(r, 1000 * attempt));
            continue;
          }
          submittingRef.current = false;
          setPhase("exam");
          setError("Network error while submitting. Please try again.");
          return;
        }
      }
    },
    [router, userId]
  );

  /**
   * Re-sync the countdown with the server's authoritative remaining time.
   * Only applies the correction when the drift is meaningful, so minor
   * clock differences between the phone and server are ignored. This keeps
   * the timer honest after a screen-off / background-tab pause (browser
   * timers are throttled there, but the server clock is not).
   */
  const syncClock = useCallback((serverSeconds: number) => {
    setTimeLeft((local) => {
      if (Math.abs(local - serverSeconds) > 5) return serverSeconds;
      return local;
    });
  }, []);

  /**    * Report the participant's current score + activity to the server so the
   * admin LIVE panel can show who is taking the exam right now.
   */
  const sendHeartbeat = useCallback(() => {
    if (submittingRef.current || phaseRef.current !== "exam") return;
    const score = questions.filter(
      (q) => answersRef.current[q.id] === q.correctAnswer
    ).length;
    // Persist the current answers so an interrupted session can be resumed.
    // If the admin force-ended the session, redirect to the result page.
    void heartbeat(userId, score, answersRef.current).then((res) => {
      if (res?.ended) {
        router.replace(`/result?userId=${userId}`);
      } else if (res?.timeLeft !== undefined) {
        syncClock(res.timeLeft);
      }
    });
  }, [questions, userId, router, syncClock]);

  /**
   * Record an anti-cheat violation. Strictly-worded warning; on the
   * 3rd violation the exam is submitted automatically.
   */
  const recordViolation = useCallback(
    (message: string) => {
      if (submittingRef.current || phaseRef.current !== "exam") return;

      // One interruption (a phone call, the screen turning off) fires blur
      // and visibilitychange almost simultaneously — count it once.
      const now = Date.now();
      if (now - lastViolationAtRef.current < 3000) return;
      lastViolationAtRef.current = now;

      const next = strikesRef.current + 1;
      strikesRef.current = next;
      setStrikes(next);

      if (next >= MAX_STRIKES) {
        void finalizeExam();
      } else {
        setWarning({
          show: true,
          message: `${message} This is violation ${next} of ${MAX_STRIKES}. On the ${MAX_STRIKES}rd violation, your exam will be submitted automatically without further notice.`,
        });
      }
    },
    [finalizeExam]
  );

  // ---- Attach anti-cheat listeners once the exam starts ----
  useEffect(() => {
    if (phase !== "exam") return;

    const onVisibilityChange = () => {
      if (document.hidden) {
        recordViolation("You switched to another tab or window.");
      }
    };
    const onWindowBlur = () => {
      // A phone call / notification hides the document AND blurs the window
      // at the same time — counting both would record two violations for one
      // interruption. The visibility handler below already covers it.
      if (document.hidden) return;
      recordViolation("The exam window lost focus.");
    };
    const onFullscreenChange = () => {
      // Fullscreen is not available on mobile — never penalise it there.
      if (!isMobile && !document.fullscreenElement && fullscreenActiveRef.current) {
        recordViolation("You exited full-screen mode.");
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onWindowBlur);
    document.addEventListener("fullscreenchange", onFullscreenChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onWindowBlur);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [phase, recordViolation, isMobile]);

  // ---- Countdown timer: ticks down every second while the exam runs ----
  useEffect(() => {
    if (phase !== "exam") return;
    const id = setInterval(() => setTimeLeft((t) => (t > 0 ? t - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [phase]);

  // ---- Time's up → auto-submit the exam (only once) ----
  useEffect(() => {
    if (phase === "exam" && timeLeft === 0 && !timeExpiredRef.current) {
      timeExpiredRef.current = true;
      void finalizeExam();
    }
  }, [timeLeft, phase, finalizeExam]);

  // ---- Periodic heartbeat for the admin LIVE panel ----
  useEffect(() => {
    if (phase !== "exam") return;
    const id = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(id);
  }, [phase, sendHeartbeat]);

  // ---- Warn before refresh / tab close during the exam ----
  useEffect(() => {
    if (phase !== "exam") return;

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [phase]);

  /** User-triggered start: enter fullscreen (desktop), then unlock the exam. */
  const startExam = async () => {
    // Skip the fullscreen request on mobile and where the browser does not
    // support the Fullscreen API at all (e.g. iOS Safari).
    if (!isMobile && document.fullscreenEnabled) {
      try {
        await document.documentElement.requestFullscreen();
        fullscreenActiveRef.current = true;
      } catch {
        // Fullscreen can be blocked (permissions / embedded contexts).
        setWarning({
          show: true,
          message:
            "Full-screen mode could not be enabled. Please do not switch tabs or leave this window — such activity is monitored and penalised.",
        });
      }
    }
    timeExpiredRef.current = false;
    setPhase("exam");
    // Register the live session + first heartbeat immediately (also persists
    // any restored answers from a resumed session).
    void heartbeat(userId, 0, answersRef.current).then((res) => {
      if (res?.ended) {
        router.replace(`/result?userId=${userId}`);
      } else if (res?.timeLeft !== undefined) {
        syncClock(res.timeLeft);
      }
    });
  };

  /** Dismiss the warning modal and attempt to re-enter fullscreen. */
  const dismissWarning = async () => {
    setWarning({ show: false, message: "" });
    if (isMobile) return; // no fullscreen API on mobile
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        fullscreenActiveRef.current = true;
      }
    } catch {
      /* fullscreen unavailable — continue monitoring */
    }
  };

  /** Select an option for the current question (locks after answering). */
  const selectOption = (option: string) => {
    const q = sessionQuestions[currentIndex];
    if (phase !== "exam" || answers[q.id]) return;
    setAnswers((prev) => ({ ...prev, [q.id]: option }));

    // Report the updated score + saved answers to the server — throttled so
    // rapid answering does not spam the DB (the 20s interval keeps us
    // "online"). The answers are persisted so a network failure can resume
    // from this point.
    const now = Date.now();
    if (now - lastHeartbeatRef.current > 3000) {
      lastHeartbeatRef.current = now;
      const newScore = liveScore + (option === q.correctAnswer ? 1 : 0);
      const nextAnswers = { ...answersRef.current, [q.id]: option };
      void heartbeat(userId, newScore, nextAnswers).then((res) => {
        if (res?.ended) {
          router.replace(`/result?userId=${userId}`);
        } else if (res?.timeLeft !== undefined) {
          syncClock(res.timeLeft);
        }
      });
    }
  };

  // ================================================================
  // Render
  // ================================================================

  /* ---------- Start screen ---------- */
  if (phase === "start") {
    return (
      <div className="gov-card p-5 text-center sm:p-8">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-saffron-light text-saffron-dark sm:h-16 sm:w-16">
          <ShieldAlert className="h-7 w-7 sm:h-8 sm:w-8" />
        </div>
        <h1 className="gov-heading">Examination Rules</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-gray-600">
          You are about to appear for the <strong>Viksit Bharat - G RAM G</strong>{" "}
          objective examination containing{" "}
          <strong>{questions.length} questions</strong>. Read the rules below
          carefully before proceeding.
        </p>

        <ul className="mx-auto mt-5 max-w-xl space-y-2 text-left text-sm text-gray-700 sm:mt-6">
          <li className="flex gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-saffron-dark" />
            <span className="min-w-0 flex-1 break-words">
              The exam runs in <strong>full-screen mode</strong>. Exiting
              full-screen, switching tabs, or opening another window is strictly
              prohibited.
            </span>
          </li>
          <li className="flex gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-saffron-dark" />
            <span className="min-w-0 flex-1 break-words">
              You will receive <strong>one warning</strong> per violation. On
              the <strong>third violation, the exam will be submitted
              automatically</strong> and your current score finalised.
            </span>
          </li>
          <li className="flex gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-saffron-dark" />
            <span className="min-w-0 flex-1 break-words">
              You have{" "}
              <strong>{EXAM_DURATION_MINUTES} minutes</strong> to complete the
              exam. The timer starts immediately and runs continuously — when
              it reaches zero the exam is submitted automatically.
            </span>
          </li>
          <li className="flex gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-saffron-dark" />
            <span className="min-w-0 flex-1 break-words">
              Answers lock after selection — they cannot be changed once
              submitted for a question.
            </span>
          </li>
          {isMobile && (
            <li className="flex gap-2 text-xs text-gray-500">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-saffron-dark" />
              <span className="min-w-0 flex-1 break-words">
                Mobile browsers do not support full-screen mode — switching
                tabs or leaving the app is still monitored.
              </span>
            </li>
          )}
        </ul>

        {/* Consent declaration — mandatory before starting */}
        <label className="mx-auto mt-5 flex max-w-xl cursor-pointer items-start gap-3 rounded border border-gray-300 bg-parchment p-3 text-left sm:mt-6 sm:p-4">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-indiaGreen"
          />
          <span className="min-w-0 flex-1 break-words text-xs leading-relaxed text-gray-700 sm:text-sm">
            <strong>☑️ स्वीकृति (Consent):</strong> मैं घोषणा करता/करती हूँ कि मैंने
            ऊपर दिए गए सभी दिशा-निर्देश एवं शर्तों को ध्यानपूर्वक पढ़ और समझ लिया
            है। मैं ईमानदारी से परीक्षा देने के लिए तैयार हूँ। — I have read and
            understood all the guidelines above and am ready to take the exam
            honestly.
          </span>
        </label>

        <button
          onClick={startExam}
          disabled={!consent}
          className="btn-green mt-6 w-full sm:w-auto"
        >
          {isMobile ? <Play className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          {isMobile ? "Start Exam" : "Enter Full-Screen & Start Exam"}
        </button>
        {/* Hint always rendered (same height in both states) so toggling the
            consent checkbox never shifts the layout. */}
        <p
          className={`mt-3 text-xs ${
            consent ? "font-medium text-indiaGreen-dark" : "text-gray-500"
          }`}
        >
          {consent
            ? "✓ Consent recorded — tap the button above to start the exam."
            : "Please tick the consent checkbox above to start the exam."}
        </p>
      </div>
    );
  }

  /* ---------- Submitting ---------- */
  if (phase === "submitting") {
    return (
      <div className="gov-card flex flex-col items-center p-12 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-saffron-dark" />
        <p className="mt-4 text-sm font-medium text-navy">
          Submitting your examination…
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Please do not close or refresh this page.
        </p>
      </div>
    );
  }

  /* ---------- Exam in progress ---------- */
  const current = sessionQuestions[currentIndex];
  const selected = answers[current.id];
  const answered = Boolean(selected);
  const correct = answered && selected === current.correctAnswer;

  // Remaining time, formatted as MM:SS.
  const timeLabel = `${String(Math.floor(timeLeft / 60)).padStart(2, "0")}:${String(
    timeLeft % 60
  ).padStart(2, "0")}`;

  return (
    <div
      className="space-y-4 no-select"
      onContextMenu={(e) => e.preventDefault()}
      // Nothing inside the live exam may be selected, copied, dragged or
      // pasted — long-press selection on Android phones can trigger AI
      // assistants, so even copy/paste shortcuts are blocked.
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onPaste={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      {/* Status bar: timer always visible (sticky on phones); the rest of
          the stats are desktop-only so the mobile screen stays focused on
          the timer, the question and the options. */}
      <div className="gov-card sticky top-2 z-20 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
        <div className="flex items-center gap-3">
          {/* Countdown timer */}
          <div
            className={`flex items-center gap-1.5 rounded border px-2.5 py-1 text-sm font-bold tabular-nums ${
              timeLeft <= 60
                ? "animate-pulse border-red-600 bg-red-50 text-red-700"
                : "border-saffron bg-saffron-light text-saffron-dark"
            }`}
            title="Remaining time"
          >
            <Timer className="h-4 w-4" />
            {timeLabel}
          </div>
          {/* Compact progress on phones — the only other thing in the bar */}
          <span className="text-xs font-semibold text-gray-600 sm:hidden">
            Q {currentIndex + 1}/{questions.length}
          </span>
        </div>

        <div className="hidden items-center gap-2 text-sm sm:flex">
          <span className="font-semibold text-navy">Live Score:</span>
          <span className="font-bold text-indiaGreen">{liveScore}</span>
          <span className="text-gray-500"> / {questions.length}</span>
        </div>

        <div className="hidden items-center gap-2 text-sm sm:flex">
          <span className="font-medium text-gray-600">Answered:</span>
          <span className="font-semibold text-navy">
            {answeredCount}/{questions.length}
          </span>
        </div>
        {/* Strike indicator */}
        <div className="hidden items-center gap-1.5 sm:flex" title="Anti-cheat violations">
          <ShieldAlert className="h-4 w-4 text-saffron-dark" />
          {Array.from({ length: MAX_STRIKES }).map((_, i) => (
            <span
              key={i}
              className={`h-2.5 w-2.5 rounded-full ${
                i < strikes
                  ? "bg-red-600"
                  : "border border-gray-300 bg-white"
              }`}
            />
          ))}
        </div>

        {/* Palette toggle — phones only; on desktop the palette is always on */}
        <button
          type="button"
          onClick={() => setPaletteOpen((o) => !o)}
          aria-expanded={paletteOpen}
          className="flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs font-semibold text-navy sm:hidden"
        >
          <ListChecks className="h-3.5 w-3.5" />
          Palette {paletteOpen ? "▲" : "▼"}
        </button>
      </div>

      {/* Question palette — collapsed on phones until toggled */}
      <div
        className={`gov-card px-4 py-3 ${
          paletteOpen ? "block" : "hidden sm:block"
        }`}
      >
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Question Palette
        </p>
        <div className="flex flex-wrap gap-1.5">
          {sessionQuestions.map((q, i) => {
            const a = answers[q.id];
            let cls = "border-gray-300 bg-white text-gray-700";
            if (a) {
              cls =
                a === q.correctAnswer
                  ? "border-indiaGreen bg-indiaGreen text-white"
                  : "border-red-600 bg-red-600 text-white";
            }
            if (i === currentIndex) {
              cls += " ring-2 ring-saffron";
            }
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => {
                  setCurrentIndex(i);
                  // On phones, returning to the question closes the palette
                  // so the view stays focused on the question + options.
                  if (paletteOpen) setPaletteOpen(false);
                }}
                className={`h-8 w-8 rounded border text-xs font-semibold transition-colors ${cls}`}
                aria-label={`Go to question ${i + 1}`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>

      {/* Current question */}
      <div className="gov-card p-5 md:p-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-saffron-dark">
          Question {currentIndex + 1} of {questions.length}
        </p>
        <h2 className="text-base font-semibold leading-relaxed text-navy md:text-lg">
          <span draggable={false}>{current.text}</span>
        </h2>

        <div className="mt-5 space-y-2.5">
          {current.options.map((option) => {
            const isSelected = selected === option;
            const isCorrectOption = option === current.correctAnswer;

            let cls =
              "border-gray-300 bg-white text-gray-800 hover:border-saffron hover:bg-saffron-light/40";
            if (answered) {
              if (isCorrectOption) {
                // Correct option always shown green after answering.
                cls =
                  "border-indiaGreen bg-indiaGreen-light text-indiaGreen-dark font-medium";
              } else if (isSelected) {
                // Wrong selection shown red.
                cls = "border-red-600 bg-red-50 text-red-700 font-medium";
              } else {
                cls = "border-gray-200 bg-gray-50 text-gray-400 opacity-70";
              }
            }

            return (
              <button
                key={option}
                type="button"
                disabled={answered}
                onClick={() => selectOption(option)}
                className={`flex w-full items-center justify-between gap-3 rounded border px-4 py-3 text-left text-sm transition-colors disabled:cursor-not-allowed ${cls}`}
              >
                <span draggable={false}>{option}</span>
                {answered && isCorrectOption && (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-indiaGreen" />
                )}
                {answered && isSelected && !isCorrectOption && (
                  <XCircle className="h-5 w-5 shrink-0 text-red-600" />
                )}
              </button>
            );
          })}
        </div>

        {/* Answer feedback strip */}
        {answered && (
          <p
            className={`mt-4 flex items-center gap-2 rounded px-3 py-2 text-sm font-medium ${
              correct
                ? "bg-indiaGreen-light text-indiaGreen-dark"
                : "bg-red-50 text-red-700"
            }`}
          >
            {correct ? (
              <>
                <CheckCircle2 className="h-4 w-4" /> Correct! Well done.
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4" /> Incorrect. The correct answer is
                highlighted in green.
              </>
            )}
          </p>
        )}
      </div>

      {/* Navigation + submit (stacked full-width on mobile) */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          disabled={currentIndex === 0}
          onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          className="btn-outline w-full sm:w-auto"
        >
          <ArrowLeft className="h-4 w-4" /> Previous
        </button>

        {currentIndex < questions.length - 1 ? (
          <button
            type="button"
            onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
            className="btn-primary w-full sm:w-auto"
          >
            Next <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmSubmit(true)}
            className="btn-green w-full sm:w-auto"
          >
            <Send className="h-4 w-4" /> Submit Exam
          </button>
        )}
      </div>

      {/* Error banner (e.g. failed submission) */}
      {error && (
        <p className="flex items-center gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      {/* ---------- Anti-cheat warning modal ---------- */}
      {warning.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-md border-2 border-red-600 bg-white p-6 shadow-xl">
            <div className="mb-3 flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="text-lg font-bold">Violation Warning</h3>
            </div>
            <p className="text-sm leading-relaxed text-gray-700">{warning.message}</p>
            <p className="mt-3 text-xs text-gray-500">
              This is a strictly monitored examination. Further violations will
              result in automatic submission of your exam.
            </p>
            <button onClick={dismissWarning} className="btn-danger mt-5 w-full">
              I Understand — Continue Exam
            </button>
          </div>
        </div>
      )}

      {/* ---------- Final submit confirmation modal ---------- */}
      {confirmSubmit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-md border-2 border-indiaGreen bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-navy">Submit Examination?</h3>
            <p className="mt-2 text-sm text-gray-700">
              You have answered{" "}
              <strong>
                {answeredCount} of {questions.length}
              </strong>{" "}
              questions and your current score is <strong>{liveScore}</strong>.
              Unanswered questions will be marked as incorrect.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmSubmit(false)}
                className="btn-outline flex-1"
              >
                Continue Exam
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmSubmit(false);
                  void finalizeExam();
                }}
                className="btn-green flex-1"
              >
                <Send className="h-4 w-4" /> Submit Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
