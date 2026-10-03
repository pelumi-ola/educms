const router = require('express').Router();
const c = require('../controllers/analyticsController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/overview', authenticate, authorize('admin', 'editor'), c.overview);

module.exports = router;
