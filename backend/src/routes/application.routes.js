/**
 * Job Autofill Assistant - Application Management Routes
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const { apiLimiter } = require('../middlewares/ratelimit.middleware');
const aiProxyService = require('../services/ai-proxy.service');
const Application = require('../models/Application.model');
const User = require('../models/User.model');

/**
 * @route   POST /api/applications/generate-fill
 * @desc    Submit detected page fields to RAG service and compile answers
 * @access  Private
 */
router.post('/generate-fill', protect, apiLimiter, async (req, res) => {
  try {
    const { fields, companyName = 'Unknown Company', jobTitle = 'Unknown Role', jobUrl = '' } = req.body;

    if (!fields || !Array.isArray(fields) || fields.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide page fields to parse.' });
    }

    // Verify user has indexed a resume
    const user = await User.findById(req.user._id).populate('resume');
    if (!user.resume) {
      return res.status(400).json({ 
        success: false, 
        message: 'No active resume found. Please upload a resume before triggering AI autofill.' 
      });
    }

    // Convert Mongoose Map to a plain object
    const customFieldsObj = user.customFields ? Object.fromEntries(user.customFields) : {};

    // 1. Send data to RAG Service to match values contextually
    const response = await aiProxyService.generateAutofillAnswers(req.user._id, fields, customFieldsObj);

    // 2. Audit and persist the filled log in Application schema
    const filledFieldsLogs = fields.map(f => ({
      labelText: f.labelText || f.name,
      semanticLabel: f.semanticLabel,
      valueFilled: response.filledValues[f.id] || response.filledValues[f.name] || ''
    })).filter(log => log.valueFilled !== '');

    await Application.create({
      user: req.user._id,
      companyName,
      jobTitle,
      jobUrl,
      filledFields: filledFieldsLogs,
      status: 'draft'
    });

    // 3. Return mapped values
    res.json({
      success: true,
      filledValues: response.filledValues // key-value pairs of: { [field_id/field_name]: "value" }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   GET /api/applications/history
 * @desc    Fetch audit trails of autofill histories
 * @access  Private
 */
router.get('/history', protect, async (req, res) => {
  try {
    const history = await Application.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, count: history.length, history });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
