const mongoose = require('mongoose');
const Item = require('../models/Item');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

async function testFeaturedItems() {
  try {
    // Count total items
    const totalCount = await Item.countDocuments();
    console.log(`Total items in database: ${totalCount}`);
    
    // Count featured items
    const featuredCount = await Item.countDocuments({ featured: true });
    console.log(`Featured items: ${featuredCount}`);
    
    // Get featured items
    const featuredItems = await Item.find({ featured: true })
      .populate('category', 'name')
      .populate('seller', 'username');
    
    console.log('Featured items:');
    featuredItems.forEach(item => {
      console.log(`- ${item._id}: ${item.title} (by ${item.seller.username})`);
    });
    
    process.exit(0);
  } catch (err) {
    console.error('Error testing featured items:', err);
    process.exit(1);
  }
}

testFeaturedItems(); 