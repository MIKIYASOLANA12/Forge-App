import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { cookies, headers } from "next/headers";
import { getSessionUserFromCookie, SESSION_COOKIE_NAME } from "@/lib/auth";
import { redirect } from "next/navigation";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FORGE — Personal Growth OS",
  description: "Your AI-powered personal operating system for disciplined growth across six domains.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FORGE",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#09090e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headerList = await headers();
  const pathname = headerList.get("x-pathname") || "";
  const isAuthPath =
    pathname === "/login" ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/verify-email") ||
    pathname.startsWith("/api/");

  if (!isAuthPath) {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (sessionCookie) {
      const user = await getSessionUserFromCookie();
      if (!user) {
        redirect("/login?reason=terminated");
      }
    }
  }

  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Fira+Code:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="bg-[var(--bg-base)] text-[var(--text-primary)] font-[Inter,system-ui,sans-serif]">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
