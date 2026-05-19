import os
import json
import re
from typing import List, Dict, Any
from openai import OpenAI

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

class AutofillGenerator:
    def __init__(self):
        if OPENAI_API_KEY and not OPENAI_API_KEY.startswith("your_"):
            self.client = OpenAI(api_key=OPENAI_API_KEY)
            self.use_mock = False
        else:
            print("WARNING: OpenAI API Key missing or invalid. Falling back to heuristic-based answer generator.")
            self.client = None
            self.use_mock = True
            
        self.model = "gpt-3.5-turbo" # Or "gpt-4o" for ultra premium capability

    def generate_fill_values(self, fields: List[Dict[str, Any]], resume_chunks: List[Dict[str, Any]], custom_fields: Dict[str, str] = None) -> Dict[str, str]:
        """
        Combines the scanned form fields context, custom fields, and retrieved resume texts, 
        and instructs an LLM to generate the ideal matching answers.
        """
        # Combine retrieved document context
        context_str = "\n---\n".join([chunk["content"] for chunk in resume_chunks])

        if self.use_mock:
            return self._heuristic_fallback_fill(fields, context_str, custom_fields)

        # Build highly structured prompt
        system_instruction = (
            "You are an expert job application autofill agent. "
            "Your task is to review the provided context from a user's resume and any custom field profile data, "
            "and output a single, flat JSON object containing the most logical and contextually accurate "
            "values to fill into the listed job application form fields.\n\n"
            "Prioritize the candidate's custom field profile data for fields like grades, test scores, "
            "registration IDs, percentages, or custom questions if they exist in the custom fields.\n\n"
            "Return ONLY a clean, parseable JSON object with keys matching each field's 'id' "
            "or 'name' and values representing the answers. Do not include markdown wraps or surrounding text. "
            "Ensure values align with formatting standards (e.g., phone numbers as '+1234567890', "
            "emails valid, and matching dropdown options exactly when option lists are hinted)."
        )

        user_prompt = f"""
Candidate's Resume Context:
{context_str}

Candidate's Custom Field Profile Data:
{json.dumps(custom_fields, indent=2) if custom_fields else "{}"}

Form Fields to fill:
{json.dumps(fields, indent=2)}

Please generate and output the JSON mapping matching field keys:
"""

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_instruction},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.1,
                response_format={"type": "json_object"}
            )
            
            output_content = response.choices[0].message.content
            return json.loads(output_content)
            
        except Exception as e:
            print(f"Error executing OpenAI LLM generation: {str(e)}. Falling back to heuristic extractor.")
            return self._heuristic_fallback_fill(fields, context_str, custom_fields)

    def _heuristic_fallback_fill(self, fields: List[Dict[str, Any]], resume_text: str, custom_fields: Dict[str, str] = None) -> Dict[str, str]:
        """
        Intelligent local fallback analyzer. 
        Extracts values directly from the resume context using advanced regex rules.
        """
        filled_map = {}
        
        # 1. Advanced Name Extraction
        # Look for the first occurrence of two capitalized words (often the candidate's name)
        name_match = re.search(r'\b([A-Z][a-z]+)\s+([A-Z][a-z]+)\b', resume_text)
        if name_match:
            first_name = name_match.group(1)
            last_name = name_match.group(2)
        else:
            first_name = "Raj"
            last_name = "Pohekar"
            
        # 2. Advanced Phone / Contact Extraction (including international/Indian formats)
        # Search for Indian format mobile (10 digits starting with 6-9, optional +91 prefix) or US format
        phone_match = re.search(r'(?:\+91|91)?[-.\s]?([6789]\d{9})\b', resume_text)
        if not phone_match:
            phone_match = re.search(r'\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}', resume_text)
        
        phone_val = ""
        if phone_match:
            phone_val = phone_match.group(0)
            if not phone_val.startswith("+") and len(phone_val) == 10:
                phone_val = "+91-" + phone_val
        else:
            broad_phone = re.search(r'phone\+?([\d-]+)', resume_text, re.IGNORECASE)
            if broad_phone:
                phone_val = "+" + broad_phone.group(1)
            else:
                phone_val = "+91-9175622103"

        # 3. Email Extraction
        email_match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', resume_text)
        email_val = email_match.group(0) if email_match else "rajpohekar21@gmail.com"

        # 4. Social Profiles Extraction
        github_match = re.search(r'github\.com/([\w\.-]+)', resume_text, re.IGNORECASE)
        github_val = f"https://github.com/{github_match.group(1)}" if github_match else "https://github.com/rajpohekar"
        
        linkedin_match = re.search(r'linkedin\.com/in/([\w\.-]+)', resume_text, re.IGNORECASE)
        linkedin_val = f"https://linkedin.com/in/{linkedin_match.group(1)}" if linkedin_match else "https://linkedin.com/in/raj-pohekar"

        # Loop through each field to map values
        for field in fields:
            label = field.get("semanticLabel", "unknown").lower()
            fid = field.get("id", "").lower()
            fname = field.get("name", "").lower()
            labelText = field.get("labelText", "")
            placeholder = field.get("placeholder", "")
            key = field.get("id") or field.get("name")

            # Filter out auto-generated default IDs and names from heuristic matching
            match_fid = "" if fid.startswith("field-") else fid
            match_fname = "" if fname.startswith("field_name_") else fname

            # Check if this field matches any user-defined custom fields first
            matched_custom = False
            if custom_fields:
                for custom_key, custom_val in custom_fields.items():
                    ck_lower = custom_key.lower()
                    # Split into words, retaining significant words (len > 2) and common abbreviations like 'reg' / 'pct'
                    words = [w.strip() for w in re.split(r'[^a-zA-Z0-9]', ck_lower) if len(w.strip()) > 2 or w.strip() in ["reg", "pct"]]
                    if (ck_lower in match_fid or 
                        ck_lower in match_fname or 
                        ck_lower in labelText.lower() or 
                        ck_lower in label or
                        (words and all(any(word in f_word for f_word in re.split(r'[^a-zA-Z0-9]', labelText.lower() + " " + match_fid + " " + match_fname + " " + label)) for word in words))):
                        filled_map[key] = custom_val
                        matched_custom = True
                        break
            
            if matched_custom:
                continue

            # Try to extract an example value from the label text or placeholder first
            # e.g., "Ex: 72224546H" or "Ex:- C2K2323" or "Ex: 9373295568"
            example_match = re.search(r'(?:ex|example|eg|e\.g\.)[\s:-]+([A-Za-z0-9+-]+)', labelText + " " + placeholder, re.IGNORECASE)
            example_val = example_match.group(1) if example_match else None

            # Check if this field is a custom registration, roll no, or PRN
            is_id_field = label == "registrationid" or any(x in match_fid or x in match_fname or x in labelText.lower() for x in ["prn", "registration", "roll", "student", "urn"])

            if is_id_field:
                if example_val:
                    filled_map[key] = example_val
                else:
                    filled_map[key] = "72224546H"
                continue

            # Check if this field is for Phone/Contact
            is_phone_field = label == "phone" or any(x in match_fid or x in match_fname or x in labelText.lower() for x in ["phone", "contact", "mobile", "tel"])
            
            if is_phone_field:
                filled_map[key] = phone_val
                continue

            # Standard semantic mappings
            if label == "firstname" or "first" in match_fid or "first" in match_fname:
                filled_map[key] = first_name
            elif label == "lastname" or "last" in match_fid or "last" in match_fname:
                filled_map[key] = last_name
            elif label == "fullname" or "name" in match_fid or "name" in match_fname or "name" in labelText.lower():
                filled_map[key] = f"{first_name} {last_name}"
            elif label == "email" or "email" in match_fid or "email" in match_fname:
                filled_map[key] = email_val
            elif label == "github" or "github" in match_fid or "github" in match_fname:
                filled_map[key] = github_val
            elif label == "linkedin" or "linkedin" in match_fid or "linkedin" in match_fname:
                filled_map[key] = linkedin_val
            elif label == "salary" or "salary" in match_fid or "salary" in match_fname:
                filled_map[key] = "$120,000"
            elif label == "city" or "city" in match_fid or "city" in match_fname:
                filled_map[key] = "Pune"
            elif label == "state" or "state" in match_fid or "state" in match_fname:
                filled_map[key] = "Maharashtra"
            elif label == "zip" or "zip" in match_fid or "zip" in match_fname:
                filled_map[key] = "411043"
            elif label == "country" or "country" in match_fid or "country" in match_fname:
                filled_map[key] = "India"
            else:
                # Use example if found, else default to name or keyword search in resume
                if example_val:
                    filled_map[key] = example_val
                elif field.get("type") == "email":
                    filled_map[key] = email_val
                else:
                    words = [w for w in re.findall(r'\w+', labelText) if len(w) > 3 and w.lower() not in ["field", "form", "text", "please", "input"]]
                    found = False
                    if words:
                        for word in words:
                            sentence_match = re.search(rf'([^.\n]*{word}[^.\n]*)', resume_text, re.IGNORECASE)
                            if sentence_match:
                                filled_map[key] = sentence_match.group(1).strip()
                                found = True
                                break
                    if not found:
                        filled_map[key] = f"{first_name} {last_name}"

        return filled_map
