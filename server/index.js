import express from 'express';
import dotenv from 'dotenv';
import dishRoute from './routes/dishRoute.js';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import translateRoute from './routes/translateRoute.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// Rate limiting storage (in production, use Redis)
const requestCounts = new Map();

// Rate limiting middleware
const rateLimit = (windowMs = 60000, maxRequests = 10) => {
  return (req, res, next) => {
    const clientId = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowStart = now - windowMs;
    
    if (!requestCounts.has(clientId)) {
      requestCounts.set(clientId, []);
    }
    
    const requests = requestCounts.get(clientId);
    // Remove old requests outside the window
    const validRequests = requests.filter(time => time > windowStart);
    
    if (validRequests.length >= maxRequests) {
      return res.status(429).json({
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
    
    validRequests.push(now);
    requestCounts.set(clientId, validRequests);
    
    // Clean up old entries (prevent memory leaks)
    if (requestCounts.size > 1000) {
      const oldestAllowed = now - (windowMs * 2);
      for (const [key, requests] of requestCounts.entries()) {
        if (requests.every(time => time < oldestAllowed)) {
          requestCounts.delete(key);
        }
      }
    }
    
    next();
  };
};

// Apply rate limiting to API routes
app.use('/api', rateLimit(60000, 10)); // 10 requests per minute

app.use((req, res, next) => {
  console.log(`[Request] ${req.method} ${req.url} from ${req.ip}`);
  next();
});
app.use(express.static('public'));
app.use(cors());
app.use(express.json());
app.use('/api', dishRoute);
app.use('/api', translateRoute);

app.use(express.static(path.join(__dirname, 'public')));
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});