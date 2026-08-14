import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getDistrict } from "@/lib/districts";
import "./globals.css";

// Formal, highly-legible font family for a government portal.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

/** District-aware page title / description (per-subdomain). */
export async function generateMetadata(): Promise<Metadata> {
  const district = getDistrict();
  return {
    title: {
      default: "Viksit Bharat - G RAM G | Examination Portal",
      template: "%s | Viksit Bharat - G RAM G",
    },
    description: `Official online examination portal for the Viksit Bharat - G RAM G training programme, District Administration, ${district.name}, Government of Jharkhand.`,
  };
}

/**
 * Mobile-friendly viewport settings (saffron browser chrome on Android).
 *
 * `maximumScale: 1` + `userScalable: false` disable pinch-zoom / the
 * iOS auto-zoom that fires when an input receives focus — tapping a form
 * field must never zoom the page in and out on a phone.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#FF9933",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        {/* Official portal header (hidden when printing) */}
        <Header />

        {/* Page content */}
        <main className="min-h-[60vh] bg-parchment">{children}</main>

        {/* Official portal footer (hidden when printing) */}
        <Footer />
      </body>
    </html>
  );
}
