# Docker Compose

Here's one users example docker compose file used for testing:

```yaml
services:
  algorand-testnet:
    image: algorand/algod:latest
    hostname: <if desired>
    restart: always
    ports:
      - "14190:8080"
      - "14191:4191"
    environment:
      - NETWORK=testnet
      - FAST_CATCHUP=1
      - TELEMETRY_NAME=<if desired>
      - ADMIN_TOKEN=<A random API key, should be able to use something like https://numbergenerator.org/random-64-digit-hex-codes-generator>
    volumes:
      - ./data:/algod/data

  reti-testnet:
    image: algorandfoundation/reti:latest
    ports:
      - 6260:6260
    environment:
      - RETI_VALIDATORID=<validator ID assigned to you>
      - RETI_NODENUM=1
      - ALGO_NETWORK=testnet
      - ALGO_ALGOD_URL=http://algorand-testnet:8080
      - ALGO_ALGOD_TOKEN=<Same token provided to the Algorand container.>
      - TEST_MNEMONIC=<The mnemonic of the account used when setting up the validator, note this account will need a few algos to cover fees.>
    volumes:
      - ./data:/algod/data
    command: "daemon"
```
