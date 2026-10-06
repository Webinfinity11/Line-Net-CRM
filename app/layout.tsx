import type { Metadata, Viewport } from "next";
import { Noto_Sans_Georgian } from "next/font/google";
import localFont from "next/font/local";
import { InstallPrompt } from "@/components/app/install-prompt";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const body = Noto_Sans_Georgian({
  variable: "--font-sans",
  subsets: ["georgian", "latin"],
  weight: ["400", "500", "600", "700"],
});

const firago = localFont({
  variable: "--font-firago",
  display: "swap",
  src: [
    { path: "./fonts/FiraGO-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/FiraGO-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/FiraGO-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "./fonts/FiraGO-Bold.woff2", weight: "700", style: "normal" },
  ],
});

export const metadata: Metadata = {
  title: { default: "Line Net CRM", template: "%s · Line Net CRM" },
  description: "შეკვეთების მართვის სისტემა",
  appleWebApp: { capable: true, title: "Line Net", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#3457d5",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ka" className={`${body.variable} ${firago.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        {children}
        <InstallPrompt />
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
