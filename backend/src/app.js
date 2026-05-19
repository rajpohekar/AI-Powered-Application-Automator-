/**
 * Job Autofill Assistant - Express API Gateway Entry Point
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// Global Middlewares
app.use(cors({
  origin: '*', // Allow extension popup requests
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Import Routes
const authRoutes = require('./routes/auth.routes');
const resumeRoutes = require('./routes/resume.routes');
const applicationRoutes = require('./routes/application.routes');

// Route Declarations
app.use('/api/auth', authRoutes);
app.use('/api/resumes', resumeRoutes);
app.use('/api/applications', applicationRoutes);

// Base health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'API Gateway is online' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Error stack:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Backend API Gateway running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});

module.exports = app;
