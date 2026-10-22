// ===================== Hub Partner — Web vs. native app =====================
//
// The same files run on the web and inside the Capacitor app shell (see
// capacitor.config.json). Native plugins are reached through Capacitor's core
// runtime, which only exists inside the app, so it is loaded lazily.
// Trimmed copy of gullysport/js/platform.js.

export const SITE_URL = "https://partner.gullysport.ibullinnovation.com";

export const isNativeApp = !!window.Capacitor?.isNativePlatform?.();

export const platform = isNativeApp ? window.Capacitor.getPlatform() : "web"; // "ios" | "android" | "web"

let corePromise = null;
const plugins = new Map();

// const { plugin } = await nativePlugin("FirebaseAppCheck")
// Wrapped in an object on purpose: Capacitor plugin proxies answer every
// property, `then` included, so awaiting one directly would call a native
// method named "then" instead of resolving.
export async function nativePlugin(name) {
  if (!isNativeApp) return { plugin: null };
  if (!plugins.has(name)) {
    corePromise ||= import("/vendor/capacitor/core.js");
    const { Capacitor, registerPlugin } = await corePromise;
    plugins.set(name, { plugin: Capacitor.isPluginAvailable(name) ? registerPlugin(name) : null });
  }
  return plugins.get(name);
}
