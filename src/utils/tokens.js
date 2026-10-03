const jwt = require('jsonwebtoken');

const secret = (name) => {
  const value = process.env[name];
  if (!value) {
    if (process.env.NODE_ENV === 'production') throw new Error(`${name} must be set in production`);
    return `dev-insecure-${name.toLowerCase()}`;
  }
  return value;
};

const signAccess = (user) =>
  jwt.sign({ sub: user.user_id, role: user.role, type: 'access' }, secret('JWT_SECRET'), {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });

const signRefresh = (user) =>
  jwt.sign({ sub: user.user_id, type: 'refresh' }, secret('JWT_REFRESH_SECRET'), {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d',
  });

const verifyAccess = (token) => {
  const p = jwt.verify(token, secret('JWT_SECRET'));
  if (p.type !== 'access') throw new Error('Wrong token type');
  return p;
};

const verifyRefresh = (token) => {
  const p = jwt.verify(token, secret('JWT_REFRESH_SECRET'));
  if (p.type !== 'refresh') throw new Error('Wrong token type');
  return p;
};

module.exports = { signAccess, signRefresh, verifyAccess, verifyRefresh };
