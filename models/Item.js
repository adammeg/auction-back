const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ItemSchema = new Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  },
  itemCondition: {
    type: String,
    enum: ['New', 'Like New', 'Good', 'Fair', 'Poor'],
    required: true
  },
  images: [{
    type: String
  }],
  startBid: {
    type: Number,
    required: true,
    min: 0
  },
  reservePrice: {
    type: Number,
    min: 0
  },
  minBid: {
    type: Number,
    required: true,
    min: 0
  },
  auctionDuration: {
    type: Number,
    required: true,
    min: 1 // Duration in days
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'ended', 'cancelled'],
    default: 'active'
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  featured: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  highestBidder: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  currentBid: {
    type: Number
  },
  minIncrement: {
    type: Number,
    default: 1
  }
}, { timestamps: true });

// Calculate end date before saving
ItemSchema.pre('save', function(next) {
  if (this.isModified('auctionDuration') || this.isNew) {
    const startDate = this.startDate || new Date();
    this.endDate = new Date(startDate.getTime() + this.auctionDuration * 24 * 60 * 60 * 1000);
  }
  next();
});

module.exports = mongoose.model('Item', ItemSchema); 