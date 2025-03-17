const mongoose = require('mongoose');
const Item = require('../models/Item');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

async function markFeaturedItems() {
  try {
    // Get some random active items
    const items = await Item.find({ status: 'active' }).limit(6);
    
    // Mark them as featured
    for (const item of items) {
      item.featured = true;
      await item.save();
      console.log(`Marked item ${item._id} (${item.title}) as featured`);
    }
    
    console.log('Done marking featured items');
    process.exit(0);
  } catch (err) {
    console.error('Error marking featured items:', err);
    process.exit(1);
  }
}

markFeaturedItems(); 