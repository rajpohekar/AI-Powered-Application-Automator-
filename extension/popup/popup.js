/**
 * Job Autofill Assistant - Popup Controller
 * Orchestrates login flows, scanning pages, active tabs communication, 
 * and calling the AI RAG autofill API.
 */

document.addEventListener("DOMContentLoaded", async () => {
  // Elements
  const statusBadge = document.getElementById("status-badge");
  const authScreen = document.getElementById("auth-screen");
  const dashboardScreen = document.getElementById("dashboard-screen");
  
  // Login Form elements
  const loginForm = document.getElementById("login-form");
  const emailInput = document.getElementById("email-input");
  const passwordInput = document.getElementById("password-input");
  const serverUrlInput = document.getElementById("server-url-input");
  
  // Dashboard Elements
  const userName = document.getElementById("user-name");
  const userEmail = document.getElementById("user-email");
  const btnLogout = document.getElementById("btn-logout");
  const resumeFilename = document.getElementById("resume-filename");
  const btnUploadDirect = document.getElementById("btn-upload-direct");
  const btnScan = document.getElementById("btn-scan");
  
  // Loader & Results
  const scannerLoader = document.getElementById("scanner-loader");
  const scanResultsContainer = document.getElementById("scan-results-container");
  const fieldCount = document.getElementById("field-count");
  const fieldList = document.getElementById("field-list");
  const btnAutofill = document.getElementById("btn-autofill");
  const btnRefill = document.getElementById("btn-refill");

  let detectedForms = [];
  let serverUrl = "http://localhost:5000";

  /**
   * Helper to send messages to the active tab's content scripts, 
   * automatically injecting the scripts if they are not yet loaded.
   */
  async function safeSendToTab(tabId, type, payload = {}) {
    try {
      return await MessageBus.sendToTab(tabId, type, payload);
    } catch (err) {
      if (err.message.includes("Could not establish connection") || err.message.includes("Receiving end does not exist")) {
        console.log("Content scripts not loaded in active tab. Programmatically injecting...");
        try {
          await chrome.scripting.executeScript({
            target: { tabId },
            files: [
              "utils/message-bus.js",
              "content/semantic-extractor.js",
              "content/form-detector.js",
              "content/autofill-injector.js"
            ]
          });
          // Wait a brief moment for the scripts to initialize
          await new Promise(resolve => setTimeout(resolve, 150));
          return await MessageBus.sendToTab(tabId, type, payload);
        } catch (injectErr) {
          throw new Error(`Failed to inject content scripts: ${injectErr.message}. Please refresh the page and try again.`);
        }
      }
      throw err;
    }
  }

  // Initialize
  await checkSession();

  // Handle Server URL Change
  serverUrlInput.addEventListener("input", (e) => {
    serverUrl = e.target.value;
    chrome.storage.local.set({ serverUrl });
  });

  // Login handler
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = emailInput.value;
    const password = passwordInput.value;

    try {
      showLoading(true, "Authenticating...");
      
      const response = await MessageBus.sendToBackground("API_REQUEST", {
        endpoint: "/api/auth/login",
        method: "POST",
        body: { email, password }
      });

      // Save credentials & state
      await MessageBus.sendToBackground("SET_SESSION", {
        isAuthenticated: true,
        authToken: response.token,
        userProfile: response.user,
        serverUrl: serverUrl
      });

      await checkSession();
    } catch (err) {
      alert(`Login failed: ${err.message}`);
    } finally {
      showLoading(false);
    }
  });

  // Logout handler
  btnLogout.addEventListener("click", async () => {
    await MessageBus.sendToBackground("SET_SESSION", {
      isAuthenticated: false,
      authToken: null,
      userProfile: null
    });
    await checkSession();
  });

  // Form scanning trigger
  btnScan.addEventListener("click", async () => {
    try {
      scanResultsContainer.style.display = "none";
      scannerLoader.style.display = "flex";

      const activeTab = await MessageBus.getActiveTab();
      if (!activeTab) {
        throw new Error("No active tab found.");
      }

      // Send scan message to tab
      const response = await safeSendToTab(activeTab.id, "SCAN_FORMS");
      if (response && response.success) {
        detectedForms = response.forms;
        renderDetectedFields();
      } else {
        alert(response?.error || "Failed to scan forms.");
      }
    } catch (err) {
      alert(`Scanning Error: ${err.message}`);
    } finally {
      scannerLoader.style.display = "none";
    }
  });

  // Clear Results
  btnRefill.addEventListener("click", () => {
    detectedForms = [];
    scanResultsContainer.style.display = "none";
    fieldList.innerHTML = "";
  });

  // Autofill RAG Generation Trigger
  btnAutofill.addEventListener("click", async () => {
    if (!detectedForms || detectedForms.length === 0) return;

    try {
      btnAutofill.disabled = true;
      btnAutofill.textContent = "AI generating answers...";

      // Standardize form payload for back-end
      const activeForm = detectedForms[0]; // Process first detected form group for now
      const fields = activeForm.fields.map(f => ({
        id: f.id,
        name: f.name,
        labelText: f.labelText,
        semanticLabel: f.semanticLabel,
        type: f.type,
        placeholder: f.placeholder
      }));

      // Contact API Gateway to perform RAG generate
      const response = await MessageBus.sendToBackground("API_REQUEST", {
        endpoint: "/api/applications/generate-fill",
        method: "POST",
        body: { fields }
      });

      // Prepare target array: { domSelector, value }
      const fieldsToInject = activeForm.fields.map(f => {
        const generatedVal = response.filledValues[f.id] || response.filledValues[f.name] || "";
        return {
          domSelector: f.domSelector,
          value: generatedVal
        };
      }).filter(item => item.value !== "");

      // Execute DOM injection
      const activeTab = await MessageBus.getActiveTab();
      const injectResponse = await safeSendToTab(activeTab.id, "INJECT_VALUES", fieldsToInject);
      
      if (injectResponse && injectResponse.success) {
        alert(`Successfully auto-filled ${injectResponse.result.successCount} fields!`);
      } else {
        alert(injectResponse?.error || "Autofill injection encountered a problem.");
      }

    } catch (err) {
      alert(`AI Autofill Error: ${err.message}`);
    } finally {
      btnAutofill.disabled = false;
      btnAutofill.innerHTML = `<span>Autofill with AI RAG</span><span class="btn-sparkle">✨</span>`;
    }
  });

  // Direct upload navigation helper
  btnUploadDirect.addEventListener("click", () => {
    chrome.tabs.create({ url: `${serverUrl}/dashboard` });
  });

  /**
   * Evaluates local session and routes UI displays
   */
  async function checkSession() {
    const session = await MessageBus.sendToBackground("GET_SESSION");
    
    if (session && session.serverUrl) {
      serverUrl = session.serverUrl;
      serverUrlInput.value = serverUrl;
    }

    if (session && session.isAuthenticated && session.userProfile) {
      statusBadge.textContent = "Connected";
      statusBadge.classList.add("connected");
      
      authScreen.classList.remove("active");
      dashboardScreen.classList.add("active");
      
      userName.textContent = session.userProfile.name || "User";
      userEmail.textContent = session.userProfile.email || "";
      
      // Update Resume details if backend user model has a resume
      if (session.userProfile.resume) {
        resumeFilename.textContent = session.userProfile.resume.filename || "Resume Attached";
      } else {
        resumeFilename.textContent = "No resume uploaded";
      }
    } else {
      statusBadge.textContent = "Disconnected";
      statusBadge.classList.remove("connected");
      
      dashboardScreen.classList.remove("active");
      authScreen.classList.add("active");
    }
  }

  /**
   * Helper to display field items scanned
   */
  function renderDetectedFields() {
    fieldList.innerHTML = "";
    if (detectedForms.length === 0) {
      scanResultsContainer.style.display = "none";
      alert("No fields detected on this page.");
      return;
    }

    const firstForm = detectedForms[0];
    fieldCount.textContent = firstForm.fields.length;
    
    firstForm.fields.forEach(field => {
      const fieldItem = document.createElement("div");
      fieldItem.className = "field-item";
      
      fieldItem.innerHTML = `
        <div class="field-meta">
          <span class="field-label-text">${field.labelText || field.placeholder || field.name}</span>
          <span class="field-selector-sub">${field.id}</span>
        </div>
        <span class="field-tag">${field.semanticLabel}</span>
      `;
      
      fieldList.appendChild(fieldItem);
    });

    // Detect if content scripts are running older version lacking ARIA labels
    const hasUnlabeledFields = firstForm.fields.some(field => !field.labelText && field.name.startsWith("field_name_"));
    if (hasUnlabeledFields) {
      const warningItem = document.createElement("div");
      warningItem.className = "field-item warning-banner";
      warningItem.style.background = "rgba(245, 158, 11, 0.08)";
      warningItem.style.border = "1px dashed #f59e0b";
      warningItem.style.borderRadius = "8px";
      warningItem.style.padding = "10px";
      warningItem.style.marginTop = "12px";
      warningItem.style.color = "#fbbf24";
      warningItem.style.fontSize = "11px";
      warningItem.style.textAlign = "center";
      warningItem.style.lineHeight = "1.5";
      warningItem.innerHTML = `
        ⚠️ <strong>Google Form / Sandbox detected!</strong><br/>
        Please <strong>refresh your browser tab</strong> to apply the newly upgraded context-aware scanner.
      `;
      fieldList.appendChild(warningItem);
    }

    scanResultsContainer.style.display = "block";
  }

  function showLoading(show, text = "Loading...") {
    const btn = document.getElementById("btn-login");
    if (show) {
      btn.disabled = true;
      btn.innerHTML = `<span>${text}</span>`;
    } else {
      btn.disabled = false;
      btn.innerHTML = `<span>Unlock Extension</span><span class="btn-arrow">→</span>`;
    }
  }
});
