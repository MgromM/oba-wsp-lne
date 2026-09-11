// Minimal service worker — exists only so the browser considers this an installable PWA.
// Also loads the OneSignal push worker so both live under one registration at the root scope.
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
self.addEventListener('fetch', () => {});
