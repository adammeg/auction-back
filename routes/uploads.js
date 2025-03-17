const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const auth = require('../middleware/auth');
const fs = require('fs');
const path = require('path');
const { asyncHandler, errorResponse } = require('../utils/errorHandler');

// Upload multiple images
router.post('/images', auth, upload.array('images', 5), asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return errorResponse(res, 400, 'No files uploaded');
  }

  // Create array of image URLs
  const imageUrls = req.files.map(file => `/uploads/${file.filename}`);
  
  res.status(201).json({ 
    success: true,
    message: 'Files uploaded successfully',
    data: {
      images: imageUrls
    }
  });
}));

// Delete an image
router.delete('/images/:filename', auth, asyncHandler(async (req, res) => {
  const filename = req.params.filename;
  const filepath = path.join(__dirname, '../public/uploads', filename);
  
  // Check if file exists
  if (fs.existsSync(filepath)) {
    // Delete file
    fs.unlinkSync(filepath);
    res.json({ 
      success: true,
      message: 'File deleted successfully' 
    });
  } else {
    return errorResponse(res, 404, 'File not found');
  }
}));

module.exports = router; 