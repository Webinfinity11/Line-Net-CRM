import { describe, expect, it } from "vitest";
import {
  INSTALL_SNOOZE_MS,
  canOfferInstall,
  dismissInstall,
  installPromptHidden,
  isIosSafari,
  markInstalled,
  parseInstallState,
} from "@/lib/install-prompt";

const IPHONE_SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/138.0 Mobile/15E148 Safari/604.1";
const IPHONE_FIREFOX = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/140.0 Mobile/15E148 Safari/605.1.15";
const ANDROID_CHROME = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0 Mobile Safari/537.36";
const IPAD_DESKTOP_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15";

describe("install offer", () => {
  it("reads missing or broken storage as a fresh start", () => {
    expect(parseInstallState(null)).toEqual({ dismissed: 0, until: 0 });
    expect(parseInstallState("{oops")).toEqual({ dismissed: 0, until: 0 });
    expect(canOfferInstall(parseInstallState(null), Date.now())).toBe(true);
  });

  it("waits a week after 'not now' and gives up after the third time", () => {
    const now = 1_000_000;
    let state = dismissInstall(parseInstallState(null), now);
    expect(canOfferInstall(state, now + INSTALL_SNOOZE_MS - 1)).toBe(false);
    expect(canOfferInstall(state, now + INSTALL_SNOOZE_MS)).toBe(true);
    state = dismissInstall(dismissInstall(state, now), now);
    expect(state.dismissed).toBe(3);
    expect(canOfferInstall(state, now + 100 * INSTALL_SNOOZE_MS)).toBe(false);
    expect(parseInstallState(JSON.stringify(state))).toEqual(state);
  });

  it("never offers again once installed", () => {
    const state = markInstalled(parseInstallState(null));
    expect(canOfferInstall(parseInstallState(JSON.stringify(state)), Date.now())).toBe(false);
  });

  it("stays off sign-in, API and printable pages", () => {
    expect(installPromptHidden("/login")).toBe(true);
    expect(installPromptHidden("/api/notifications")).toBe(true);
    expect(installPromptHidden("/orders/12/act")).toBe(true);
    expect(installPromptHidden("/orders/12/invoice")).toBe(true);
    expect(installPromptHidden("/orders/12")).toBe(false);
    expect(installPromptHidden("/my")).toBe(false);
  });

  it("shows the Share hint in iOS Safari and Chrome, not in Firefox or in-app browsers", () => {
    expect(isIosSafari(IPHONE_SAFARI, "iPhone", 5)).toBe(true);
    expect(isIosSafari(IPAD_DESKTOP_UA, "MacIntel", 5)).toBe(true);
    expect(isIosSafari(IPAD_DESKTOP_UA, "MacIntel", 0)).toBe(false);
    expect(isIosSafari(IPHONE_CHROME, "iPhone", 5)).toBe(true);
    expect(isIosSafari(IPHONE_FIREFOX, "iPhone", 5)).toBe(false);
    expect(isIosSafari(ANDROID_CHROME, "Linux armv8l", 5)).toBe(false);
  });
});
