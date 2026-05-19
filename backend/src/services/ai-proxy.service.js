/**
 * Job Autofill Assistant - AI Proxy Service
 * Communicates with the FastAPI Python microservice for embeddings, vectors, and text generation.
 */

const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

class AiProxyService {
  /**
   * Forwards user resume file details to Python FastAPI /embed endpoint for PDF parsing and vector insertion.
   */
  async indexResume(userId, filepath, filename) {
    try {
      const formData = new FormData();
      formData.append('file', fs.createReadStream(filepath), filename);
      formData.append('user_id', String(userId));

      const response = await axios.post(`${AI_SERVICE_URL}/api/embed`, formData, {
        headers: {
          ...formData.getHeaders()
        }
      });

      return response.data; // { success: true, collection: '...', parsed_text: '...' }
    } catch (error) {
      console.error('FastAPI embed proxy error:', error.message);
      throw new Error(`AI RAG ingestion failed: ${error.response?.data?.detail || error.message}`);
    }
  }

  /**
   * Contacts FastAPI /generate to fill in details.
   */
  async generateAutofillAnswers(userId, fields, customFields = {}) {
    try {
      const payload = {
        user_id: String(userId),
        fields: fields, // Array of { id, name, labelText, semanticLabel, type, placeholder }
        custom_fields: customFields
      };

      const response = await axios.post(`${AI_SERVICE_URL}/api/generate`, payload);
      return response.data; // { success: true, filledValues: { first_name: 'John', ... } }
    } catch (error) {
      console.error('FastAPI generation proxy error:', error.message);
      throw new Error(`AI RAG generation failed: ${error.response?.data?.detail || error.message}`);
    }
  }
}

module.exports = new AiProxyService();
