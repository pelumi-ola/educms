const router = require('express').Router();
const c = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { validate, rules } = require('../middleware/validation');

router.post('/register', rules.register, validate, c.register);
router.post('/login', rules.login, validate, c.login);
router.post('/refresh', c.refresh);
router.get('/verify-email/:token', c.verifyEmail);
router.get('/me', authenticate, c.me);
router.put('/me', authenticate, rules.profile, validate, c.updateMe);
router.post('/change-password', authenticate, rules.changePassword, validate, c.changePassword);

module.exports = router;
