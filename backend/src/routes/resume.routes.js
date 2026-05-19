/**
 * Job Autofill Assistant - Resume Management Routes
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const { upload } = require('../services/file.service');
const aiProxyService = require('../services/ai-proxy.service');
const Resume = require('../models/Resume.model');
const User = require('../models/User.model');

/**
 * @route   POST /api/resumes/upload
 * @desc    Upload a resume file and trigger RAG vector indexing
 * @access  Private
 */
router.post('/upload', protect, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a file' });
    }

    const { filename, path: filepath, mimetype, size } = req.file;

    // 1. Save Resume Meta inside MongoDB
    const resume = await Resume.create({
      user: req.user._id,
      filename,
      filepath,
      mimetype,
      size
    });

    // 2. Trigger async background indexing in Python FastAPI AI Service
    let indexingResult;
    try {
      indexingResult = await aiProxyService.indexResume(req.user._id, filepath, filename);
      
      // Update resume document with parsing responses
      resume.parsedText = indexingResult.parsed_text || '';
      resume.qdrantCollectionName = indexingResult.collection_name || '';
      await resume.save();
    } catch (err) {
      // Clean up uploaded file and database entry if RAG fails
      console.error('RAG Indexing failure. Rolling back...');
      try {
        require('fs').unlinkSync(filepath);
      } catch (unlinkErr) {
        console.error('Could not clean up file:', filepath, unlinkErr.message);
      }
      await resume.deleteOne();
      return res.status(502).json({
        success: false,
        message: `Resume parsed indexing failed inside AI Service: ${err.message}`
      });
    }

    // 3. Link resume doc to current authenticated user
    await User.findByIdAndUpdate(req.user._id, { resume: resume._id });

    res.status(201).json({
      success: true,
      message: 'Resume uploaded and successfully indexed in Vector DB.',
      resume: {
        id: resume._id,
        filename: resume.filename,
        qdrantCollectionName: resume.qdrantCollectionName
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   GET /api/resumes/my-resume
 * @desc    Get currently attached resume metadata
 * @access  Private
 */
router.get('/my-resume', protect, async (req, res) => {
  try {
    const resume = await Resume.findOne({ user: req.user._id });
    if (!resume) {
      return res.status(404).json({ success: false, message: 'No resume found for this user.' });
    }
    res.json({ success: true, resume });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
