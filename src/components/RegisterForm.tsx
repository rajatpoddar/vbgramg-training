"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import { AlertCircle, UserRound } from "lucide-react";
import { registerUser, type RegisterState } from "@/lib/actions/exam";

/** Common designations & Deoghar blocks shown as suggestions. */
const DESIGNATIONS = [
  "Panchayat Sewak",
  "Gram Rozgar Sevak",
  "Block Development Officer",
  "Computer Operator",
  "Clerk",
  "Other",
];
const BLOCKS = [
  "Deoghar",
  "Devipur",
  "Karon",
  "Madhupur",
  "Margomunda",
  "Mohanpur",
  "Palojori",
  "Sarath",
  "Sarwan",
  "Sonaraithari",
];

const initialState: RegisterState = {};

export default function RegisterForm() {
  const router = useRouter();
  const [state, formAction] = useFormState(registerUser, initialState);

  // On successful registration, begin the exam session.
  useEffect(() => {
    if (state.ok && state.userId) {
      router.push(`/exam?userId=${state.userId}`);
    }
  }, [state, router]);

  return (
    <form action={formAction} noValidate={false} className="space-y-4">
      <div>
        <label htmlFor="name" className="form-label">
          Full Name <span className="text-red-600">*</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          minLength={2}
          autoComplete="name"
          placeholder="e.g. Ramesh Kumar Singh"
          className="form-input"
        />
        {state.errors?.name && <p className="form-error">{state.errors.name}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="designation" className="form-label">
            Designation <span className="text-red-600">*</span>
          </label>
          <input
            id="designation"
            name="designation"
            type="text"
            required
            list="designation-list"
            placeholder="e.g. Panchayat Sewak"
            className="form-input"
          />
          <datalist id="designation-list">
            {DESIGNATIONS.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
          {state.errors?.designation && (
            <p className="form-error">{state.errors.designation}</p>
          )}
        </div>

        <div>
          <label htmlFor="block" className="form-label">
            Block <span className="text-red-600">*</span>
          </label>
          <input
            id="block"
            name="block"
            type="text"
            required
            list="block-list"
            placeholder="e.g. Madhupur"
            className="form-input"
          />
          <datalist id="block-list">
            {BLOCKS.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
          {state.errors?.block && <p className="form-error">{state.errors.block}</p>}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
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
            placeholder="10-digit mobile number"
            className="form-input"
          />
          {state.errors?.mobile && (
            <p className="form-error">{state.errors.mobile}</p>
          )}
        </div>

        <div>
          <label htmlFor="email" className="form-label">
            Email Address <span className="text-gray-400 font-normal">(Optional)</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com (optional)"
            className="form-input"
          />
          {state.errors?.email && (
            <p className="form-error">{state.errors.email}</p>
          )}
        </div>
      </div>

      {/* Global error / info message */}
      {state.message && (
        <p className="flex items-center gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {state.message}
        </p>
      )}

      <div className="pt-2">
        <SubmitButton />
      </div>
    </form>
  );
}

/** Submit button with pending (in-flight) state. */
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary w-full sm:w-auto">
      <UserRound className="h-4 w-4" />
      {pending ? "Registering..." : "Register & Start Exam"}
    </button>
  );
}
