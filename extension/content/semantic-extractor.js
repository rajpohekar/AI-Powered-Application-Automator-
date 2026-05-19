/**
 * Job Autofill Assistant - Semantic Extractor
 * Traverses contextual labels, aria attributes, placeholder texts, 
 * and input names to understand the semantic intent of input elements.
 */

class SemanticExtractor {
  constructor() {
    // Standard semantic field mappings to look for
    this.semanticFields = {
      firstName: [/first\s*name/i, /given\s*name/i, /^fname$/i],
      lastName: [/last\s*name/i, /family\s*name/i, /^lname$/i, /surname/i],
      fullName: [/full\s*name/i, /^name$/i, /candidate\s*name/i, /applicant\s*name/i, /your\s*name/i],
      email: [/email/i, /e-mail/i, /^mail$/i],
      phone: [/phone/i, /telephone/i, /mobile/i, /cell\s*number/i, /^tel$/i, /contact/i, /contact\s*number/i, /contact\s*no/i],
      registrationId: [/prn/i, /registration\s*id/i, /registration\s*number/i, /roll\s*number/i, /roll\s*no/i, /student\s*id/i, /enrollment/i],
      resume: [/resume/i, /cv/i, /curriculum\s*vitae/i, /upload/i],
      coverLetter: [/cover\s*letter/i, /attachment/i],
      github: [/github/i, /git/i],
      linkedin: [/linkedin/i, /linked\s*in/i],
      portfolio: [/portfolio/i, /website/i, /personal\s*site/i],
      salary: [/salary/i, /compensation/i, /expected\s*pay/i],
      experience: [/experience/i, /years\s*of/i, /history/i],
      education: [/education/i, /degree/i, /school/i, /university/i],
      address: [/address/i, /street/i, /location/i],
      city: [/city/i],
      state: [/state/i, /province/i],
      zip: [/zip/i, /postal\s*code/i],
      country: [/country/i]
    };
  }

  /**
   * Scans a target input/select/textarea element and returns its inferred semantic label.
   */
  extractSemanticLabel(element) {
    const context = this.getElementContext(element);
    
    // Evaluate matching regexes
    for (const [fieldName, patterns] of Object.entries(this.semanticFields)) {
      for (const pattern of patterns) {
        if (
          pattern.test(context.id) ||
          pattern.test(context.name) ||
          pattern.test(context.placeholder) ||
          pattern.test(context.ariaLabel) ||
          pattern.test(context.labelText)
        ) {
          return fieldName;
        }
      }
    }
    
    return "unknown";
  }

  /**
   * Aggregates various string contexts associated with a DOM element.
   */
  getElementContext(element) {
    const id = element.id || "";
    const name = element.name || "";
    const placeholder = element.placeholder || element.getAttribute("placeholder") || "";
    const ariaLabel = element.getAttribute("aria-label") || "";
    
    // Find associated label tag
    let labelText = "";
    
    // Check aria-labelledby mapping (extremely common in Google Forms and standard UI frameworks)
    if (element.getAttribute("aria-labelledby")) {
      const ids = element.getAttribute("aria-labelledby").split(/\s+/).filter(Boolean);
      const labelParts = [];
      ids.forEach(idVal => {
        const labelledEl = document.getElementById(idVal);
        if (labelledEl && labelledEl.textContent) {
          labelParts.push(labelledEl.textContent.trim());
        }
      });
      if (labelParts.length > 0) {
        labelText = labelParts.join(" ");
      }
    }

    // Check aria-describedby mapping for descriptions/examples
    if (element.getAttribute("aria-describedby")) {
      const descIds = element.getAttribute("aria-describedby").split(/\s+/).filter(Boolean);
      const descParts = [];
      descIds.forEach(idVal => {
        const descEl = document.getElementById(idVal);
        if (descEl && descEl.textContent) {
          descParts.push(descEl.textContent.trim());
        }
      });
      if (descParts.length > 0) {
        if (labelText) {
          labelText += " " + descParts.join(" ");
        } else {
          labelText = descParts.join(" ");
        }
      }
    }

    // Check for explicit label with 'for' attribute
    if (!labelText && id) {
      const explicitLabel = document.querySelector(`label[for="${id}"]`);
      if (explicitLabel) {
        labelText = explicitLabel.textContent;
      }
    }
    
    // Check for implicit label as a parent
    if (!labelText) {
      const implicitLabel = element.closest("label");
      if (implicitLabel) {
        labelText = implicitLabel.textContent;
      }
    }

    // Check sibling text content if no label is found yet
    if (!labelText && element.previousElementSibling) {
      labelText = element.previousElementSibling.textContent;
    }

    // Google Forms & generic custom form frameworks label traversing
    if (!labelText) {
      let parent = element.parentElement;
      let depth = 0;
      while (parent && parent !== document.body && depth < 5) {
        // Check for Google Forms question header components
        const googleHeader = parent.querySelector('[role="heading"], .F3eFcc, .hoXoCc, .vR137c, .exportLabel');
        if (googleHeader && googleHeader.textContent) {
          labelText = googleHeader.textContent;
          break;
        }
        parent = parent.parentElement;
        depth++;
      }
    }

    return {
      id: id.trim(),
      name: name.trim(),
      placeholder: placeholder.trim(),
      ariaLabel: ariaLabel.trim(),
      labelText: labelText.trim().replace(/\s+/g, " ")
    };
  }
}

// Attach extractor to global window scope
window.semanticExtractor = new SemanticExtractor();
