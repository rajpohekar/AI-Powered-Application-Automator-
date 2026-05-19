/**
 * Job Autofill Assistant - Background Service Worker
 * Coordinates background requests, API proxying, and token storage.
 */

// Import message bus utilities if applicable or rely on chrome.runtime messages
chrome.runtime.onInstalled.addListener(() => {
  console.log("Job Autofill Assistant Extension successfully installed.");
  // Initialize default state
  chrome.storage.local.set({
    autoScanEnabled: true,
    serverUrl: "http://localhost:5000",
    isAuthenticated: false,
    authToken: null,
    userProfile: null
  });
});

// Listener for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background service worker received message:", message);

  if (message.type === "API_REQUEST") {
    handleApiRequest(message.payload)
      .then(response => sendResponse({ success: true, data: response }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep message channel open for async response
  }

  if (message.type === "GET_SESSION") {
    chrome.storage.local.get(["isAuthenticated", "authToken", "userProfile", "serverUrl"], (data) => {
      sendResponse(data);
    });
    return true;
  }

  if (message.type === "SET_SESSION") {
    chrome.storage.local.set(message.payload, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});

/**
 * Robust async HTTP request helper to communicate with the Node.js Backend Gateway
 */
async function handleApiRequest({ endpoint, method = "GET", body = null, headers = {} }) {
  const { serverUrl, authToken } = await chrome.storage.local.get(["serverUrl", "authToken"]);
  const url = `${serverUrl}${endpoint}`;

  const requestHeaders = {
    "Content-Type": "application/json",
    ...headers
  };

  if (authToken) {
    requestHeaders["Authorization"] = `Bearer ${authToken}`;
  }

  const options = {
    method,
    headers: requestHeaders
  };

  if (body && method !== "GET" && method !== "HEAD") {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: "Unknown API error" }));
    throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
  }

  return await response.json();
}
