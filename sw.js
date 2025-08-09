// Service Worker for sync-message library
// Based on pyodide-worker-runner implementation

console.log('Service worker starting...');

// Import sync-message using importScripts
try {
  importScripts('./node_modules/sync-message/dist/index.js');
  console.log('sync-message imported successfully');
} catch (error) {
  console.error('Failed to import sync-message:', error);
  // Try alternative path
  try {
    importScripts('/node_modules/sync-message/dist/index.js');
    console.log('sync-message imported from root path');
  } catch (error2) {
    console.error('Failed to import sync-message from root path:', error2);
  }
}

// Get the fetch listener from sync-message
let fetchListener;
try {
  fetchListener = self.syncMessage.serviceWorkerFetchListener();
  console.log('Service worker fetch listener created');
} catch (error) {
  console.error('Failed to create fetch listener:', error);
}

// Handle fetch events for sync-message communication
addEventListener("fetch", function (e) {
  if (fetchListener && fetchListener(e)) {
    return;
  }
  e.respondWith(fetch(e.request));
});

// Install event - skip waiting to activate immediately
addEventListener("install", function (e) {
  console.log('Service worker installing...');
  e.waitUntil(self.skipWaiting());
});

// Activate event - claim all clients immediately
addEventListener("activate", function (e) {
  console.log('Service worker activating...');
  e.waitUntil(self.clients.claim());
});

console.log('Service worker for sync-message loaded');