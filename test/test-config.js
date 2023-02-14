
const testConfig = {
  prefix: process.env.YBM_ALLOWLIST_PREFIX,
  clusterId: process.env.YBM_CLUSTER_ID,
  accountId: process.env.YBM_ACCOUNT_ID,
  projectId: process.env.YBM_PROJECT_ID,
  apiKey: process.env.YBM_API_KEY,
  endpoint: process.env.YBM_ENDPOINT,
  maxRetry: process.env.YBM_MAX_RETRY || 30,
  retryInterval: process.env.YBM_RETRY_INTERVAL || 2
}
module.exports = testConfig
