import "dotenv/config";
import express from "express";
import cron from "node-cron";

/**
 * @typedef {Object} QueryParam
 * @property {string} key - The parameter key
 * @property {number} range - The maximum random value range (1 to range)
 */

const app = express();
const PORT = process.env.PORT || 3000;

// Environment variables
/** @type {string} */
const cronTimer = process.env.CRON_TIMER;
/** @type {string} */
const baseURL = process.env.BASE_URL;
/** @type {string} */
const serverAuthToken = process.env.SERVER_AUTH_TOKEN; // For incoming requests
/** @type {string|undefined} */
const clientAuthToken = process.env.CLIENT_AUTH_TOKEN; // For outgoing requests

// Validation
if (!cronTimer || !baseURL || !serverAuthToken) {
  console.error("Missing required environment variables");
  process.exit(1);
}

// Parse JSON with error handling
/** @type {string[]} */
let endpoints;
/** @type {QueryParam[]} */
let queryParams;

try {
  endpoints = process.env.ENDPOINTS ? JSON.parse(process.env.ENDPOINTS) : [];
  queryParams = process.env.QUERY_PARAMS ? JSON.parse(process.env.QUERY_PARAMS) : [];
} catch (error) {
  console.error("Error parsing JSON from environment variables:", error.message);
  process.exit(1);
}

/**
 * Middleware to authenticate incoming requests
 * @param {express.Request} req - Express request object
 * @param {express.Response} res - Express response object
 * @param {express.NextFunction} next - Express next function
 */
function authenticateRequest(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header required' });
  }
  
  const token = authHeader.startsWith('Bearer ') 
    ? authHeader.slice(7) 
    : authHeader;
  
  if (token !== serverAuthToken) {
    return res.status(403).json({ error: 'Invalid token' });
  }
  
  next();
}

/**
 * Gets a random endpoint from the provided array
 * @param {string[]} arr - Array of endpoint strings
 * @returns {string} A random endpoint or empty string if array is empty
 */
function getRandomEndpoint(arr) {
  if (!arr || arr.length === 0) {
    return "";
  }
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generates random query parameters from the provided configuration
 * @param {QueryParam[]} arr - Array of query parameter configurations
 * @returns {string} URL-encoded query string without leading '?'
 */
function getRandomQueryParams(arr) {
  if (!arr || arr.length === 0) {
    return "";
  }
  
  /** @type {string[]} */
  const params = [];
  
  for (let i = 0; i < arr.length; i++) {
    const param = arr[i];
    if (param.key && param.range) {
      const value = Math.floor(Math.random() * param.range) + 1;
      params.push(`${encodeURIComponent(param.key)}=${encodeURIComponent(value)}`);
    }
  }
  return params.join("&");
}

/**
 * Builds a complete URL from base URL, endpoint, and query parameters
 * @param {string} baseURL - The base URL
 * @param {string} endpoint - The endpoint path (optional)
 * @param {string} queryString - The query parameters string (optional)
 * @returns {string} Complete URL
 */
function buildURL(baseURL, endpoint, queryString) {
  let url = baseURL;
  
  if (endpoint) {
    url += `/${endpoint}`;
  }
  
  if (queryString) {
    url += `?${queryString}`;
  }
  
  return url;
}

/**
 * Creates request headers for outgoing requests
 * @returns {HeadersInit} Request headers object
 */
function createRequestHeaders() {
  /** @type {HeadersInit} */
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'CronJob/1.0.0'
  };
  
  if (clientAuthToken) {
    headers['Authorization'] = clientAuthToken.startsWith('Bearer ') 
      ? clientAuthToken 
      : `Bearer ${clientAuthToken}`;
  }
  
  return headers;
}

/**
 * Executes a cron job request
 * @returns {Promise<{success: boolean, url: string, status: number, error?: string}>}
 */
async function executeCronJob() {
  try {
    const endpoint = getRandomEndpoint(endpoints);
    const queryString = getRandomQueryParams(queryParams);
    const url = buildURL(baseURL, endpoint, queryString);
    
    console.log(`Making request to: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: createRequestHeaders()
    });
    
    console.log(`${response.url} - ${response.status} ${response.statusText}`);
    
    return {
      success: response.ok,
      url: response.url,
      status: response.status
    };
  } catch (error) {
    console.error("Error making request:", error.message);
    return {
      success: false,
      url: '',
      status: 0,
      error: error.message
    };
  }
}

// Middleware
app.use(express.json());

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Protected endpoint to manually trigger cron job
app.post('/trigger', authenticateRequest, async (req, res) => {
  const result = await executeCronJob();
  res.json({
    message: 'Cron job triggered manually',
    result,
    timestamp: new Date().toISOString()
  });
});

// Protected endpoint to get cron job status
app.get('/status', authenticateRequest, (req, res) => {
  res.json({
    cronTimer,
    baseURL,
    endpointsCount: endpoints.length,
    queryParamsCount: queryParams.length,
    hasClientAuth: !!clientAuthToken,
    timestamp: new Date().toISOString()
  });
});

// Start the scheduled cron job
cron.schedule(cronTimer, executeCronJob);

// Start the server
app.listen(PORT, () => {
  console.log(`Cron server running on port ${PORT}`);
  console.log(`Cron scheduled with timer: ${cronTimer}`);
  console.log(`Authentication required for protected endpoints`);
});