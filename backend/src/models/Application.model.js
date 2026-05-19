/**
 * Job Autofill Assistant - Application Tracking Model
 */

const mongoose = require('mongoose');

const FilledFieldSchema = new mongoose.Schema({
  labelText: String,
  semanticLabel: String,
  valueFilled: String,
  dateFilled: {
    type: Date,
    default: Date.now
  }
});

const ApplicationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  companyName: {
    type: String,
    required: true,
    trim: true
  },
  jobTitle: {
    type: String,
    required: true,
    trim: true
  },
  jobUrl: {
    type: String,
    default: ''
  },
  filledFields: [FilledFieldSchema],
  status: {
    type: String,
    enum: ['draft', 'submitted', 'interviewing', 'offered', 'rejected'],
    default: 'draft'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Application', ApplicationSchema);
