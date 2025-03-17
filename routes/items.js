const express = require('express');
const router = express.Router();
const Item = require('../models/Item');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const path = require('path');
const fs = require('fs');
const { asyncHandler, errorResponse } = require('../utils/errorHandler');
const Bid = require('../models/Bid');

// Get featured items
router.get('/featured', async (req, res) => {
  try {
    // Find items that are marked as featured and active
    const featuredItems = await Item.find({ 
      featured: true, 
      status: 'active' 
    })
    .populate('category', 'name')
    .populate('seller', 'username')
    .sort({ createdAt: -1 })
    .limit(6); // Limit to 6 featured items
    
    res.json(featuredItems);
  } catch (err) {
    console.error('Error fetching featured items:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET all items
router.get('/', asyncHandler(async (req, res) => {
  const items = await Item.find()
    .populate('category', 'name')
    .populate('seller', 'username');
  
  res.json({
    success: true,
    count: items.length,
    data: items
  });
}));

// GET active auctions
router.get('/active', async (req, res) => {
  try {
    const items = await Item.find({ 
      status: 'active', 
      endDate: { $gt: new Date() } 
    })
    .populate('category', 'name')
    .populate('seller', 'username')
    .sort({ createdAt: -1 });
    
    res.json(items);
  } catch (err) {
    console.error('Error fetching active items:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET items by category
router.get('/category/:categoryId', asyncHandler(async (req, res) => {
  const items = await Item.find({ category: req.params.categoryId })
    .populate('category', 'name')
    .populate('seller', 'username');
  
  res.json({
    success: true,
    count: items.length,
    data: items
  });
}));

// GET items by seller
router.get('/seller/:sellerId', asyncHandler(async (req, res) => {
  const items = await Item.find({ seller: req.params.sellerId })
    .populate('category', 'name')
    .populate('seller', 'username');
  
  res.json({
    success: true,
    count: items.length,
    data: items
  });
}));

// GET my items (requires authentication)
router.get('/my-items', auth, async (req, res) => {
  try {
    const items = await Item.find({ seller: req.user.userId })
      .populate('category', 'name')
      .populate('seller', 'username')
      .populate('highestBidder', 'username')
      .sort({ createdAt: -1 });
    
    // For each item, count the number of bids
    const itemsWithBidCount = await Promise.all(items.map(async (item) => {
      const bidCount = await Bid.countDocuments({ item: item._id });
      const itemObj = item.toObject();
      itemObj.bids = bidCount;
      return itemObj;
    }));
    
    res.json(itemsWithBidCount);
  } catch (err) {
    console.error('Error fetching user items:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET single item
router.get('/:id', async (req, res) => {
  try {
    const item = await Item.findById(req.params.id)
      .populate('category', 'name')
      .populate('seller', 'username createdAt')
      .populate('highestBidder', 'username');
    
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }
    
    res.json(item);
  } catch (err) {
    console.error('Error fetching item:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// CREATE item with images (requires authentication)
router.post('/', auth, upload.array('images', 5), asyncHandler(async (req, res) => {
  const {
    title,
    description,
    category,
    itemCondition,
    startBid,
    reservePrice,
    minBid,
    auctionDuration
  } = req.body;

  // Process uploaded images
  const imageUrls = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];

  const item = new Item({
    title,
    description,
    category,
    itemCondition,
    images: imageUrls,
    startBid,
    reservePrice,
    minBid,
    auctionDuration,
    seller: req.user.userId
  });

  const newItem = await item.save();
  const populatedItem = await Item.findById(newItem._id)
    .populate('category', 'name')
    .populate('seller', 'username');
  
  res.status(201).json({
    success: true,
    data: populatedItem
  });
}));

// UPDATE item with images (requires authentication)
router.put('/:id', auth, upload.array('images', 5), asyncHandler(async (req, res) => {
  const item = await Item.findById(req.params.id);
  
  if (!item) {
    return errorResponse(res, 404, 'Item not found');
  }
  
  // Check if user is the seller or admin
  if (item.seller.toString() !== req.user.userId && req.user.role !== 'admin') {
    return errorResponse(res, 403, 'Access denied');
  }
  
  // Check if auction has already started with bids
  if (item.status !== 'active' && req.user.role !== 'admin') {
    return errorResponse(res, 400, 'Cannot update an auction that has ended or been cancelled');
  }
  
  const {
    title,
    description,
    category,
    itemCondition,
    startBid,
    reservePrice,
    minBid,
    auctionDuration,
    status,
    keepExistingImages
  } = req.body;
  
  // Process uploaded images
  const newImageUrls = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];
  
  // Update fields
  if (title) item.title = title;
  if (description) item.description = description;
  if (category) item.category = category;
  if (itemCondition) item.itemCondition = itemCondition;
  
  // Handle images
  if (keepExistingImages === 'true' || keepExistingImages === true) {
    // Add new images to existing ones
    item.images = [...item.images, ...newImageUrls];
  } else if (newImageUrls.length > 0) {
    // Replace with new images
    item.images = newImageUrls;
  }
  
  if (startBid) item.startBid = startBid;
  if (reservePrice !== undefined) item.reservePrice = reservePrice;
  if (minBid) item.minBid = minBid;
  if (auctionDuration) item.auctionDuration = auctionDuration;
  
  // Only admin can change status
  if (status && req.user.role === 'admin') {
    item.status = status;
  }
  
  const updatedItem = await item.save();
  const populatedItem = await Item.findById(updatedItem._id)
    .populate('category', 'name')
    .populate('seller', 'username');
  
  res.json({
    success: true,
    data: populatedItem
  });
}));

// Cancel auction (requires authentication)
router.patch('/:id/cancel', auth, asyncHandler(async (req, res) => {
  const item = await Item.findById(req.params.id);
  
  if (!item) {
    return errorResponse(res, 404, 'Item not found');
  }
  
  // Check if user is the seller or admin
  if (item.seller.toString() !== req.user.userId && req.user.role !== 'admin') {
    return errorResponse(res, 403, 'Access denied');
  }
  
  // Update status to cancelled
  item.status = 'cancelled';
  
  const updatedItem = await item.save();
  const populatedItem = await Item.findById(updatedItem._id)
    .populate('category', 'name')
    .populate('seller', 'username');
  
  res.json({
    success: true,
    data: populatedItem
  });
}));

// DELETE item (requires authentication)
router.delete('/:id', auth, asyncHandler(async (req, res) => {
  const item = await Item.findById(req.params.id);
  
  if (!item) {
    return errorResponse(res, 404, 'Item not found');
  }
  
  // Check if user is the seller or admin
  if (item.seller.toString() !== req.user.userId && req.user.role !== 'admin') {
    return errorResponse(res, 403, 'Access denied');
  }
  
  await Item.findByIdAndRemove(req.params.id);
  
  res.json({
    success: true,
    message: 'Item deleted successfully'
  });
}));

// Add images to an item (requires authentication)
router.post('/:id/images', auth, upload.array('images', 5), asyncHandler(async (req, res) => {
  const item = await Item.findById(req.params.id);
  
  if (!item) {
    return errorResponse(res, 404, 'Item not found');
  }
  
  // Check if user is the seller or admin
  if (item.seller.toString() !== req.user.userId && req.user.role !== 'admin') {
    return errorResponse(res, 403, 'Access denied');
  }
  
  // Process uploaded images
  const newImageUrls = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];
  
  if (newImageUrls.length === 0) {
    return errorResponse(res, 400, 'No images uploaded');
  }
  
  // Add new images to existing ones
  item.images = [...item.images, ...newImageUrls];
  
  const updatedItem = await item.save();
  const populatedItem = await Item.findById(updatedItem._id)
    .populate('category', 'name')
    .populate('seller', 'username');
  
  res.json({
    success: true,
    data: populatedItem
  });
}));

// Remove an image from an item (requires authentication)
router.delete('/:id/images/:imageIndex', auth, asyncHandler(async (req, res) => {
  const item = await Item.findById(req.params.id);
  
  if (!item) {
    return errorResponse(res, 404, 'Item not found');
  }
  
  // Check if user is the seller or admin
  if (item.seller.toString() !== req.user.userId && req.user.role !== 'admin') {
    return errorResponse(res, 403, 'Access denied');
  }
  
  const imageIndex = parseInt(req.params.imageIndex);
  
  // Check if image index is valid
  if (isNaN(imageIndex) || imageIndex < 0 || imageIndex >= item.images.length) {
    return errorResponse(res, 400, 'Invalid image index');
  }
  
  // Get the image URL
  const imageUrl = item.images[imageIndex];
  
  // Remove image from array
  item.images.splice(imageIndex, 1);
  await item.save();
  
  // Try to delete the file from the server
  try {
    const filename = path.basename(imageUrl);
    const filepath = path.join(__dirname, '../public/uploads', filename);
    
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
  } catch (error) {
    console.error('Error deleting file:', error);
    // Continue even if file deletion fails
  }
  
  res.json({
    success: true,
    message: 'Image removed successfully',
    data: item
  });
}));

// Add a simple debug route
router.get('/debug', (req, res) => {
  res.json({
    message: 'Items API is working',
    timestamp: new Date().toISOString()
  });
});

// GET related items (same category, excluding current item)
router.get('/related/:categoryId', async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { exclude, limit = 4 } = req.query;
    
    // Convert limit to number
    const limitNum = parseInt(limit, 10);
    
    // Find active items in the same category, excluding the current item
    const query = { 
      category: categoryId,
      status: 'active',
      endDate: { $gt: new Date() }
    };
    
    // Add exclusion if provided
    if (exclude) {
      query._id = { $ne: exclude };
    }
    
    const items = await Item.find(query)
      .populate('category', 'name')
      .populate('seller', 'username')
      .sort({ createdAt: -1 })
      .limit(limitNum);
    
    res.json(items);
  } catch (err) {
    console.error('Error fetching related items:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET items by IDs
router.get('/by-ids', async (req, res) => {
  try {
    const { ids } = req.query;
    
    if (!ids) {
      return res.status(400).json({ message: 'No item IDs provided' });
    }
    
    // Split the comma-separated string into an array
    const itemIds = ids.split(',');
    
    // Find items with the provided IDs
    const items = await Item.find({ 
      _id: { $in: itemIds },
      status: 'active'
    })
    .populate('category', 'name')
    .populate('seller', 'username')
    .sort({ createdAt: -1 });
    
    // For each item, count the number of bids
    const itemsWithBidCount = await Promise.all(items.map(async (item) => {
      const bidCount = await Bid.countDocuments({ item: item._id });
      const itemObj = item.toObject();
      itemObj.bids = bidCount;
      return itemObj;
    }));
    
    res.json(itemsWithBidCount);
  } catch (err) {
    console.error('Error fetching items by IDs:', err);
    res.status(500).json({ message: 'Server error' });
  }
});
// Search items
router.get('/search', async (req, res) => {
    try {
      const { q, sort, category, page = 1, limit = 12 } = req.query;
      
      // Build query
      const query = { status: 'active', endDate: { $gt: new Date() } };
      
      // Add text search if query provided
      if (q) {
        query.$or = [
          { title: { $regex: q, $options: 'i' } },
          { description: { $regex: q, $options: 'i' } }
        ];
      }
      
      // Add category filter if provided
      if (category) {
        query.category = category;
      }
      
      // Determine sort order
      let sortOrder = {};
      switch (sort) {
        case 'ending-soon':
          sortOrder = { endDate: 1 };
          break;
        case 'newly-listed':
          sortOrder = { createdAt: -1 };
          break;
        case 'price-low':
          sortOrder = { currentBid: 1, startingBid: 1 };
          break;
        case 'price-high':
          sortOrder = { currentBid: -1, startingBid: -1 };
          break;
        case 'bids-high':
          sortOrder = { bidCount: -1 };
          break;
        default:
          // For relevance or default, sort by a combination of factors
          if (q) {
            // If there's a search query, relevance is important
            sortOrder = { score: { $meta: "textScore" } };
          } else {
            // Otherwise, sort by recently added
            sortOrder = { createdAt: -1 };
          }
      }
      
      // Calculate pagination
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      const skip = (pageNum - 1) * limitNum;
      
      // Count total matching documents
      const total = await Item.countDocuments(query);
      
      // Execute query with pagination
      let items = await Item.find(query)
        .populate('category', 'name')
        .populate('seller', 'username')
        .sort(sortOrder)
        .skip(skip)
        .limit(limitNum);
      
      // For each item, count the number of bids
      const itemsWithBidCount = await Promise.all(items.map(async (item) => {
        const bidCount = await Bid.countDocuments({ item: item._id });
        const itemObj = item.toObject();
        itemObj.bids = bidCount;
        return itemObj;
      }));
      
      // Calculate total pages
      const totalPages = Math.ceil(total / limitNum);
      
      res.json({
        data: itemsWithBidCount,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages
        }
      });
    } catch (err) {
      console.error('Error searching items:', err);
      res.status(500).json({ message: 'Server error' });
    }
  });
module.exports = router; 