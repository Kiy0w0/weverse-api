require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const fs = require('fs');
const path = require('path');

const logger = require('./lib/logger');

// Verifikasi variabel lingkungan dari .env
if (process.env.WEVERSE_EMAIL && process.env.WEVERSE_PASSWORD) {
  logger.info('Credentials found in environment variables');
} else {
  logger.warn('No credentials found in environment variables, checking .env file');
  try {
    const envPath = path.resolve(__dirname, '.env');
    const envExists = fs.existsSync(envPath);
    logger.info(`.env file ${envExists ? 'exists' : 'does not exist'} at ${envPath}`);
    if (envExists) {
      // Coba load ulang .env
      require('dotenv').config({ path: envPath });
    }
    
    // Jika masih tidak tersedia, gunakan nilai hardcoded untuk pengujian
    if (!process.env.WEVERSE_EMAIL || !process.env.WEVERSE_PASSWORD) {
      logger.warn('Using hardcoded credentials as fallback for testing');
      process.env.WEVERSE_EMAIL = 'stokmlpipzstore01@gmail.com';
      process.env.WEVERSE_PASSWORD = '@2001Amel';
    }
  } catch (error) {
    logger.error(`Error checking .env file: ${error.message}`);
  }
}

const weverseClient = require('./lib/weverseClient');
const cache = require('./lib/cache');
const { schemas, validateBody, validateParams, validateQuery } = require('./lib/validator');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Basic middleware
app.use(express.json());
app.use(helmet());
app.use(cors());

// Rate limiting - 100 requests per 15 minutes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, 
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
  skip: (req) => process.env.NODE_ENV === 'development'
});

app.use('/api', limiter);

// Logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  const start = new Date();
  
  res.on('finish', () => {
    const duration = new Date() - start;
    logger.info(`${req.method} ${req.url} ${res.statusCode} - ${duration}ms`);
  });
  
  next();
});

// Swagger UI setup
if (fs.existsSync(path.join(__dirname, 'swagger.yaml'))) {
  const swaggerDocument = YAML.load(path.join(__dirname, 'swagger.yaml'));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  logger.info('Swagger UI available at /api-docs');
}

// Authentication middleware
const checkAuth = (req, res, next) => {
  if (!weverseClient.token) {
    logger.warn('Unauthenticated request rejected');
    return res.status(401).json({ error: 'Not authenticated with Weverse' });
  }
  next();
};

// Cache middleware
const cacheMiddleware = (namespace) => {
  return (req, res, next) => {
    const key = cache.constructor.generateKey(
      namespace,
      `${req.originalUrl || req.url}`
    );
    
    const cachedData = cache.get(key);
    
    if (cachedData) {
      logger.debug(`Serving cached response for ${req.originalUrl}`);
      return res.json(cachedData);
    }
    
    // Override res.json to cache the response before sending
    const originalJson = res.json;
    res.json = function(data) {
      if (res.statusCode === 200) {
        cache.set(key, data);
      }
      return originalJson.call(this, data);
    };
    
    next();
  };
};

// API Routes
const apiRouter = express.Router();

// Root route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Welcome to Weverse API',
    version: '1.0.0',
    documentation: '/api-docs'
  });
});

// Auth routes
apiRouter.post('/auth/login', validateBody(schemas.login), async (req, res) => {
  const { email, password } = req.body;
  
  try {
    logger.info(`Login attempt for user: ${email}`);
    logger.debug(`Login request body: ${JSON.stringify(req.body)}`);
    
    const success = await weverseClient.login(email, password);
    
    if (success) {
      logger.info(`Login successful for user: ${email}`);
      logger.debug(`Token obtained: ${weverseClient.token ? 'yes' : 'no'}`);
      res.json({ message: 'Authentication successful' });
    } else {
      logger.warn(`Login failed for user: ${email}`);
      res.status(401).json({ error: 'Authentication failed' });
    }
  } catch (error) {
    logger.error(`Login error: ${error.message}`);
    logger.error(`Error stack: ${error.stack}`);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Community routes
apiRouter.get('/communities', checkAuth, cacheMiddleware('communities'), async (req, res) => {
  try {
    logger.info('Getting communities');
    const communities = await weverseClient.getCommunities();
    res.json(communities);
  } catch (error) {
    logger.error(`Failed to get communities: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

apiRouter.get(
  '/communities/:communityId/posts',
  checkAuth,
  validateParams(schemas.communityId),
  validateQuery(schemas.pagination),
  cacheMiddleware('posts'),
  async (req, res) => {
    try {
      const { communityId } = req.params;
      const { page, size } = req.query;
      
      logger.info(`Getting posts for community: ${communityId}, page: ${page}, size: ${size}`);
      const posts = await weverseClient.getPosts(communityId, page, size);
      res.json(posts);
    } catch (error) {
      logger.error(`Failed to get posts: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }
);

apiRouter.get(
  '/communities/:communityId/artists',
  checkAuth,
  validateParams(schemas.communityId),
  cacheMiddleware('artists'),
  async (req, res) => {
    try {
      const { communityId } = req.params;
      
      logger.info(`Getting artists for community: ${communityId}`);
      const artists = await weverseClient.getArtists(communityId);
      res.json(artists);
    } catch (error) {
      logger.error(`Failed to get artists: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }
);

// Media routes
apiRouter.get(
  '/posts/:postId/media',
  checkAuth,
  validateParams(schemas.postId),
  cacheMiddleware('media'),
  async (req, res) => {
    try {
      const { postId } = req.params;
      
      logger.info(`Getting media for post: ${postId}`);
      const media = await weverseClient.getMedia(postId);
      res.json(media);
    } catch (error) {
      logger.error(`Failed to get media: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }
);

// Cache management endpoints
apiRouter.delete('/cache/flush', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Not allowed in production' });
  }
  
  cache.flush();
  logger.info('Cache flushed');
  res.json({ message: 'Cache successfully flushed' });
});

// API status endpoint
apiRouter.get('/status', (req, res) => {
  res.json({
    status: 'online',
    version: '1.0.0',
    timestamp: new Date(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Mount API router
app.use('/api', apiRouter);

// 404 handler
app.use((req, res) => {
  logger.warn(`Not found: ${req.method} ${req.url}`);
  res.status(404).json({ error: 'Not Found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.stack}`);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`API Documentation: http://localhost:${PORT}/api-docs`);
  
  // Auto login if credentials provided
  if (process.env.WEVERSE_EMAIL && process.env.WEVERSE_PASSWORD) {
    logger.info('Auto-login credentials found, attempting to log in');
  } else {
    logger.warn('No auto-login credentials found in .env');
  }
}); 