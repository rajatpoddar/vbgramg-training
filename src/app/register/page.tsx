import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Clock3, Lock, MapPin } from "lucide-react";
import RegisterForm from "@/components/RegisterForm";
import { isExamOpen } from "@/lib/queries";
import { getDistrict } from "@/lib/districts";
import { EXAM_DURATION_MINUTES, EXAM_QUESTION_COUNT } from "@/lib/examConfig";

export const metadata: Metadata = {
  title: "Participant Registration",
};

export const dynamic = "force-dynamic";

/**
 * Registration page — collects the mandatory participant details and,
 * on success, starts the exam session.
 *
 * When the admin has not yet opened the exam window, candidates see a
 * notice instead of the form.
 */
export default async function RegisterPage() {
  const examOpen = await isExamOpen();
  const district = getDistrict();

  if (!examOpen) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        <div className="gov-card border-t-4 border-t-red-500 p-6 sm:p-8">
          {/* Icon + heading in a clean row */}
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
              <Lock className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold leading-tight text-navy sm:text-xl">
                Registration Not Open Yet
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                The examination window has <strong>not been started</strong> by
                the administrator. Registration will open shortly before the
                exam — no prior booking is required.
              </p>
            </div>
          </div>

          {/* Program context */}
          <div className="mt-6 space-y-2.5 rounded border border-gray-200 bg-parchment p-4 text-sm text-gray-700">
            <p className="flex items-center gap-2.5">
              <CalendarDays className="h-4 w-4 shrink-0 text-saffron-dark" />
              <span className="min-w-0 break-words">
                <strong>Date:</strong> {district.program.eventDate}
              </span>
            </p>
            <p className="flex items-center gap-2.5">
              <MapPin className="h-4 w-4 shrink-0 text-saffron-dark" />
              <span className="min-w-0 break-words">
                <strong>Venue:</strong> {district.program.venue}
              </span>
            </p>
            <p className="flex items-center gap-2.5">
              <Clock3 className="h-4 w-4 shrink-0 text-saffron-dark" />
              <span className="min-w-0 break-words">
                <strong>Duration:</strong> {EXAM_DURATION_MINUTES} minutes ·{" "}
                {EXAM_QUESTION_COUNT} questions
              </span>
            </p>
          </div>

          <div className="mt-6">
            <Link href="/" className="btn-primary w-full sm:w-auto">
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="gov-card p-6 md:p-8">
        <h1 className="gov-heading">Participant Registration</h1>
        <p className="mt-2 text-sm text-gray-600">
          Please fill in your official details. Fields marked{" "}
          <span className="text-red-600">*</span> are mandatory; email is
          optional. Upon successful registration you will be taken to the
          examination interface immediately.
        </p>

        <div className="mt-6 border-t border-gray-200 pt-6">
          <RegisterForm blocks={district.blocks} />
        </div>
      </div>
    </div>
  );
}
