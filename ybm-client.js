import { debug } from './util.js'

export default class YBMClient {
  constructor (apiKey, accountId, projectId, endpoint) {
    const ep = endpoint || 'https://cloud.yugabyte.com/api'
    this.apiRoot = `${ep}/public/v1/accounts/${accountId}/projects/${projectId}`
    this.commonHeaders = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    }
  }

  async request (method, path, param = null, body = null, headers = null) {
    const qs =
      param !== null ? '?' + new URLSearchParams(param).toString() : ''
    const url = `${this.apiRoot}${path}${qs}`
    const options = {
      headers: { ...this.commonHeaders, ...headers },
      method,
      body: body !== null ? JSON.stringify(body) : null
    }

    return fetch(url, options)
      .catch((x) => {
        console.error(`YBM API: ${path}, error: ${x}}`)
        throw new Error(x)
      })
      .then(async (response) => {
        const contentType = response.headers.get('content-type')
        if (contentType && contentType.indexOf('application/json') !== -1) {
          return response.json()
        } else {
          debug({
            req: { url, options },
            res: { contentType },
            _tag: 'ybm-request'
          })
          return response
        }
      })
  }

  async get (path, params, headers) {
    return this.request('GET', path, params, null, headers)
  }

  async post (path, body, headers) {
    return this.request('POST', path, null, body, headers)
  }

  async put (path, body, headers) {
    return this.request('PUT', path, null, body, headers)
  }

  async delete (path, params, headers) {
    return this.request('DELETE', path, params, null, headers)
  }
}
