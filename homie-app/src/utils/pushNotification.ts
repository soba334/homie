const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from(rawData, (char) => char.charCodeAt(0));
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch (err) {
    console.error('SW registration failed:', err);
    return null;
  }
}

export async function subscribePush(
  registration: ServiceWorkerRegistration,
): Promise<PushSubscription | null> {
  if (!VAPID_PUBLIC_KEY) return null;
  try {
    return await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as Uint8Array<ArrayBuffer>,
    });
  } catch (err) {
    console.error('Push subscription failed:', err);
    return null;
  }
}

export async function unsubscribePush(
  registration: ServiceWorkerRegistration,
): Promise<boolean> {
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    return await subscription.unsubscribe();
  }
  return false;
}

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && !!VAPID_PUBLIC_KEY;
}

export async function getCurrentSubscription(
  registration: ServiceWorkerRegistration,
): Promise<PushSubscription | null> {
  return registration.pushManager.getSubscription();
}
