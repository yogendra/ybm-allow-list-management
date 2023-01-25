# YugabyteDB Managed - Allow List Management

[![Build](https://github.com/yogendra/ybm-allow-list-management/actions/workflows/build.yaml/badge.svg)](https://github.com/yogendra/ybm-allow-list-management/actions/workflows/build.yaml)

This module can help in dynamically updating allow list in case of serverless /
PaaS environments where egress IPs are dynamic.

This is developed particularly to support accessing
[YugabyteDB Managed](https://cloud.yugabte.com) instance from [fly.to]. This uses
[YBM APIs](https://api-docs.yugabyte.com/docs/managed-apis) to update the
network allow list at runtime

## Features

1. Create versioned allow list
2. Easy to override or configure manually, just follow the naming conventions
3. Create new version on each run
4. Skips version creations on duplicate updates
5. Dis-associated old version from cluster.
6. Keeps existing association from older version

## Example

```js
// Make sure YBM_API_KEY. YBM_PROJECT_ID and YBM_ACCOUNT_ID are defined in the environment
import { update } from "ybm-allow-list-management";
let prefix = "myapp-allow-list"
// Find your apps egress IP
let egressIp = await fetch("https://ifconfig.me/ip",)
  .then(res => {
    return res.text();
  })
  .then(ipAddress => `${ipAddress}/32`);
// Get it from the YBM console address bar
let clusterId = '<cluster-uuid>'

console.log("Egress IP: " + egressIp);

let allowList = await update(prefix, egressIp, clusterId);
console.log("Allow list name " + allowList.spec.name);
```

Code above will go create an allow list with prefix `myapp-allow-list`. If there is any existing list matching
`myapp-allow-list--v#` format, it will create new list by addin `+1` to version. It will copy over existing
ip addresses and cluster ids from older version.

## Environment Variables

Following environment variables are used by this module

- `YBM_API_KEY` - (**Required**) YugabyteDB Managed - Api Key
- `YBM_ACCOUNT_ID` - (**Required**) YugabyteDB Managed - Account ID
- `YBM_PROJECT_ID` - (**Required**) YugabyteDB Managed - Project ID
- `YBM_ENDPOINT` - (_Optional_) YugabyteDB Managed - Endpoint URL (Default: `https://cloud.yugabyte.com/api`)
- `YBM_MAX_RETRY` - (_Optional_) Maximum retry for api requests (Default : `30`)
- `YBM_RETRY_INTERVAL` - (_Optional_) Internal (seconds) between api requests (Default : `2`)
- `YBM_CLUSTER_ID` - (_Test Only_) YugabyteDB Managed - Cluster ID
- `YBM_ALLOW_LIST_PREFIX` - (_Test Only_) Prefix for allow list name
- `NODE_ENV` - (_Test Only_) Set to `development` for debug logs

## Develop

_TBA_


## Get in Touch

Get in touch via [YugabyteDB Community Slack](https://yugabyte.com/slack)
