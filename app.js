var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var cors = require('cors');
var mongoose = require('mongoose');
var multer = require('multer');
const { errorResponse } = require('./utils/errorHandler');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var itemsRouter = require('./routes/items');
var categoriesRouter = require('./routes/categories');
var bidsRouter = require('./routes/bids');
var uploadsRouter = require('./routes/uploads');

var app = express();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/yourdbname', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected'))
.catch(err => {
  console.log('MongoDB connection error:', err);
  // Don't crash the app, just log the error
});

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use(cors());

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/items', itemsRouter);
app.use('/categories', categoriesRouter);
app.use('/bids', bidsRouter);
app.use('/uploads', uploadsRouter);

// Multer error handling
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return errorResponse(res, 400, 'File too large. Max size is 5MB.');
    }
    return errorResponse(res, 400, err.message);
  } else if (err) {
    return errorResponse(res, 400, err.message);
  }
  next();
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // Send a JSON response for API routes
  if (req.originalUrl.includes('/api/')) {
    const statusCode = err.status || 500;
    const message = statusCode === 500 ? 'Server error' : err.message;
    return errorResponse(res, statusCode, message);
  }

  // render the error page for non-API routes
  res.status(err.status || 500);
  res.render('error');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`);
  // Don't crash the server
});

module.exports = app;
