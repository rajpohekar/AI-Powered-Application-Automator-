/**
 * Job Autofill Assistant - Form Detector
 * Detects form containers, identifies interactive inputs, and coordinates 
 * form representation for transmission to the Extension Popup / Backend.
 */

class FormDetector {
  constructor() {
    this.interactiveSelectors = [
      "input[type='text']",
      "input[type='email']",
      "input[type='tel']",
      "input[type='url']",
      "input[type='number']",
      "input:not([type])", // Defaults to text
      "textarea",
      "select"
    ];
  }

  /**
   * Scans the DOM for potential job application forms.
   * Returns a structured list of detected forms and their inputs.
   */
  detectForms() {
    console.log("FormDetector scanning page...");
    const detectedForms = [];

    // Find all formal <form> tags or informal fieldsets/containers that contain multiple inputs
    const formContainers = Array.from(document.querySelectorAll("form, fieldset, [role='form']"));
    
    // Fallback: If no structured forms exist, check the body as a single page form
    if (formContainers.length === 0) {
      const inputs = this.extractFieldsFromContainer(document.body);
      if (inputs.length > 0) {
        detectedForms.push({
          id: "global-page-form",
          name: "Embedded Web Form",
          fields: inputs
        });
      }
      return detectedForms;
    }

    formContainers.forEach((container, index) => {
      const inputs = this.extractFieldsFromContainer(container);
      if (inputs.length > 0) {
        detectedForms.push({
          id: container.id || `form-detected-${index}`,
          name: container.getAttribute("name") || `Application Form #${index + 1}`,
          fields: inputs
        });
      }
    });

    return detectedForms;
  }

  /**
   * Grabs all relevant input elements from a specific DOM container.
   */
  extractFieldsFromContainer(container) {
    const fields = [];
    const elements = container.querySelectorAll(this.interactiveSelectors.join(", "));

    elements.forEach((element, index) => {
      // Avoid hidden inputs or standard structural elements
      if (element.type === "hidden" || element.style.display === "none" || element.style.visibility === "hidden") {
        return;
      }

      const inferredLabel = window.semanticExtractor ? window.semanticExtractor.extractSemanticLabel(element) : "unknown";
      const context = window.semanticExtractor ? window.semanticExtractor.getElementContext(element) : {};

      fields.push({
        id: element.id || `field-${index}`,
        name: element.name || `field_name_${index}`,
        type: element.tagName.toLowerCase() === "select" ? "select" : element.type || "text",
        placeholder: element.placeholder || "",
        labelText: context.labelText || "",
        semanticLabel: inferredLabel,
        // Keep DOM reference ID in storage or data attribute for injection mapping
        domSelector: this.generateCSSSelector(element)
      });
    });

    return fields;
  }

  /**
   * Helper to build a unique CSS selector for DOM targeting.
   */
  generateCSSSelector(el) {
    if (el.id) {
      return `#${el.id}`;
    }
    if (el === document.body) {
      return "body";
    }

    let path = [];
    while (el.parentNode) {
      let sibCount = 0;
      let sibIndex = 0;
      for (let i = 0; i < el.parentNode.childNodes.length; i++) {
        let sib = el.parentNode.childNodes[i];
        if (sib.nodeName === el.nodeName) {
          if (sib === el) {
            sibIndex = sibCount;
          }
          sibCount++;
        }
      }
      let nodeName = el.nodeName.toLowerCase();
      if (sibCount > 1) {
        path.unshift(`${nodeName}:nth-of-type(${sibIndex + 1})`);
      } else {
        path.unshift(nodeName);
      }
      el = el.parentNode;
    }
    return path.join(" > ");
  }
}

window.formDetector = new FormDetector();

// Handle messages from the extension popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SCAN_FORMS") {
    try {
      const forms = window.formDetector.detectForms();
      sendResponse({ success: true, forms: forms });
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
  }
  return true;
});
