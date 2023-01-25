import { debug, sleep } from './util.js'
import YBMClient from './ybm-client.js'

const config = {
  accountId: process.env.YBM_ACCOUNT_ID,
  projectId: process.env.YBM_PROJECT_ID,
  apiKey: process.env.YBM_API_KEY,
  postUpdateQueryRetry: process.env.YBM_POST_UPDATE_QUERY_RETRY || 30
}
assert(config.apiKey, 'API key not set (YBM_API_KEY)')
assert(config.accountId, 'Account ID not set (YBM_ACCOUNT_ID)')
assert(config.accountId, 'Project ID not set (YBM_PROJECT_ID)')

const ybm = new YBMClient(config.apiKey, config.accountId, config.projectId)

/*
Basic Idea:
Find a lists matching a <prefix>-v<version> expression
Get the latest allow list and extract
1. version
2. associated cluster ids
3. cidr list

Prepare new allow list def
1. name = prefix + c + (version+1)
2. cidr = new cidrs + cidr list form latest allow list
3. description = "Allow list <comma-separated-cidr-list>"

Update allow list association for each of the cluster associated with latest allow list
1. get all the allow list ids from cluster
2. remove all the old allow list ids
3. add new allow list id

*/
export async function update (prefix, cidrOrIpList, clusterId = null) {
  const prefixRegex = new RegExp(`^${prefix}--v(\\d+)$`)

  let nextNumber = 1
  let newAllowList = Array.isArray(cidrOrIpList)
    ? cidrOrIpList
    : [cidrOrIpList]
  let latestAllowList
  let clusterIds = clusterId !== null ? [clusterId] : []
  debug(
    `Update allow list with prefix ${prefix} to include cidr ${newAllowList.join(
      ','
    )}`
  )

  let existingLists = await getAllowListByName(prefixRegex)

  const existingListIds = existingLists.map((x) => x.info.id).sort()
  if (Array.isArray(existingLists) && existingLists.length > 0) {
    debug('Found existing allow list with prefix')
    existingLists = existingLists.sort((a, b) => {
      // Sort descending based on index
      const indexA = +prefixRegex.exec(a.spec.name)[1]
      const indexB = +prefixRegex.exec(b.spec.name)[1]
      return indexB - indexA
    })

    latestAllowList = existingLists[0]
    debug(
      `Latest allow list: id: ${latestAllowList.info.id}, name: ${latestAllowList.spec.name}`
    )
    const clusterIdPresent =
      clusterId === null ||
      latestAllowList.info.cluster_ids.includes(clusterId)
    const allCidrsPresent = newAllowList.every((x) =>
      latestAllowList.spec.allow_list.includes(x)
    )
    if (clusterIdPresent && allCidrsPresent) {
      debug(
        `Skipping updated all as cluster (${clusterId}) and CIDRs (${newAllowList.join(
          ','
        )}) present`
      )
      return latestAllowList
    }
    clusterIds = clusterIds.concat(latestAllowList.info.cluster_ids)
    nextNumber = ++prefixRegex.exec(latestAllowList.spec.name)[1]
    newAllowList = newAllowList
      .concat(latestAllowList.spec.allow_list)
      .sort()
      .filter((v, i, a) => a.indexOf(v) === i) // uniq element trick
  }

  const name = `${prefix}--v${nextNumber}`
  const description = `Allow list for ${newAllowList.join(',')}`

  debug(
    `Create a new allow list: name: ${name}, description: ${description}, allow list: ${newAllowList.join(
      ','
    )}`
  )
  const updatedList = await createAllowList(name, description, newAllowList)
  const updatedListId = updatedList.info.id

  debug(`Created allow list: id: ${updatedListId}`)
  const updatedClusterAllowLists = await Promise.all(
    clusterIds.map(async (id) => {
      const currentClusterAllowListIds = await getClusterAllowListIds(id)
      const updatedClusterAllowListIds = currentClusterAllowListIds.filter(
        (x) => existingListIds.indexOf(x) === -1
      )
      updatedClusterAllowListIds.push(updatedListId)
      debug(
        `Update allow list for cluster (${id}) to (${updatedClusterAllowListIds.join(
          ','
        )})`
      )
      return await updateClusterAllowLists(id, updatedClusterAllowListIds)
    })
  )
  debug(
    `Clusters (${clusterIds.join(',')} (responses: ${
      updatedClusterAllowLists.length
    }))`
  )
  return await getAllowList(updatedListId)
}

async function getAllowListByName (regex) {
  const path = '/allow-lists'
  const params = {
    order_by: 'name',
    limit: '1000',
    is_auto_created: 'false'
  }

  const response = await ybm.get(path, params)
  const filteredList = response.data.filter((x) => regex.test(x.spec.name))
  debug({
    _tag: 'debug',
    _method: 'getAllowListByName',
    arguments,
    filteredList,
    ...response
  })
  return filteredList
}

async function getClusterAllowListIds (id) {
  debug(`getClusterAllowListIds - Fetch allow list ids for cluster (${id})`)
  const path = `/clusters/${id}/allow-lists`
  const response = await ybm.get(path)
  if (response.error) {
    console.warn(
      'Encountered error in get allow lists: ' + errorDetails(response)
    )
    return null
  }
  return response.data.map((x) => x.info.id).sort()
}

async function createAllowList (name, description, cidrOrIpList) {
  const allowList = Array.isArray(cidrOrIpList) ? cidrOrIpList : [cidrOrIpList]
  debug(
    `createAllowList - name: ${name}, desc: ${description}, allowList: ${allowList}`
  )
  const path = '/allow-lists'
  const body = {
    name,
    description,
    allow_list: allowList
  }
  const response = await ybm.post(path, body)
  if (
    response &&
    response.data &&
    response.data.spec &&
    response.data.info &&
    response.data.info.id
  ) {
    return response.data
  }
  debug({
    _tag: 'error',
    _method: 'createAllowList',
    _msg: 'Error to create list',
    ...response
  })
  throw new Error('Failed to create allow list')
}

async function updateClusterAllowLists (clusterId, allowListIds) {
  const path = `/clusters/${clusterId}/allow-lists`
  const param = allowListIds.sort()
  let retry = config.postUpdateQueryRetry

  while (--retry > 0) {
    const response = await ybm.put(path, param)
    if (response.data) {
      break
    }
    if (response.error) {
      console.warn(
        'Encountered error in update :' + errorDetails(response)
      )
    }
    sleep(1)
  }
  retry = config.postUpdateQueryRetry
  while (--retry > 0) {
    const ids = await getClusterAllowListIds(clusterId)
    if (ids != null && allowListIds.every((x) => ids.includes(x))) {
      return ids
    }
    sleep(1)
  }
  debug({
    _tag: 'error',
    _method: 'updateClusterAllowLists',
    _msg: 'updateClusterAllowLists'
  })
  throw new Error(
    `Failed update:  cluster(${clusterId}), allow lists:(${param})`
  )
}

async function getAllowList (id) {
  const path = `/allow-lists/${id}`
  const response = await ybm.get(path, {})
  return response.data
}
function assert (x, error) {
  if (typeof x === 'undefined' || x === null) {
    throw new Error(error)
  }
}
function errorDetails (res) {
  if (res && res.error && res.error.status && res.error.detail) {
    return `${res.error.status} - ${res.error.detail}`
  } else {
    return JSON.stringify(res)
  }
}
