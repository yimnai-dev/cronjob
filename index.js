import "dotenv/config";
import cron from "node-cron";

const cronTimer = process.env.CRON_TIMER;
const baseURL = process.env.BASE_URL;
const endpoints = JSON.parse(process.env.ENDPOINTS);
const queryParams = JSON.parse(process.env.QUERY_PARAMS);

function getRandomEndpoint(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomQueryParams(arr) {
  let query = "";
  for (let i = 0; i < arr.length; i++) {
    query += `${arr[i].key}=${Math.floor(Math.random() * arr[i].range) + 1}&`;
  }
  return query;
}

cron.schedule(cronTimer, async () => {
  const url = `${baseURL}/${getRandomEndpoint(
    endpoints
  )}?${getRandomQueryParams(queryParams)}`;
  const response = await fetch(url);
  console.log(response.url + " - " + response.status);
});
