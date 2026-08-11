"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { adminLogin } from "@/lib/actions/admin";

/**
 * Admin login form — verifies the password via the server action,
 * which sets the httpOnly session cookie on success.
 */
export default function AdminLoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!password) {
      setError("Password is required.");
      return;
    }

    setPending(true);
    setError(null);
    try {
      const result = await adminLogin(password);
      if (result.ok) {
        router.push("/admin");
        router.refresh();
      } else {
        setError(result.error ?? "Login failed.");
        setPending(false);
      }
    } catch {
      setError("Login failed. Please try again.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="admin-password" className="form-label">
          Admin Password
        </label>
        <div className="relative">
          <input
            id="admin-password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter administrative password"
            autoComplete="current-password"
            className="form-input pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-navy"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {error && (
        <p className="flex items-center gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn-green w-full">
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <KeyRound className="h-4 w-4" />
        )}
        {pending ? "Verifying..." : "Login"}
      </button>
    </form>
  );
}
