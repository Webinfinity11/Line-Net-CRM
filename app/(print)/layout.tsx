import type { Viewport } from "next";

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#ffffff",
};

export default function PrintLayout({ children }: LayoutProps<"/">) {
  // The root ThemeProvider forces the entire (print) route group to light,
  // including document-level variables and portalled controls.
  return <div className="light min-h-screen bg-neutral-100 text-[#17212b] print:bg-white" style={{ colorScheme: "light" }}>{children}</div>;
}
