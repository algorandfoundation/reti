# Validators

{% hint style="info" %}
Staking pools will receive rewards when they propose blocks, **as long as they're above the 30K ALGO threshold** and below the maximum amount defined by the protocol (around 70M currently) and have good performance. If you plan to run a Validator, make sure you have a plan to get over the 30k ALGO minimum or it's unlikely people will ever stake to your Validator.
{% endhint %}

**General Process:** Anyone is able to add themselves as a Validator. The protocol has safeguards in place to ensure Validators can't amass a dangerous amount of stake in a single pool, or combined across all pools for a single Validator. It's very important that Validators take the time to understand what configurations will work best for their project before creating their Validator.

As a Validator you need to be [running a node](../resources/running-a-node.md) and the [Réti Node Daemon](../technical-implementation/reti-node-daemon/).

***

{% hint style="warning" %}
Many parameters can ONLY be set up front, when defining the validator.

Allowing them to be changed at will would be dangerous for stakers.
{% endhint %}

**Key Elements Defined by Validators:**

* **Owner Address:** Ideally, a cold-wallet address for security. &#x20;
  * ⚠️ Only set at create.
* **Management Address:** A hot-wallet address accessible by the Réti Node Daemon for operational commands. The manager account **MUST** be initially funded with a reasonable amount of ALGO. 10 ALGO is probably a good start. The manager account is what the node daemon uses to issue transactions on behalf of the validator. It issues transactions to have pools go online/offline, and most importantly, the Epoch update calls which pays the validator their commission as well compounding staker balances.
* **Commission Address:** An Algorand address designated for receiving the validator commission, changeable by the owner.
* **Epoch Length:** Frequency of payout balance adjustments (minutes, hours, days, etc.). The node daemon will honor this time and trigger the 'epoch' based on the specified schedule for all pools. The commission is paid out every epoch. **Every time the Validator runs an Epoch calculation they incur txn fees (.005-.02) which can substantially eat into the effective yield**. If a Validator is running Epoch updates every 1 minute, that's 7 - 29 ALGO per day in txn fees! &#x20;
  * ⚠️ Only set at create.
* **Commission Percentage:** Percentage the validator takes out of earned rewards per-epoch for covering operating costs.
  * ⚠️ Only set at create.
* **Minimum Entry Stake:** Establishes a lower limit for participation to avoid minimal contributions.
  * ⚠️ Only set at create.
* **Pools Per Node:** There is a hard limit of 3 pools per node but the validator can define a smaller amount as a signal of how they will run deploy and limit their pools.
  * ⚠️ Only set at create.
* **NFD ID (Optional):** For associating validators with detailed information for transparency.
* **Token / NFD Gating:** Validators can require that stakers hold certain types of assets in order to join their pools. This can be used to restrict validator pools to members of a particular community - NFT holders, special 'membership' tokens, etc. Supported options are:
  * **Tokens/NFTs** by Creator and Min amount (Optional): Can set a creator account such that all stakers must hold an ASA created by this account (w/ optional minimum amount for tokens).
    * **Specific ASA ID(s)**
      * Up to 4 different assets may be specified as gating requirements. Stakers holding any of the assets qualify. Most likely useful for gating on LP tokens from different DEXs.
    * **Tokens/NFTs created by any address linked within a particular NFD**. This is so NFT projects with multiple creation wallets can just reference their NFD and then anyone holding an asset created by any account linked w/in the NFD is eligible.
  * **Owning a segment (including via linked addresses) of a particular NFD Root.** A project could have its own project root NFD, e.g., orange.algo, barb.algo, voi.algo, etc., and specify that only people owning a segment of a specific root can join.
  * ⚠️ All of the above can only be set at create time.
* **Reward token and reward rate (Optional)** : A validator can define a token that users are awarded in addition to the ALGO they receive for being in the pool. This will allow projects to allow rewarding members their own token.
  * ⚠️ The reward token can only be set at create.  The reward rate can be changed at will. The Validator needs to fund Pool 1 with the ASA. Pool 1 will already be opted in.
* **Sunsetting information** : Validators will be able to sunset their validators, leaving guidance for stakers that they're going away or moving to a new validator configuration.
  * Stakers are prevented from adding more stake once a validator has reached its sunset time.

***

**Hard Protocol Limits**

**Maximum Stake Per Pool:** The default maximum is based on taking the LESSER of:

* 15% of online stake / number of pools
* The max Algo per account allowed that still receives incentive rewards. This amount is currently 70 million algo but will likely change over time
