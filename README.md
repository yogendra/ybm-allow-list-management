# YugabyteDB Managed - Allow List Management

This module can help in dynamically updating allow list in case of serverless /
PaaS environments where egress IPs are dynamic.

This is developed particularly to support accessing
[YugabyteDB Managed](https://cloud.yugabte.com) instance from [fly.to]. This uses
[YBM APIs](https://api-docs.yugabyte.com/docs/managed-apis) to update the
network allow list at runtime

# Example

```js
// TBA
```

## Test Commands

Add following environment variables:

- `YBM_API_KEY` - YugabyteDB Managed - Api Key
- `YBM_ENDPOINT` - YugabyteDB Managed - Endpoint URL [https://cloud.yugabyte.com/api]
- `YBM_ACCOUNT_ID` - YugabyteDB Managed - Account ID
- `YBM_PROJECT_ID` - YugabyteDB Managed - Project ID
- `YBM_CLUSTER_ID` - YugabyteDB Managed - Cluster ID  (testing only)

```bash

curl --request PUT \
      --url "$YBM_ENDPOINT/public/v1/accounts/$YBM_ACCOUNT_ID/projects/$YBM_PROJECT_ID/clusters/$YBM_CLUSTER_ID/allow-lists" \
      --header "Authorization: Bearer $YBM_API_KEY" \
      --header 'Content-Type: application/json' \
      --data '["08ba2e01-2ae6-4aa1-b13a-1c9c7ada3383","72f2ebc5-45a8-45ac-bd8a-fcc25b315aa9","89f94942-cd7a-4ece-a46b-498ede1cffab"]'
```
