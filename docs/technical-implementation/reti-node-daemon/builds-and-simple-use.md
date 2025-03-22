# Builds and simple use

## Binary Images

See the [releases](https://github.com/algorandfoundation/reti/releases) on GitHub. For each release, binaries for the node daemon are compiled into archives for every platform, Windows, Linux, and OSX and for amd64 and arm64 architectures.

The included reti binary can be placed anywhere and run interactively, or ultimately, run as a background service using the 'daemon' command.

## Docker Images

Every release will build a versioned image of the go binary in a mulitple platform Docker image, building for linux/amd64, and linux/arm64.

Each version will push tags for:

* {major}.{minor}.{patch}
* {major}.{minor}
* latest

See the Reti images in [Docker Hub](https://hub.docker.com/r/algorandfoundation/reti/tags)

Simple example of running docker image locally, getting mnemonics and from local .env file. In this case, explicitly passing the network, validator, and node number as command line arguments, and listing all pools for that validator with basic pool information.

{% code fullWidth="false" %}
```
docker run --env-file .env.testnet algorandfoundation/reti:latest -network testnet -validator 1 -node 1 p list -all
```
{% endcode %}
