const express = require('express');
const authRoute = require('./auth.route');
const userRoute = require('./user.route');
const depositRoute = require('./deposit.route');
const xrpRoute = require('./xrp.route');
const xrplRoute = require('./xrpl.route');
const walletRoute = require('./wallet.route');
const portfolioRoute = require('./portfolio.route');
const historyRoute = require('./history.route');
const docsRoute = require('./docs.route');
const config = require('../../config/config');

const router = express.Router();

const defaultRoutes = [
  {
    path: '/auth',
    route: authRoute,
  },
  {
    path: '/users',
    route: userRoute,
  },
  {
    path: '/deposit',
    route: depositRoute,
  },
  {
    path: '/xrp',
    route: xrpRoute,
  },
  {
    path: '/xrpl',
    route: xrplRoute,
  },
  {
    path: '/wallet',
    route: walletRoute,
  },
  {
    path: '/portfolio',
    route: portfolioRoute,
  },
  {
    path: '/history',
    route: historyRoute,
  },
];

const devRoutes = [
  // routes available only in development mode
  {
    path: '/docs',
    route: docsRoute,
  },
];

defaultRoutes.forEach((route) => {
  router.use(route.path, route.route);
});

/* istanbul ignore next */
if (config.env === 'development') {
  devRoutes.forEach((route) => {
    router.use(route.path, route.route);
  });
}

module.exports = router;
