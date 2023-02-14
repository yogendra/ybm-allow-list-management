const { sleep } = require('../util')
const YBMClient = require('../ybm-client')
const testConfig = require('./test-config')

async function deleteTestData () {
  const ybm = new YBMClient(testConfig.apiKey, testConfig.accountId, testConfig.projectId, testConfig.endpoint)

  console.info('TEST DATA Setup :: Get allow lists for an existing cluster')
  let testAllowLists = await ybm.get('/allow-lists', { limit: 1000, order_by: 'name' })
  testAllowLists = testAllowLists.data.filter(x => x.spec.name.startsWith(testConfig.prefix))
  const testAllowListIds = testAllowLists.map(x => x.info.id).sort()
  console.info('TEST DATA Setup :: Delete Test Data - Remove allow list associations')
  const clusterUpdates = testAllowLists
    .flatMap(x => x.info.cluster_ids)
    .map(async (clusterId) => {
      const currentList = (await ybm.get(`/clusters/${clusterId}/allow-lists`)).data
      const updateAllowListIds = currentList
        .filter(x => !testAllowListIds.includes(x.info.id))
        .map(x => x.info.id)
      let retry = testConfig.maxRetry
      while (--retry > 0) {
        const update = await ybm.put(`/clusters/${clusterId}/allow-lists`, updateAllowListIds)
        if (update.error) {
          console.warn(`TEST DATA Setup :: Update List Failed: ${update.error.status} - ${update.error.detail}`)
        }
        if (update.data) {
          break
        }
        await sleep(testConfig.retryInterval)
      }
      retry = testConfig.maxRetry
      while (--retry > 0) {
        const update = await ybm.get(`/clusters/${clusterId}/allow-lists`)
        const updateIds = update.data.map(x => x.info.id)
        const updateCompleted = testAllowListIds.every(x => !updateIds.includes(x))
        if (updateCompleted) {
          break
        }
        await sleep(testConfig.retryInterval)
      }
      return true
    })

  await Promise.all(clusterUpdates)

  console.info('TEST DATA Setup :: Delete tests data - allow lists')
  const deleteResponses = testAllowListIds.map(async id => {
    return ybm.delete(`/allow-lists/${id}`)
  })
  await Promise.all(deleteResponses)

  console.info('TEST DATA Setup :: Test Data Cleaned Up')
}

module.exports = deleteTestData
