# Running examples

## Values always needing set

* The Algorand node to connect to.
  * Set via **ALGORAND\_DATA** env var (if localhost), or **ALGO\_ALGOD\_URL** env variable.
  * This should be a full URL, ie: [http://localhost:8080](http://localhost:8080)
* The Algod ADMIN token for that node.
  * Set via **ALGO\_ALGOD\_TOKEN** (must be set to the ADMIN token of the server !)
  * This is the value set/found in the algod.admin.token file inside the data directory on the Algorand node you're using for each node.
* Your Validator ID
  * Set via **RETI\_VALIDATORID** env variable or -validator XX CLI flag.
* The Node number this instance should represent. You run 1 instance of the Reti daemon per 'node' which is an completely independent Algorand node instance.
  * Set via **RETI\_NODENUM** ev variable of -node XX CLI FLAG
* Mnenonics for the Manager account of your validator (the validator ID).
  * Set via XXXX\_MNEMONIC (any prefix followed by \_MNEMONIC) environment variable.
* All environment values can be stored in .env files as well.

For more information on the various configuration values see [configuration.md](../configuration.md "mention")

## Docker Images

Use algorandfoundation/reti:latest for the latest released version or a specific version can be specified as well. See [https://hub.docker.com/r/algorandfoundation/reti/tags](https://hub.docker.com/r/algorandfoundation/reti/tags)

A simple example:

```
docker run --env-file .env algorandfoundation/reti:latest d
```

Also see a docker compose example here: [docker-compose.md](docker-compose.md "mention")

## SystemD daemon

See [systemd-daemon.md](systemd-daemon.md "mention")for an example systemd configuration file.

## Running from command-line or as background process

Assuming your Algorand node is on the same machine, and assuming the **ALGORAND\_DATA** environment variable is set, then the Reti daemon will automatically get the URL of the algod HTTP API as well as the Admin token from the directory (via the algod.net and algod.admin.token files)

In this example, the validator ID is 1, but it needs to be the validator ID allocated when you added yourself as a validator.

```sh
./reti -validator 1 -node 1 daemon
```
