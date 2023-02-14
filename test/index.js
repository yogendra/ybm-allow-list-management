/* eslint-disable no-unused-expressions */
/**
 * Preparation
 * 1. Create a cluster
 * 2. Set Env vars : YBM_API_KEY, YBM_PROJECT_ID, YBM_ACCOUNT_ID, YBM_CLUSTER_ID
 */

const { describe, before, after, it } = require('mocha')
const should = require('chai').should()
const { expect, assert } = require('chai')

const update = require('../index').update
const { debug } = require('../util')
const testConfig = require('./test-config')
const deleteTestData = require('./test-data')

before('Before Tests - Delete All Test Data', async function () {
  this.timeout(60000)
  await deleteTestData()
})
after('After Tests - Delete All Test Data', async function () {
  this.timeout(60000)
  await deleteTestData()
})
describe('Allow List', function () {
  this.timeout(60000)
  it('clean test start', function () {
    assert.equal(true, true, 'test started')
  })

  let u1, u2, u3, u4

  it('Create new', async function () {
    // Create new list v1
    u1 = await update(testConfig.prefix, '127.0.0.1/32', testConfig.clusterId)
    debug(JSON.stringify(u1))
    expect(u1.info.id).to.exist
    expect(u1.info.cluster_ids).to.include(testConfig.clusterId)
    expect(u1.spec.name).to.equal(testConfig.prefix + '--v1')
    expect(u1.spec.allow_list).to.include('127.0.0.1/32')
  })

  it('Update IP', async function () {
  // Update list, new version, copy over associations
    u2 = await update(testConfig.prefix, '127.0.0.2/32')
    expect(u2.info.id).to.exist
    expect(u2.info.cluster_ids).to.include(testConfig.clusterId)
    expect(u2.spec.name).to.equal(testConfig.prefix + '--v2')
    expect(u2.spec.allow_list).to.include('127.0.0.1/32')
    expect(u2.spec.allow_list).to.include('127.0.0.2/32')
  })

  it('Update duplicate IP (no-op)', async function () {
  // Skip duplicate updates
    u3 = await update(testConfig.prefix, '127.0.0.2/32')
    expect(u3.info.id).to.exist
    expect(u3.info.id).to.equal(u2.info.id)
    expect(u3.info.cluster_ids).to.include(testConfig.clusterId)
    expect(u3.spec.name).to.equal(u2.spec.name)
    expect(u3.spec.allow_list).to.include('127.0.0.1/32')
    expect(u3.spec.allow_list).to.include('127.0.0.2/32')
  })

  it('Update new IP', async function () {
  //
    u4 = await update(testConfig.prefix, '127.0.0.3/32')
    expect(u4.info.id).to.not.equal(u3.info.id)
    expect(u4.info.cluster_ids).to.include(testConfig.clusterId)
    expect(u4.spec.name).to.equal(testConfig.prefix + '--v3')
    expect(u4.spec.allow_list).to.include('127.0.0.1/32')
    expect(u4.spec.allow_list).to.include('127.0.0.2/32')
    expect(u4.spec.allow_list).to.include('127.0.0.3/32')
  })
})
