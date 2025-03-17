/**
 * Centralized error handling utility
 */

// Custom error response function
const errorResponse = (res, statusCode, message, errors = null) => {
  const response = {
    success: false,
    message
  };
  
  if (errors) {
    response.errors = errors;
  }
  
  return res.status(statusCode).json(response);
};

// Async handler to avoid try/catch blocks
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((err) => {
    console.error('Error:', err.message);
    
    // Handle different types of errors
    if (err.name === 'ValidationError') {
      // Mongoose validation error
      const errors = Object.values(err.errors).map(val => val.message);
      return errorResponse(res, 400, 'Validation failed', errors);
    } else if (err.name === 'CastError') {
      // Mongoose bad ObjectId
      return errorResponse(res, 404, `Resource not found with id of ${err.value}`);
    } else if (err.code === 11000) {
      // Duplicate key error
      const field = Object.keys(err.keyValue)[0];
      return errorResponse(res, 400, `${field} already exists`);
    } else if (err.name === 'JsonWebTokenError') {
      // JWT error
      return errorResponse(res, 401, 'Invalid token');
    } else if (err.name === 'TokenExpiredError') {
      // JWT expired
      return errorResponse(res, 401, 'Token expired');
    }
    
    // Default server error
    return errorResponse(res, 500, 'Server error');
  });
};

module.exports = {
  errorResponse,
  asyncHandler
}; 