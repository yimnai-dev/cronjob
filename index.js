import "dotenv/config";
import cron from "node-cron";

/**
 * @typedef {Object} QueryParam
 * @property {string} key - The parameter key
 * @property {string|number} value - The parameter value
 */

// Validate required environment variables
/** @type {string} */
const cronTimer = process.env.CRON_TIMER;
/** @type {string} */
const baseURL = process.env.BASE_URL;
/** @type {string|undefined} */
const cronSecret = process.env.CRON_SECRET;

if (!cronTimer || !baseURL) {
  console.error("Missing required environment variables: CRON_TIMER and BASE_URL");
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
 * Gets all endpoints from the provided array
 * @param {string[]} arr - Array of endpoint strings
 * @returns {string[]} All endpoints or empty array if none provided
 */
function getAllEndpoints(arr) {
  if (!arr || arr.length === 0) {
    return [];
  }
  return arr;
}

/**
 * Builds query parameters from the provided configuration
 * @param {QueryParam[]} arr - Array of query parameter configurations
 * @returns {string} URL-encoded query string without leading '?'
 */
function buildQueryParams(arr) {
  if (!arr || arr.length === 0) {
    return "";
  }
  
  /** @type {string[]} */
  const params = [];
  
  for (let i = 0; i < arr.length; i++) {
    const param = arr[i];
    if (param.key && param.value !== undefined && param.value !== null) {
      params.push(`${encodeURIComponent(param.key)}=${encodeURIComponent(param.value)}`);
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
  
  // Add endpoint if it exists
  if (endpoint) {
    url += `/${endpoint}`;
  }
  
  // Add query parameters only if they exist
  if (queryString) {
    url += `?${queryString}`;
  }
  
  return url;
}

/**
 * Creates request headers including secret token if provided
 * @returns {HeadersInit} Request headers object
 */
function createRequestHeaders() {
  /** @type {HeadersInit} */
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'CronJob/1.0.0'
  };
  
  // Add secret token if provided
  if (cronSecret) {
    headers['X-Cron-Secret'] = cronSecret;
  }
  
  return headers;
}

/**
 * Makes a request to a specific endpoint with query parameters
 * @param {string} endpoint - The endpoint to call
 * @returns {Promise<void>}
 */
async function makeRequest(endpoint) {
  try {
    const queryString = buildQueryParams(queryParams);
    const url = buildURL(baseURL, endpoint, queryString);
    
    console.log(`Making request to: ${url}`);
    
    /** @type {Response} */
    const response = await fetch(url, {
      method: 'GET',
      headers: createRequestHeaders()
    });
    
    console.log(`${response.url} - ${response.status} ${response.statusText}`);
  } catch (error) {
    console.error(`Error making request to ${endpoint}:`, error.message);
  }
}

/**
 * Cron job that makes HTTP requests to all provided endpoints with provided query parameters
 */
cron.schedule(cronTimer, async () => {
  const endpointsToCall = getAllEndpoints(endpoints);
  
  if (endpointsToCall.length === 0) {
    console.log("No endpoints configured - skipping cron run");
    return;
  }
  
  console.log(`Starting cron job - calling ${endpointsToCall.length} endpoint(s)`);
  if (queryParams.length > 0) {
    console.log(`Using ${queryParams.length} query parameter(s)`);
  }
  
  // Call all endpoints
  const requests = endpointsToCall.map(endpoint => makeRequest(endpoint));
  
  // Wait for all requests to complete
  await Promise.allSettled(requests);
  
  console.log(`Cron job completed - called ${endpointsToCall.length} endpoint(s)`);
});
