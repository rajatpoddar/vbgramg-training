"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import { AlertCircle, ArrowRight, BadgeCheck, Smartphone } from "lucide-react";
import { loginByMobile, type MobileLoginState } from "@/lib/actions/candidate";

const initialState: MobileLoginState = {};

export default function MobileLoginForm() {
  const router = useRouter();
  const [state, formAction] = useFormState(loginByMobile, initialState);

  // On success, take the candidate to their result / exam page.
  useEffect(() => {
    if (state.ok && state.redirectTo) {
      router.push(state.redirectTo);
    }
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="mobile" className="form-label">
          Mobile Number <span className="text-red-600">*</span>
        </label>
        <input
          id="mobile"
          name="mobile"
          type="tel"
          required
          pattern="[6-9][0-9]{9}"
          maxLength={10}
          inputMode="numeric"
          autoComplete="tel"
          placeholder="Enter the 10-digit mobile number you registered with"
          className="form-input"
        />
        {state.errors?.mobile && <p className="form-error">{state.errors.mobile}</p>}
      </div>

      {/* Global message */}
      {state.message && (
        <p className="flex items-start gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="min-w-0 break-words">{state.message}</span>
        </p>
      )}

      {/* Not found → offer fresh registration when the window is open */}
      {state.notFound && state.canRegister && (
        <div className="flex items-start gap-2 rounded border border-indiaGreen/30 bg-indiaGreen-light px-3 py-2 text-sm text-indiaGreen-dark">
          <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="min-w-0 break-words">
            New participant?{" "}
            <a href="/register" className="font-semibold underline">
              Register here
            </a>{" "}
            and start the exam.
          </span>
        </div>
      )}

      <div className="pt-2">
        <SubmitButton />
      </div>

      <p className="text-xs leading-relaxed text-gray-500">
        Enter the mobile number you used during registration. If your exam was
        interrupted, you will continue from where you left off — and at the end
        you can download your participation certificate.
      </p>
    </form>
  );
}

/** Submit button with pending (in-flight) state. */
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary w-full sm:w-auto">
      <Smartphone className="h-4 w-4" />
      {pending ? "Checking..." : "Continue"}
      {!pending && <ArrowRight className="h-4 w-4" />}
    </button>
  );
}
