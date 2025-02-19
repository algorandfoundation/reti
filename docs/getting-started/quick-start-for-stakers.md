# Quick Start For Stakers

The Staking Dashboard is where you can manage your stake in various Validators and compare various Validators.

<figure><img src="../.gitbook/assets/image (5).png" alt=""><figcaption><p>Dashboard</p></figcaption></figure>

## **Comparing Validators**

Validators are not all created equal! They can vary greatly in their performance, incentives, fees, payout frequency, and restrictions. It's important to do due diligence on each Validator before attempting to stake. These details can be found in the Validator details page, which can be navigated to by clicking the Validator's NFD or wallet address.

### **Status**

In the Status column you will see the node's performance as well as the node daemon's performance.&#x20;

If the node is performing poorly, you may be missing potential rewards, and this will result in a lower than expect APY. By hovering over the performance indicator you can see the estimated performance of the node. (this is still a work in progress and may not be 100% accurate)

If the node daemon isn't running, you will see a red circle in place of the green circle. This is to let stakers know that payouts aren't happening.

### **APY**

The estimated APY column shows the estimated cumulative APY for the Validator. (this is still a work in progress and may not be 100% accurate)

### **Incentives**

Some pools have extra token rewards distributed to stakers on top of the ALGO received from participating in consensus. If these extra rewards have any market value, these pools could be providing higher yield than pools without extra rewards. It's important to always do due diligence on any validator incentives.

### **Fees**

Validators can set a commission rate which is paid out as a percentage of rewards every epoch. The record is stored in the Validator record and is **immutable**.

### **Payout Frequency**

The frequency which epochs occur may effect the yield received due to txn fees and compounding returns. Generally, the shorter the epoch the better from a stakers perspective, but not always.

### **Restrictions**

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
