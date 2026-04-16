const jwt = require('jsonwebtoken');
const { secret, expiresIn, refreshSecret, refreshExpiresIn } = require('../config/jwt');

const generateToken = (payload, options = {}) => {
  return jwt.sign(payload, secret, { expiresIn, ...options });
};

const generateRefreshToken = (payload, options = {}) => {
  return jwt.sign(payload, refreshSecret, { expiresIn: refreshExpiresIn, ...options });
};

const verifyToken = (token, options = {}) => {
  try {
    return jwt.verify(token, secret, options);
  } catch (error) {
    return null;
  }
};

const verifyRefreshToken = (token, options = {}) => {
  try {
    return jwt.verify(token, refreshSecret, options);
  } catch (error) {
    return null;
  }
};

const decodeToken = (token) => {
  return jwt.decode(token);
};

module.exports = {
  generateToken,
  generateRefreshToken,
  verifyToken,
  verifyRefreshToken,
  decodeToken,
};