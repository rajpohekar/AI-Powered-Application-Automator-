/**
 * Job Autofill Assistant - End-to-End RAG Verification Test Script
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const GATEWAY_URL = 'http://localhost:5000';

async function verifyE2EFlow() {
  console.log("=== Job Autofill Assistant: E2E Verification starting ===");

  const randomSuffix = Math.floor(Math.random() * 10000);
  const email = `verified-candidate-${randomSuffix}@example.com`;
  const password = 'password123';

  let token = '';

  try {
    // 1. Register candidate
    console.log(`\nStep 1: Registering candidate: ${email}...`);
    const regRes = await axios.post(`${GATEWAY_URL}/api/auth/register`, {
      name: "Jane Doe Test",
      email,
      password
    });
    
    token = regRes.data.token;
    console.log(`✓ Candidate registered! JWT Token retrieved.`);

    // 2. Upload and Index candidate_resume.docx
    console.log(`\nStep 2: Uploading candidate_resume.docx for vector parsing...`);
    
    const form = new FormData();
    const resumePath = path.join(__dirname, 'candidate_resume.docx');
    
    if (!fs.existsSync(resumePath)) {
      throw new Error(`candidate_resume.docx not found at path: ${resumePath}`);
    }

    form.append('file', fs.createReadStream(resumePath));

    const uploadRes = await axios.post(`${GATEWAY_URL}/api/resumes/upload`, form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${token}`
      }
    });

    console.log(`✓ Resume uploaded and indexed!`);
    console.log(`  Collection Name: ${uploadRes.data.resume.qdrantCollectionName}`);

    // 3. Trigger Form Autofill semantic RAG generator
    console.log(`\nStep 3: Simulating Form Autofill RAG matching...`);
    
    const fieldsToFill = [
      {
        id: "full_name_input",
        name: "fullName",
        labelText: "Full Name",
        semanticLabel: "fullName",
        type: "text",
        placeholder: "Enter your full name"
      },
      {
        id: "email_address_field",
        name: "email",
        labelText: "Email Address",
        semanticLabel: "email",
        type: "email",
        placeholder: "you@example.com"
      },
      {
        id: "phone_number_box",
        name: "phone",
        labelText: "Mobile Phone",
        semanticLabel: "phone",
        type: "tel",
        placeholder: "+1-..."
      },
      {
        id: "github_url_box",
        name: "github",
        labelText: "GitHub profile URL",
        semanticLabel: "github",
        type: "url",
        placeholder: "https://github.com/..."
      },
      {
        id: "salary_requirements",
        name: "expected_salary",
        labelText: "What is your target/desired compensation?",
        semanticLabel: "salary",
        type: "text",
        placeholder: "$..."
      }
    ];

    const generateRes = await axios.post(`${GATEWAY_URL}/api/applications/generate-fill`, {
      fields: fieldsToFill,
      companyName: "TechCorp Inc.",
      jobTitle: "Senior Software Engineer",
      jobUrl: "https://techcorp.com/careers/senior-eng"
    }, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    console.log(`✓ RAG Generation Completed!`);
    console.log(`\n=== Semantically Matched Autofill Answers: ===`);
    console.log(JSON.stringify(generateRes.data.filledValues, null, 2));

    console.log(`\n=== Verification Status: SUCCESS ===`);

  } catch (error) {
    console.error(`\n❌ Verification Flow Failed!`);
    if (error.response) {
      console.error(`  Server Response:`, JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(`  Error message:`, error.message);
    }
  }
}

verifyE2EFlow();
