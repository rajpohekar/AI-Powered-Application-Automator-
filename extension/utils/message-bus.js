/**
 * Job Autofill Assistant - Typed Message Bus
 * Standardizes communication between Content Scripts, Popups, and the Service Worker.
 */

const MessageBus = {
  /**
   * Sends a typed message to the background service worker.
   * @param {string} type - Message identifier (e.g. 'API_REQUEST')
   * @param {any} payload - Message data
   * @returns {Promise<any>}
   */
  sendToBackground(type, payload = {}) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type, payload }, (response) => {
        if (chrome.runtime.lastError) {
          return reject(new Error(chrome.runtime.lastError.message));
        }
        if (response && response.success === false) {
          return reject(new Error(response.error || "Unknown background error"));
        }
        resolve(response ? response.data || response : null);
      });
    });
  },

  /**
   * Sends a typed message to a specific active browser tab's content scripts.
   * @param {number} tabId - Target tab ID
   * @param {string} type - Message identifier
   * @param {any} payload - Message data
   * @returns {Promise<any>}
   */
  sendToTab(tabId, type, payload = {}) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, { type, payload }, (response) => {
        if (chrome.runtime.lastError) {
          return reject(new Error(chrome.runtime.lastError.message));
        }
        if (response && response.success === false) {
          return reject(new Error(response.error || "Unknown content script error"));
        }
        resolve(response);
      });
    });
  },

  /**
   * Helper to query the current active tab.
   * @returns {Promise<chrome.tabs.Tab>}
   */
  async getActiveTab() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0];
  }
};

// Export to window/global context
if (typeof window !== "undefined") {
  window.MessageBus = MessageBus;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = MessageBus;
}
