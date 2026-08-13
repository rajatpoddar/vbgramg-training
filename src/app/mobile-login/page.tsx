import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Award, FileBadge, RotateCcw } from "lucide-react";
import MobileLoginForm from "@/components/MobileLoginForm";

export const metadata: Metadata = {
  title: "Candidate Login — Resume / Certificate",
};

export const dynamic = "force-dynamic";

/**
 * Candidate login — the single entry point for:
 *  - resuming an exam that got interrupted (submission / network failure)
 *  - downloading the participation certificate after the exam
 *
 * Identity is the mobile number captured at registration (no password).
 */
export default function MobileLoginPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <div className="gov-card p-6 md:p-8">
        <h1 className="gov-heading">Candidate Login</h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">
          प्रतिभागी लॉगिन — enter the mobile number you used while registering.
          Your exam will be resumed from where it stopped, and after completion
          you can download your participation certificate.
        </p>

        <div className="mt-6 border-t border-gray-200 pt-6">
          <MobileLoginForm />
        </div>

        {/* What happens next — small reassurance cards */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="flex items-start gap-2.5 rounded border border-gray-200 bg-parchment p-3">
            <RotateCcw className="mt-0.5 h-4 w-4 shrink-0 text-saffron-dark" />
            <p className="text-xs leading-relaxed text-gray-700">
              <strong>Exam interrupted?</strong> You will continue with your
              saved answers and remaining time.
            </p>
          </div>
          <div className="flex items-start gap-2.5 rounded border border-gray-200 bg-parchment p-3">
            <Award className="mt-0.5 h-4 w-4 shrink-0 text-indiaGreen" />
            <p className="text-xs leading-relaxed text-gray-700">
              <strong>Exam submitted?</strong> You can view your result and
              download your participation certificate.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap justify-center gap-4 text-sm">
        <Link href="/" className="btn-outline">
          <ArrowLeft className="h-4 w-4" /> Back to Home
        </Link>
        <Link href="/register" className="btn-outline">
          <FileBadge className="h-4 w-4" /> Register as New Participant
        </Link>
      </div>
    </div>
  );
}
