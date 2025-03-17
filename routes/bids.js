const express = require('express');
const router = express.Router();
const Bid = require('../models/Bid');
const Item = require('../models/Item');
const auth = require('../middleware/auth');
const { asyncHandler, errorResponse } = require('../utils/errorHandler');

// GET all bids for an item
router.get('/item/:itemId', asyncHandler(async (req, res) => {
  const bids = await Bid.find({ item: req.params.itemId })
    .populate('bidder', 'username')
    .sort({ createdAt: -1 });
  
  res.json({
    success: true,
    count: bids.length,
    data: bids
  });
}));

// GET highest bid for an item
router.get('/item/:itemId/highest', asyncHandler(async (req, res) => {
  const highestBid = await Bid.findOne({ item: req.params.itemId })
    .sort({ amount: -1 })
    .populate('bidder', 'username');
  
  res.json({
    success: true,
    data: highestBid || { amount: 0 }
  });
}));

// GET my bids (requires authentication)
router.get('/my-bids', auth, asyncHandler(async (req, res) => {
  const bids = await Bid.find({ bidder: req.user.userId })
    .sort({ createdAt: -1 })
    .populate({
      path: 'item',
      select: 'title startBid endDate status',
      populate: { path: 'category', select: 'name' }
    });
  
  res.json({
    success: true,
    count: bids.length,
    data: bids
  });
}));

// Place a bid
router.post('/', auth, asyncHandler(async (req, res) => {
  const { itemId, amount } = req.body;
  
  // Validate input
  if (!itemId || !amount) {
    return errorResponse(res, 400, 'Item ID and bid amount are required');
  }
  
  // Find the item
  const item = await Item.findById(itemId);
  if (!item) {
    return errorResponse(res, 404, 'Item not found');
  }
  
  // Check if auction is active
  if (item.status !== 'active') {
    return errorResponse(res, 400, 'This auction is not active');
  }
  
  // Check if auction has ended
  if (new Date(item.endDate) < new Date()) {
    // Update item status to ended
    item.status = 'ended';
    await item.save();
    return errorResponse(res, 400, 'This auction has ended');
  }
  
  // Check if user is the seller
  if (item.seller.toString() === req.user.userId) {
    return errorResponse(res, 400, 'You cannot bid on your own item');
  }
  
  // Check if bid amount is valid
  const currentBid = item.currentBid || item.startingBid;
  const minIncrement = item.minIncrement || 1; // Default increment of 1
  
  if (amount < currentBid + minIncrement) {
    return errorResponse(res, 400, `Bid must be at least ${currentBid + minIncrement}`);
  }
  
  // Create the bid
  const bid = new Bid({
    item: itemId,
    bidder: req.user.userId,
    amount
  });
  
  await bid.save();
  
  // Update the item with the new highest bid
  item.currentBid = amount;
  item.highestBidder = req.user.userId;
  await item.save();
  
  // Return the updated item and bid
  const updatedItem = await Item.findById(itemId)
    .populate('category', 'name')
    .populate('seller', 'username')
    .populate('highestBidder', 'username');
  
  res.status(201).json({
    success: true,
    message: 'Bid placed successfully',
    data: {
      bid,
      item: updatedItem
    }
  });
}));

// Get bids by a user
router.get('/user', auth, asyncHandler(async (req, res) => {
  const bids = await Bid.find({ bidder: req.user.userId })
    .populate({
      path: 'item',
      select: 'title images currentBid startingBid status endDate',
      populate: {
        path: 'seller',
        select: 'username'
      }
    })
    .sort({ createdAt: -1 });
  
  res.json({
    success: true,
    count: bids.length,
    data: bids
  });
}));

module.exports = router; 