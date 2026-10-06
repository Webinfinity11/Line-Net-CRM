// Pure rules for the "install as app" offer (components/app/install-prompt.tsx).
// Kept free of browser globals so they can be tested.

export const INSTALL_KEY = "ln-install";
export const INSTALL_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;
export const INSTALL_MAX_DISMISSALS = 3;

export type InstallState = { dismissed: number; until: number; installed?: boolean };

export function parseInstallState(raw: string | null): InstallState {
  try {
    const v = raw ? JSON.parse(raw) : null;
    return {
      dismissed: Number.isFinite(v?.dismissed) ? Math.max(0, v.dismissed) : 0,
      until: Number.isFinite(v?.until) ? v.until : 0,
      ...(v?.installed === true ? { installed: true } : {}),
    };
  } catch {
    return { dismissed: 0, until: 0 };
  }
}

export function canOfferInstall(state: InstallState, now: number): boolean {
  return !state.installed && state.dismissed < INSTALL_MAX_DISMISSALS && now >= state.until;
}

/** "Not now" or ✕: wait a week; the third time is final. */
export function dismissInstall(state: InstallState, now: number): InstallState {
  return { ...state, dismissed: state.dismissed + 1, until: now + INSTALL_SNOOZE_MS };
}

export function markInstalled(state: InstallState): InstallState {
  return { ...state, installed: true };
}

/** Screens where the offer never appears: sign-in, API and printable documents. */
export function installPromptHidden(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname.startsWith("/api/") ||
    /^\/(orders|quotes)\/[^/]+\/(act|invoice|sheet|pdf)(\/|$)/.test(pathname)
  );
}

/** Safari, Chrome or Edge on iPhone/iPad: each can add a page to the home screen from its Share menu (iOS 16.4+). In-app browsers cannot. */
export function isIosSafari(ua: string, platform = "", maxTouchPoints = 0): boolean {
  const ios = /iPhone|iPad|iPod/.test(ua) || (platform === "MacIntel" && maxTouchPoints > 1);
  return ios && /Safari\//.test(ua) && !/FxiOS|OPiOS|GSA\/|FBAN|FBAV|Instagram|Line\//.test(ua);
}
