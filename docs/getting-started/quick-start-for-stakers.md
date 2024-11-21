# Quick Start For Stakers

The Staking Dashboard is where you can manage your stake in various validators.

<figure><img src="../.gitbook/assets/image (6).png" alt=""><figcaption><p>Staking Dashboard</p></figcaption></figure>

## Comparing Validators

Validators are not all created equal! They can vary greatly in their performance, incentives, fees, payout frequency, and restrictions. It's important to do due diligence on each Validator before attempting to stake. These details can be found in the Validator details page, which can be navigated to by clicking the Validator's NFD or wallet address.

**Performance**

If a node is slow and missing votes, those rewards are 'missed', resulting in a lower yield than if it was a healthy node participating with the same stake. Slow nodes are not 'doing their job' and so they aren't rewarded. The APY displayed is calculated on-chain and will reflect a Validator's past performance.

**Incentives**

Some pools have extra token rewards distributed to stakers on top of the ALGO received from participating in consensus. If these extra rewards have any market value, these pools could be providing higher yield than pools without extra rewards. It's important to always do due diligence on any validator incentives.&#x20;

**Fees**

Validators can set a commission rate which is paid out as a percentage of rewards every epoch. The record is stored in the Validator record and is immutable.

**Payout Frequency**

The frequency which epochs occur may effect the yield received due to txn fees and compounding returns.

**Restrictions**

Validator's may have restrictions set on their pools including:

* Min entry amount
* Token / NFD Gating:
  * Supported gating options include:
    * Tokens/NFTs by creator and minimum amount
    * Specific ASA ID
    * Tokens/NFTs created by any address linked within a particular NFD
    * Owning a segment of a particular NFD Root

## Staking

To stake, find the Validator you want to stake with and select 'Stake'.

<figure><img src="../.gitbook/assets/image (7).png" alt=""><figcaption><p>Staking Modal</p></figcaption></figure>

Enter at least the minimum entry amount of ALGO and sign the transaction.

You will now be able to see your staked amount with that Validator in the 'My Stakes' section at the top of the dashboard.

## Unstaking

To unstake, find the Validator you want to unstake with in the 'Staked' section, and select 'Unstake'.

When specifying the amount to unstake, it must be above the minimum entry amount, or the entire amount.
