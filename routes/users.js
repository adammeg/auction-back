const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');
const Item = require('../models/Item');
const Bid = require('../models/Bid');

/* GET users listing. */
router.get('/', function(req, res, next) {
  res.send('respond with a resource');
});

// Register a new user
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, firstName, lastName } = req.body;

    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'Utilisateur déjà existant' });
    }

    user = new User({
      username,
      email,
      password,
      firstName,
      lastName
    });

    await user.save();

    // Create JWT token
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.status(201).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Login user
// Login user
router.post('/login', async (req, res) => {
  try {
    console.log('Login request received:', req.body);
    
    const { email, password } = req.body;
    
    // Validate that email and password are strings
    if (typeof email !== 'string' || typeof password !== 'string') {
      console.error('Invalid login data types:', { 
        emailType: typeof email, 
        passwordType: typeof password 
      });
      return res.status(400).json({ message: 'Invalid email or password format' });
    }
    
    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    // Create JWT token
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );
    
    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get current user profile
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'utilisateur non trouvé' });
    }
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all users (admin only)
router.get('/', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Accès refusé' });
    }
    
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'utilisateur non trouvé' });
    }
    
    // Only allow admins or the user themselves to access their profile
    if (req.user.role !== 'admin' && req.user.userId !== req.params.id) {
      return res.status(403).json({ message: 'Accès refusé' });
    }
    
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user
router.put('/:id', auth, async (req, res) => {
  try {
    // Only allow admins or the user themselves to update their profile
    if (req.user.role !== 'admin' && req.user.userId !== req.params.id) {
      return res.status(403).json({ message: 'Accès refusé' });
    }
    
    const { username, email, firstName, lastName, role } = req.body;
    
    // Build user object
    const userFields = {};
    if (username) userFields.username = username;
    if (email) userFields.email = email;
    if (firstName) userFields.firstName = firstName;
    if (lastName) userFields.lastName = lastName;
    
    // Only allow admins to update role
    if (role && req.user.role === 'admin') {
      userFields.role = role;
    }
    
    let user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'utilisateur non trouvé' });
    }
    
    user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: userFields },
      { new: true }
    ).select('-password');
    
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete user
router.delete('/:id', auth, async (req, res) => {
  try {
    // Only allow admins or the user themselves to delete their account
    if (req.user.role !== 'admin' && req.user.userId !== req.params.id) {
      return res.status(403).json({ message: 'Accès refusé' });
    }
    
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'utilisateur non trouvé' });
    }
    
    await User.findByIdAndRemove(req.params.id);
    
      res.json({ message: 'utilisateur supprimé' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET dashboard stats for the current user
router.get('/dashboard-stats', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Get active bids count (bids where the user is not outbid)
    const activeBidsCount = await Bid.countDocuments({
      bidder: userId,
      item: { $in: await Item.find({ status: 'active', endDate: { $gt: new Date() } }).distinct('_id') }
    });
    
    // Get active listings count
    const activeListingsCount = await Item.countDocuments({ 
      seller: userId,
      status: 'active',
      endDate: { $gt: new Date() }
    });
    
    // Get won auctions count
    const wonAuctionsCount = await Item.countDocuments({
      highestBidder: userId,
      status: 'ended'
    });
    
    // Get items ending soon that the user has bid on or is watching
    // For this example, we'll just get items ending in the next 24 hours
    const endDate = new Date();
    endDate.setHours(endDate.getHours() + 24);
    
    // Get user's bids
    const userBids = await Bid.find({ bidder: userId })
      .populate({
        path: 'item',
        match: { status: 'active', endDate: { $lt: endDate, $gt: new Date() } },
        populate: [
          { path: 'category', select: 'name' },
          { path: 'seller', select: 'username' }
        ]
      })
      .sort({ 'item.endDate': 1 })
      .limit(10);
    
    // Filter out null items (items that don't match the criteria)
    const validBids = userBids.filter(bid => bid.item);
    
    // Group bids by item and get the highest bid for each item
    const itemMap = new Map();
    validBids.forEach(bid => {
      const itemId = bid.item._id.toString();
      if (!itemMap.has(itemId) || itemMap.get(itemId).amount < bid.amount) {
        itemMap.set(itemId, {
          _id: bid.item._id,
          title: bid.item.title,
          images: bid.item.images,
          currentBid: bid.item.currentBid,
          startingBid: bid.item.startingBid,
          endDate: bid.item.endDate,
          userBid: bid.amount
        });
      }
    });
    
    // Convert map to array
    const endingSoon = Array.from(itemMap.values());
    
    res.json({
      activeBids: activeBidsCount,
      activeListings: activeListingsCount,
      wonAuctions: wonAuctionsCount,
      endingSoon
    });
  } catch (err) {
    console.error('Error fetching dashboard stats:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
