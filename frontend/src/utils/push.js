// utils/push.js — registers the service worker and subscribes the
// current device for background push notifications.
import { api } from "../api";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

/**
 * Call this from a user gesture (e.g. tapping "Enable Notifications" in
 * Settings, or right after login). Safe to call repeatedly — it no-ops
 * if already subscribed or if the browser doesn't support push.
 *
 * Note: push notifications are less reliable when testing in a plain
 * mobile browser tab (some Android browser/OS combinations restrict
 * background push delivery outside an installed PWA or native wrapper)
 * — this works most reliably once the app is installed to the home
 * screen or wrapped natively, which is worth keeping in mind during
 * browser-based testing specifically.
 */
export async function enablePushNotifications() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { success: false, message: "Push notifications aren't supported on this browser." };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { success: false, message: "Notification permission was not granted." };
    }

    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      await api("POST", "/notifications/subscribe", { subscription: existing.toJSON() });
      return { success: true, message: "Notifications already enabled." };
    }

    const { publicKey } = await api("GET", "/notifications/vapid-key");
    if (!publicKey) return { success: false, message: "Push isn't configured on the server yet." };

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    await api("POST", "/notifications/subscribe", { subscription: subscription.toJSON() });
    return { success: true, message: "Notifications enabled! 🔔" };
  } catch (err) {
    console.error("Push subscription failed:", err);
    return { success: false, message: "Couldn't enable notifications. Please try again." };
  }
}

export async function disablePushNotifications() {
  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      const sub = await registration?.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
    }
  } catch (err) {
    console.error("Push unsubscribe failed:", err);
  }
}