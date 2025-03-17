const express = require('express');
const router = express.Router();
const Category = require('../models/Category');
const auth = require('../middleware/auth');
const { asyncHandler, errorResponse } = require('../utils/errorHandler');

// GET all categories
router.get('/all', asyncHandler(async (req, res) => {
  const categories = await Category.find();
  
  res.json({
    success: true,
    count: categories.length,
    data: categories
  });
}));

// GET single category
router.get('/:id', asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  
  if (!category) {
    return errorResponse(res, 404, 'Category not found');
  }
  
  res.json({
    success: true,
    data: category
  });
}));

// CREATE category (requires authentication and admin role)
router.post('/', auth, asyncHandler(async (req, res) => {
  // Check if user is admin
  if (req.user.role !== 'admin') {
    return errorResponse(res, 403, 'Access denied');
  }

  const { name, description } = req.body;

  // Check if category already exists
  let category = await Category.findOne({ name });
  if (category) {
    return errorResponse(res, 400, 'Category already exists');
  }

  category = new Category({
    name,
    description
  });

  const newCategory = await category.save();
  
  res.status(201).json({
    success: true,
    data: newCategory
  });
}));

// UPDATE category (requires authentication and admin role)
router.put('/:id', auth, asyncHandler(async (req, res) => {
  // Check if user is admin
  if (req.user.role !== 'admin') {
    return errorResponse(res, 403, 'Access denied');
  }

  const { name, description } = req.body;
  
  // Build category object
  const categoryFields = {};
  if (name) categoryFields.name = name;
  if (description) categoryFields.description = description;
  
  let category = await Category.findById(req.params.id);
  if (!category) {
    return errorResponse(res, 404, 'Category not found');
  }
  
  // Check if new name already exists (if name is being updated)
  if (name && name !== category.name) {
    const existingCategory = await Category.findOne({ name });
    if (existingCategory) {
      return errorResponse(res, 400, 'Category name already exists');
    }
  }
  
  category = await Category.findByIdAndUpdate(
    req.params.id,
    { $set: categoryFields },
    { new: true }
  );
  
  res.json({
    success: true,
    data: category
  });
}));

// DELETE category (requires authentication and admin role)
router.delete('/:id', auth, asyncHandler(async (req, res) => {
  // Check if user is admin
  if (req.user.role !== 'admin') {
    return errorResponse(res, 403, 'Access denied');
  }
  
  const category = await Category.findById(req.params.id);
  if (!category) {
    return errorResponse(res, 404, 'Category not found');
  }
  
  await Category.findByIdAndRemove(req.params.id);
  
  res.json({
    success: true,
    message: 'Category removed successfully'
  });
}));

module.exports = router; 