# Quick Start For Validators

## Set Up a Node

The first step is to run a node. Find a number of different resources in [Running a Node](../resources/running-a-node.md) if you don't already have one running.

## Run the Reti Node Daemon

Validators need to run the [Reti Node Daemon](../technical-implementation/reti-node-daemon/) alongside their node.

## Define Validator

Validators can define a number of parameters - some of which are immutable. More information on each parameter can be found in [Validators](../core-concepts/validators.md).

**Mandatory Parameters**

* Thse parameters are set at creation and can never be changed once created.
  * Owner address (should be a **secure wallet!  Hardware wallet or multi-sig**) &#x20;
  * Epoch Length (Payout frequency) in rounds \[blocks]&#x20;
  * Validator commission rate&#x20;
  * Minimum amount required for staker to be in pool.
  * Number of pools per node (participation keys) - Maximum of 3
    * 8 is maximum number of nodes allowed, so if 3 pools per node is specified, 24 pools is maximum.
* Manager address (hot wallet)
* Validator fee address (account which receives commission)

**Optional Parameters**

* Link an NFD to the Validator - this enables linking certain data to their Validator details page like a profile picture and bio.
* Reward token / reward rate
* Sunsetting information
* Token / NFD Gating:
  * Supported gating options include:
    * Tokens/NFTs by creator and min amount
    * Specific ASA ID(s) \[up to 4]
    * Tokens/NFTs created by any address linked within a particular NFD.
    * Owning a segment of a particular NFD Root

### Add First Staking Pool

* Once your validator has been added, you **MUST** add a staking pool. Click the '...' to the right of your listed validator, and select 'Add Staking Pool' to add your first pool. Without a pool, users can't stake. The node number you specify is the node number the pool will be hosted and which the node daemon will manage keys for.
* See [staking-pools.md](../core-concepts/staking-pools.md "mention") for more information.
