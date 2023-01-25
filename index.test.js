import { jest, expect, describe, test, beforeAll, afterAll } from '@jest/globals'

/**
 * Preparation
 * 1. Create a cluster
 * 2. Set Env vars : YBM_API_KEY, YBM_PROJECT_ID, YBM_ACCOUNT_ID, YBM_CLUSTER_ID
 */

import { update } from '.'
import YBMClient from './ybm-client'
import { sleep } from './sleep'
import { debug } from './logging'

jest.setTimeout(600000)

jest.setTimeout(600000)

const testConfig = {
  prefix: process.env.YBM_ALLOWLIST_PREFIX,
  clusterId: process.env.YBM_CLUSTER_ID,
  accountId: process.env.YBM_ACCOUNT_ID,
  projectId: process.env.YBM_PROJECT_ID,
  apiKey: process.env.YBM_API_KEY,
  endpoint: process.env.YBM_ENDPOINT
}

describe('Updte Allow List', () => {
  let u1, u2, u3, u4

  beforeAll(async () => {
    await deleteTestData()
  })
  afterAll(async () => {
    await deleteTestData()
  })

  test('Create new', async () => {
    // Create new list v1
    u1 = await update(testConfig.prefix, '127.0.0.1/32', testConfig.clusterId)
    debug(JSON.stringify(u1))
    expect(u1.info.id).toBeDefined()
    expect(u1.info.cluster_ids.includes(testConfig.clusterId)).toBeTruthy()
    expect(u1.spec.name).toEqual(testConfig.prefix + '--v1')
    expect(u1.spec.allow_list.includes('127.0.0.1/32'))
  })

  test('Update IP', async () => {
    // Update list, new version, copy over associations
    u2 = await update(testConfig.prefix, '127.0.0.2/32')
    expect(u2.info.id).toBeDefined()
    expect(u2.info.cluster_ids.includes(testConfig.clusterId)).toBeTruthy()
    expect(u2.spec.name).toEqual(testConfig.prefix + '--v2')
    expect(u2.spec.allow_list.includes('127.0.0.1/32'))
    expect(u2.spec.allow_list.includes('127.0.0.2/32'))
  })

  test('Update duplicate IP (no-op)', async () => {
    // Skip duplicate updates
    u3 = await update(testConfig.prefix, '127.0.0.2/32')
    expect(u3.info.id).toBeDefined()
    expect(u3.info.id).toEqual(u2.info.id)
    expect(u3.info.cluster_ids.includes(testConfig.clusterId)).toBeTruthy()
    expect(u3.spec.name).toEqual(u2.spec.name)
    expect(u3.spec.allow_list.includes('127.0.0.1/32'))
    expect(u3.spec.allow_list.includes('127.0.0.2/32'))
  })

  test('Update new IP', async () => {
    //
    u4 = await update(testConfig.prefix, '127.0.0.3/32')
    expect(u4.info.id !== u3.info.id).toBeTruthy()
    expect(u4.info.cluster_ids.includes(testConfig.clusterId)).toBeTruthy()
    expect(u4.spec.name).toEqual(testConfig.prefix + '--v3')
    expect(u4.spec.allow_list.includes('127.0.0.1/32'))
    expect(u4.spec.allow_list.includes('127.0.0.2/32'))
    expect(u4.spec.allow_list.includes('127.0.0.3/32'))
  })
})

async function deleteTestData () {
  const ybm = new YBMClient(testConfig.apiKey, testConfig.accountId, testConfig.projectId, testConfig.endpoint)

  console.info('Get allow lists for an existing cluster')
  let testAllowLists = await ybm.get('/allow-lists', { limit: 1000, order_by: 'name' })
  testAllowLists = testAllowLists.data.filter(x => x.spec.name.startsWith(testConfig.prefix))
  const testAllowListIds = testAllowLists.map(x => x.info.id).sort()
  console.info('Delete Test Data - Remove allow list associations')
  const clusterUpdates = testAllowLists
    .flatMap(x => x.info.cluster_ids)
    .map(async (clusterId) => {
      const currentList = (await ybm.get(`/clusters/${clusterId}/allow-lists`)).data
      const updateAllowListIds = currentList
        .filter(x => !testAllowListIds.includes(x.info.id))
        .map(x => x.info.id)
      let update = await ybm.put(`/clusters/${clusterId}/allow-lists`, updateAllowListIds)
      let updateIds = update.data.map(x => x.info.id)
      let updateCompleted = testAllowListIds.every(x => !updateIds.includes(x))
      let retry = 30
      while (!updateCompleted && retry > 0) {
        await sleep(1)
        update = await ybm.get(`/clusters/${clusterId}/allow-lists`)
        updateIds = update.data.map(x => x.info.id)
        updateCompleted = testAllowListIds.every(x => !updateIds.includes(x))
        --retry
      }
      return update
    })

  await Promise.all(clusterUpdates)

  console.info('Delete tests data - allow lists')
  const deleteResponses = testAllowListIds.map(async id => {
    return ybm.delete(`/allow-lists/${id}`)
  })
  await Promise.all(deleteResponses)

  console.info('Test Data Cleaned Up')
}
