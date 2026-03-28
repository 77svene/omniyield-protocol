const express = require('express');
const { v4: uuidv4 } = require('uuid');

// In-memory store for rate limiting
const requestCounts = new Map();
const WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS = 100;

// Request validation middleware
function validateRequest(schema) {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      const details = error.details.map(detail => detail.message);
      return res.status(400).json({ error: 'Validation failed', details });
    }
    next();
  };
}

// Rate limiting middlewarefunction rateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  
  if (!requestCounts.has(ip)) {
    requestCounts.set(ip, { count: 1, startTime: now });
    return next();
  }
  
  const { count, startTime } = requestCounts.get(ip);
  
  // Reset window if expired
  if (now - startTime > WINDOW_MS) {
    requestCounts.set(ip, { count: 1, startTime: now });
    return next();
  }
  
  // Check limit
  if (count >= MAX_REQUESTS) {
    return res.status(429).json({ 
      error: 'Rate limit exceeded', 
      message: `Too many requests, please try again after ${Math.ceil((WINDOW_MS - (now - startTime)) / 1000)} seconds`     });
  }
  
  // Increment count
  requestCounts.set(ip, { count: count + 1, startTime });
  next();
}

// Error handling middleware
function errorHandler(err, req, res, next) {
  console.error(err.stack);
  
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}

// Request ID middleware
function requestId(req, res, next) {
  req.id = uuidv4();
  res.setHeader('X-Request-ID', req.id);
  next();
}

// Logging middleware
function logger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
  });
  next();

module.exports = {
  validateRequest,
  rateLimiter,
  errorHandler,
  requestId,
  logger
};