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
    required: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  itemCondition: {
    type: String,
    enum: ['new', 'likeNew', 'excellent', 'veryGood', 'good', 'fair', 'poor', 'forParts'],
    required: true
  },
  images: {
    type: [String],
    default: []
  },
  startBid: {
    type: Number,
    required: true,
    min: 0
  },
  currentBid: {
    type: Number,
    default: 0
  },
  minBid: {
    type: Number,
    required: true,
    min: 1
  },
  reservePrice: {
    type: Number,
    default: 0
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  highestBidder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  endDate: {
    type: Date,
  },
  auctionDuration: {
    type: Number,
    required: true,
    min: 1
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'ended', 'cancelled'],
    default: 'active'
  },
  featured: {
    type: Boolean,
    default: false
  },
  shippingOptions: {
    domestic: {
      type: Boolean,
      default: false
    },
    international: {
      type: Boolean,
      default: false
    },
    pickup: {
      type: Boolean,
      default: false
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
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
module.exports = mongoose.model('Item', ItemSchema); 