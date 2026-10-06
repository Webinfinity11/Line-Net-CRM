"use client";

import { usePathname } from "next/navigation";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Keep these paths in sync with app/(print)/**.
  const printRoute = /^\/(?:orders\/[^/]+\/(?:act|invoice|sheet)|quotes\/[^/]+\/pdf)\/?$/.test(pathname);

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      // Nested next-themes providers are ignored. Force light at the root so
      // print routes never inherit .dark, without overwriting the saved choice.
      forcedTheme={printRoute ? "light" : undefined}
    >
      {children}
    </NextThemesProvider>
  );
}
