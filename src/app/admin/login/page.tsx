import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import AdminLoginForm from "@/components/AdminLoginForm";
import { isAdminAuthenticated } from "@/lib/admin";

export const metadata: Metadata = {
  title: "Admin Login",
};

/**
 * Admin login page. If a valid session already exists the user is
 * forwarded straight to the dashboard.
 */
export default function AdminLoginPage() {
  if (isAdminAuthenticated()) {
    redirect("/admin");
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="gov-card p-8">
        <div className="mb-4 flex items-center justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indiaGreen-light text-indiaGreen">
            <ShieldCheck className="h-7 w-7" />
          </div>
        </div>
        <h1 className="gov-heading text-center">Admin Portal Login</h1>
        <p className="mt-2 text-center text-sm text-gray-600">
          Authorised personnel only. Enter the administrative password to
          continue.
        </p>

        <div className="mt-6 border-t border-gray-200 pt-6">
          <AdminLoginForm />
        </div>
      </div>
    </div>
  );
}
