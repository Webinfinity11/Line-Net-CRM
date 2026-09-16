import type { Metadata } from "next";
import { Noto_Sans_Georgian } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const font = Noto_Sans_Georgian({
  variable: "--font-sans",
  subsets: ["georgian", "latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: { default: "Line Net CRM", template: "%s · Line Net CRM" },
  description: "შეკვეთების მართვის სისტემა",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ka" className={`${font.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
