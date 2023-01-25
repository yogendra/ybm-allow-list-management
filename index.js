import YBMClient from './ybm-client'

const config = {
  accountId: process.env.YBM_ACCOUNT_ID,
  projectId: process.env.YBM_PROJECT_ID,
  apiKey: process.env.YBM_API_KEY,
  postUpdateQueryRetry: process.env.YBM_POST_UPDATE_QUERY_RETRY || 30
}

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
  const prefixRegex = new RegExp(`^${prefix}--v(\\d+)\\$`)

  let nextNumber = 1
  let newAllowList = Array.isArray(cidrOrIpList) ? cidrOrIpList : [cidrOrIpList]
  let latestAllowList
  let clusterIds = clusterId !== null ? [clusterId] : []
  console.info(`Update allow list with prefix ${prefix} to include cidr ${newAllowList.join(',')}`)

  let existingLists = await getAllowListByName(prefixRegex)

  const existingListIds = existingLists.map(x => x.info.id).sort()
  if (Array.isArray(existingLists) && existingLists.length > 0) {
    console.debug('Found existing allow list with prefix')
    existingLists = existingLists.sort((a, b) => {
      // Sort descending based on index
      const indexA = +prefixRegex.exec(a.spec.name)[1]
      const indexB = +prefixRegex.exec(b.spec.name)[1]
      return indexB - indexA
    })

    latestAllowList = existingLists[0]
    console.info(`Latest allow list: id: ${latestAllowList.info.id}, name: ${latestAllowList.spec.name}`)
    const clusterIdPresent = clusterId === null || latestAllowList.info.cluster_ids.includes(clusterId)
    const allCidrsPresent = newAllowList.every(x => latestAllowList.spec.allow_list.includes(x))
    if (clusterIdPresent && allCidrsPresent) {
      console.info(`Skipping updated all as cluster (${clusterId}) and CIDRs (${newAllowList.join(',')}) present`)
      return latestAllowList
    }
    clusterIds = clusterIds.concat(latestAllowList.info.cluster_ids)
    nextNumber = ++prefixRegex.exec(latestAllowList.spec.name)[1]
    newAllowList = newAllowList.concat(latestAllowList.spec.allow_list).sort()
      .filter((v, i, a) => a.indexOf(v) === i) // uniq element trick
  }

  const name = `${prefix}--v${nextNumber}`
  const description = `Allow list for ${newAllowList.join(',')}`

  console.info(`Create a new allow list: name: ${name}, description: ${description}, allow list: ${newAllowList.join(',')}`)
  const updatedList = await createAllowList(name, description, newAllowList)
  const updatedListId = updatedList.data.info.id

  console.info(`Created allow list: id: ${updatedListId}`)
  const updatedClusterAllowLists = await Promise.all(clusterIds.map(async (id) => {
    const currentClusterAllowListIds = await getClusterAllowListIds(id)
    const updatedClusterAllowListIds = currentClusterAllowListIds.filter(x => existingListIds.indexOf(x) === -1)
    updatedClusterAllowListIds.push(updatedListId)
    console.info(`Update allow list for cluster (${id}) to (${updatedClusterAllowListIds.join(',')})`)
    return await updateClusterAllowLists(id, updatedClusterAllowListIds)
  }))
  console.info(`Clusters (${clusterIds.join(',')} (responses: ${updatedClusterAllowLists.length}))`)
  return await getAllowList(updatedListId)
}

const ybm = new YBMClient(config.apiKey, config.accountId, config.projectId)

async function getAllowListByName (regex) {
  const path = '/allow-lists'
  const params = {
    order_by: 'name',
    limit: '1000',
    is_auto_created: 'false'
  }

  const response = await ybm.get(path, params)
  return response.data.filter(x => regex.test(x.spec.name))
}

async function getClusterAllowListIds (id) {
  console.info(`getClusterAllowListIds - Fetch allow list ids for cluster (${id})`)
  const path = `/clusters/${id}/allow-lists`
  const allowList = await ybm.get(path)
  return allowList.data.map(x => x.info.id).sort()
}

async function createAllowList (name, description, cidrOrIpList) {
  const allowList = Array.isArray(cidrOrIpList) ? cidrOrIpList : [cidrOrIpList]
  console.info(`createAllowList - name: ${name}, desc: ${description}, allowList: ${allowList}`)
  const path = '/allow-lists'
  const body = {
    name,
    description,
    allow_list: allowList
  }
  return ybm.post(path, body)
}

async function updateClusterAllowLists (clusterId, allowListIds) {
  const path = `/clusters/${clusterId}/allow-lists`
  const param = allowListIds.sort()
  const response = await ybm.put(path, param)
  let updatedAllowListIds = response.data.map(x => x.info.id).sort()
  /*
  Actual update take a few seconds to go through, so we need to check the response
  for the current ids. And in case the ids are not upto date, we need to make
  few tries (10) to check if the change succeeded.
  There could be concurrent updates so, we just check if all the list ids we sent
  are present in the cluster's allow list.
  */
  let updateComplete = param.every(v => updatedAllowListIds.includes(v))
  if (updateComplete) {
    return response
  }
  let retry = 1
  while (retry <= config.postUpdateQueryRetry) {
    sleep(1)
    console.debug(`Retry count: ${retry} => Check for cluster allow list update`)
    updatedAllowListIds = await getClusterAllowListIds(clusterId)
    updateComplete = param.every(v => updatedAllowListIds.includes(v))
    if (updateComplete) {
      return response
    }
    ++retry
  }
  console.error('updateClusterAllowLists - exhausted retries')
  throw new Error(`Update allow list (${param}) failed for cluster (${clusterId})`)
}

async function getAllowList (id) {
  const path = `/allow-lists/${id}`
  const response = await ybm.get(path, {})
  return response.data
}

async function sleep (seconds) {
  return await new Promise((resolve, reject) => { setTimeout(resolve, seconds * 1000) })
}
