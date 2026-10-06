"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  INSTALL_KEY,
  canOfferInstall,
  dismissInstall,
  installPromptHidden,
  isIosSafari,
  markInstalled,
  parseInstallState,
  type InstallState,
} from "@/lib/install-prompt";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const SHOW_AFTER_MS = 8000;

function readState(): InstallState {
  try {
    return parseInstallState(localStorage.getItem(INSTALL_KEY));
  } catch {
    return parseInstallState(null);
  }
}

function writeState(state: InstallState) {
  try {
    localStorage.setItem(INSTALL_KEY, JSON.stringify(state));
  } catch {}
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

/**
 * Offers to install the CRM on a phone's home screen: Chrome's own install dialog on Android,
 * a short Share → "Add to Home Screen" hint in iPhone Safari. Appears after a few seconds or on
 * the second screen, a week apart after "not now", never again after three refusals or an install.
 * Also registers the pass-through service worker (public/sw.js), which caches nothing.
 */
export function InstallPrompt() {
  const pathname = usePathname();
  const [mode, setMode] = useState<"android" | "ios" | null>(null);
  const [ready, setReady] = useState(false);
  const [closed, setClosed] = useState(false);
  const deferred = useRef<InstallEvent | null>(null);
  const firstPath = useRef(pathname);

  useEffect(() => {
    if ("serviceWorker" in navigator && window.isSecureContext) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onInstalled = () => {
      writeState(markInstalled(readState()));
      setClosed(true);
    };
    window.addEventListener("appinstalled", onInstalled);

    const phone = window.matchMedia("(pointer: coarse) and (max-width: 1024px)").matches;
    if (!phone || isStandalone() || !canOfferInstall(readState(), Date.now())) {
      return () => window.removeEventListener("appinstalled", onInstalled);
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      deferred.current = event as InstallEvent;
      setMode("android");
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    if (isIosSafari(navigator.userAgent, navigator.platform, navigator.maxTouchPoints)) setMode("ios");

    const timer = window.setTimeout(() => setReady(true), SHOW_AFTER_MS);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Moving to a second screen counts as settling in, too.
  useEffect(() => {
    if (pathname !== firstPath.current) setReady(true);
  }, [pathname]);

  if (!mode || !ready || closed || installPromptHidden(pathname)) return null;

  function notNow() {
    writeState(dismissInstall(readState(), Date.now()));
    setClosed(true);
  }

  async function install() {
    const event = deferred.current;
    if (!event) return;
    deferred.current = null;
    setClosed(true);
    try {
      await event.prompt();
      const { outcome } = await event.userChoice;
      writeState(outcome === "accepted" ? markInstalled(readState()) : dismissInstall(readState(), Date.now()));
    } catch {}
  }

  return (
    <div
      role="dialog"
      aria-label="აპის დაყენება"
      className="ln-card ln-pop fixed inset-x-[12px] bottom-[calc(88px+env(safe-area-inset-bottom,0px))] z-40 p-[14px] md:inset-x-auto md:right-[16px] md:bottom-[calc(16px+env(safe-area-inset-bottom,0px))] md:w-[360px]"
    >
      <div className="flex items-start gap-[12px]">
        <img src="/icon-192.png" alt="" width={40} height={40} className="size-[40px] shrink-0 rounded-[10px]" />
        <div className="min-w-0 flex-1 pt-[2px]">
          <p className="text-[14px] font-semibold leading-[20px] text-[#17212b]">დააყენეთ Line Net ტელეფონზე</p>
          {mode === "android" ? (
            <p className="mt-[2px] text-[13px] leading-[18px] text-[#617084]">გაიხსნება აპივით, ბრაუზერის გარეშე.</p>
          ) : (
            <p className="mt-[2px] text-[13px] leading-[18px] text-[#617084]">
              დააჭირეთ
              <Share className="mx-[4px] inline size-[15px] -translate-y-px align-middle text-[#3457d5]" aria-label="გაზიარება" />
              და აირჩიეთ „Add to Home Screen“
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={notNow}
          aria-label="დახურვა"
          className="-mr-[8px] -mt-[8px] flex size-[44px] shrink-0 items-center justify-center rounded-full text-[#8b98a9] hover:bg-[#f1f4f9] hover:text-[#17212b]"
        >
          <X className="size-[18px]" />
        </button>
      </div>
      <div className="mt-[10px] flex justify-end gap-[8px]">
        <Button variant="ghost" className="h-[44px] px-[16px]" onClick={notNow}>არა ახლა</Button>
        {mode === "android" ? <Button className="h-[44px] px-[20px]" onClick={install}>დაყენება</Button> : null}
      </div>
    </div>
  );
}
