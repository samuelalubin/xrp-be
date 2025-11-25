const express = require('express');
const helmet = require('helmet');
const xss = require('xss-clean');
const mongoSanitize = require('express-mongo-sanitize');
const compression = require('compression');
const cors = require('cors');
const passport = require('passport');
const httpStatus = require('http-status');
const config = require('./config/config');
const morgan = require('./config/morgan');
const { jwtStrategy } = require('./config/passport');
const { authLimiter } = require('./middlewares/rateLimiter');
const routes = require('./routes/v1');
const { errorConverter, errorHandler } = require('./middlewares/error');
const ApiError = require('./utils/ApiError');
const DestinationMapping = require('./models/destinationMapping.model');
const User = require('./models/user.model');
const Deposit = require('./models/deposit.model');
const { DEPOSIT_WALLET_ADDRESS } = process.env;

const app = express();

if (config.env !== 'test') {
  app.use(morgan.successHandler);
  app.use(morgan.errorHandler);
}

// set security HTTP headers
app.use(helmet());

// parse json request body
app.use(express.json());

// parse urlencoded request body
app.use(express.urlencoded({ extended: true }));

// sanitize request data
app.use(xss());
app.use(mongoSanitize());

// gzip compression
app.use(compression());

// enable cors
app.use(cors());
app.options('*', cors());

// jwt authentication
app.use(passport.initialize());
passport.use('jwt', jwtStrategy);

// limit repeated failed requests to auth endpoints
if (config.env === 'production') {
  app.use('/v1/auth', authLimiter);
}

// v1 api routes
app.use('/v1', routes);
app.get('/', (req, res) => {
  res.send({ success: true, message: 'Production Server is running' });
});
app.post('/users', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email) return res.status(400).json({ error: 'email required' });

  // Assign the next available destination tag
  const last = await DestinationMapping.findOne().sort({ destinationTag: -1 });
  const nextTag = last ? last.destinationTag + 1 : 1000;

  const user = new User({ email, password, name, destinationTag: nextTag });
  await user.save();

  const mapping = new DestinationMapping({
    destinationTag: nextTag,
    userId: user._id,
  });
  await mapping.save();

  res.json({
    user: { id: user._id, email: user.email },
    deposit: {
      address: DEPOSIT_WALLET_ADDRESS,
      destinationTag: nextTag,
      memo: `Send XRP to address and include destinationTag ${nextTag}`,
    },
  });
});
// Create a user (demo)

app.get('/deposit-info/:email', async (req, res) => {
  const email = req.params.email;
  const user = await User.findOne({ email });

  if (!user) return res.status(404).json({ error: 'user not found' });

  res.json({
    address: DEPOSIT_WALLET_ADDRESS,
    destinationTag: user.destinationTag,
  });
});

// Get deposits (demo)
app.get('/deposits', async (req, res) => {
  const deposits = await Deposit.find().sort({ createdAt: -1 }).limit(50).populate('userId');
  res.json(deposits);
});
// send back a 404 error for any unknown api request
app.use((req, res, next) => {
  next(new ApiError(httpStatus.NOT_FOUND, 'Not found'));
});

// convert error to ApiError, if needed
app.use(errorConverter);

// handle error
app.use(errorHandler);

module.exports = app;
