/**
 * Job Autofill Assistant - Autofill Injector
 * Safely injects structured data into input fields, simulating user input 
 * events to guarantee form validation states in modern frameworks (React, Vue, Angular).
 */

class AutofillInjector {
  /**
   * Automatically fills a list of fields in the page using CSS selectors.
   * @param {Array} fieldsToFill - Array of objects like { domSelector, value }
   */
  injectValues(fieldsToFill) {
    console.log("AutofillInjector starting injection for", fieldsToFill.length, "fields...");
    let successCount = 0;

    fieldsToFill.forEach(({ domSelector, value }) => {
      const element = document.querySelector(domSelector);
      if (!element) {
        console.warn(`Could not find element with selector: ${domSelector}`);
        return;
      }

      try {
        this.fillElement(element, value);
        successCount++;
      } catch (err) {
        console.error(`Failed to inject into: ${domSelector}`, err);
      }
    });

    console.log(`Successfully auto-filled ${successCount}/${fieldsToFill.length} elements.`);
    return { successCount, totalCount: fieldsToFill.length };
  }

  /**
   * Contextually handles different HTML input elements.
   */
  fillElement(element, value) {
    const tagName = element.tagName.toLowerCase();
    
    if (tagName === "input") {
      const type = element.type ? element.type.toLowerCase() : "text";
      
      if (type === "checkbox" || type === "radio") {
        const shouldCheck = String(value).toLowerCase() === "true" || value === true || value === 1;
        if (element.checked !== shouldCheck) {
          element.checked = shouldCheck;
          this.dispatchEvents(element);
        }
      } else {
        element.value = value;
        this.dispatchEvents(element);
      }
    } else if (tagName === "textarea") {
      element.value = value;
      this.dispatchEvents(element);
    } else if (tagName === "select") {
      this.fillSelectElement(element, value);
    }
  }

  /**
   * Matches select dropdown values carefully by value or text context.
   */
  fillSelectElement(select, value) {
    const queryValue = String(value).toLowerCase().trim();
    let matchedOption = null;

    // First attempt: Exact match by option value
    for (let i = 0; i < select.options.length; i++) {
      if (select.options[i].value.toLowerCase().trim() === queryValue) {
        matchedOption = select.options[i];
        break;
      }
    }

    // Second attempt: Partial match by option innerText/text
    if (!matchedOption) {
      for (let i = 0; i < select.options.length; i++) {
        const optionText = select.options[i].text.toLowerCase().trim();
        if (optionText.includes(queryValue) || queryValue.includes(optionText)) {
          matchedOption = select.options[i];
          break;
        }
      }
    }

    if (matchedOption) {
      select.value = matchedOption.value;
      this.dispatchEvents(select);
    } else {
      console.warn(`Dropdown option matching value '${value}' not found in`, select);
    }
  }

  /**
   * Triggers necessary event bubbles to let front-end frameworks know values changed.
   */
  dispatchEvents(element) {
    // 1. Focus the element
    element.focus();

    // 2. Dispatch Input event (critical for modern UI frameworks like React/Vue)
    const inputEvent = new Event("input", { bubbles: true, cancelable: true });
    element.dispatchEvent(inputEvent);

    // 3. Dispatch Change event
    const changeEvent = new Event("change", { bubbles: true, cancelable: true });
    element.dispatchEvent(changeEvent);

    // 4. Blur the element to finalize
    element.blur();
  }
}

window.autofillInjector = new AutofillInjector();

// Handle messages from the extension popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "INJECT_VALUES") {
    try {
      const result = window.autofillInjector.injectValues(message.payload);
      sendResponse({ success: true, result });
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
  }
  return true;
});
