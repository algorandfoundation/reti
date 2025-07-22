# Staking Pools

**Pool Creation:** Validators have the ability to create new staking pools on each node, up to a defined limit. Each pool originates as a unique staking pool contract, created by the master Validator contract from a pre-defined template. This ensures each pool operates as a distinct Algorand account eligible for consensus participation.

**Stake Addition:** Users participate by directing their stake to specific validators, chosen by ID through the master validator contract. The system intelligently allocates the user's stake to the appropriate pool within the chosen validator's portfolio. If the staker is already in a particular pool for that validator, their stake will be added there first unless the pool is full.

Pools are considered full based on taking the LESSER of:

* 15% of online stake / number of pools
* The max Algo per account allowed that still receives incentive rewards.

No new stake can be added to a validator if the total Algo staked across all of the validators pools reaches 15% of online stake.

**Ledger System:** A comprehensive ledger within each pool tracks up to 200 stakers. This ledger records crucial details such as the staker's account, the timing of their stake entry, the amount staked, and accumulated rewards. The design of the ledger aims to:

* Prevent manipulation of reward distribution by adjusting entry times to neutralize advantage gained from last-minute large stakes.
* Provide transparency through on-chain visibility of all staker data and their compounded balances.
* Encourage a broad distribution of stakes and prevent minimal contributions by setting a minimum stake requirement (e.g., 1,000 ALGO), which guards against the dilution of pool value and competitive disruptions.
* Ensure that large numbers of stakers forces more pools to be created, forcing more nodes, and ultimately, more validators.

**Payout Mechanism:** Rewards are computed based on the pool's current total balance. A defined percentage is allocated to the validator as commission, with the remaining balance compounded and distributed among stakers. This calculation takes into account the duration of each staker's participation within the payout epoch, ensuring a fair reward system that reflects the staker's commitment to the pool. Find more about the payout mechanism in [Rewards](rewards.md).
