package reti

import (
	"errors"

	"github.com/algorand/go-algorand-sdk/v2/client/v2/common/models"
)

// microsPerFeeUnit is the scale of SimulateTransactionGroupResult.GroupUsage: millionths of a min fee.
const microsPerFeeUnit = 1_000_000

// errNoGroupUsage means algod's simulate response carried no group usage, which algod reports from 5.0.0 on.
var errNoGroupUsage = errors.New("algod did not report group usage for the simulated group; algod 5.0 or later is required")

// requiredGroupFee returns the total fee, in microAlgo, a simulated group has to pay across its outer
// transactions (the contracts send inner txns with fee 0, so the outer group pays for them).
//
// It uses algod's own figure, GroupUsage, which covers every inner transaction at any depth as well as
// size-priced transactions.
//
// This replaces the old AppBudgetAdded/700 estimate, which go-algorand #6708 (5.1.0) broke: simulate stopped
// counting payment-only inner groups as added budget, so the estimate came up one min fee short per inner
// payment (e.g. the reward payout in epochBalanceUpdate).
func requiredGroupFee(group models.SimulateTransactionGroupResult, minFee uint64) (uint64, error) {
	if group.GroupUsage == 0 {
		return 0, errNoGroupUsage
	}
	return (group.GroupUsage*minFee + microsPerFeeUnit - 1) / microsPerFeeUnit, nil
}

// feeForLastTxn returns the fee the last outer transaction of a simulated group (the method call that was
// simulated with an oversized fee) must carry for the group to cover requiredGroupFee, given what the other
// outer transactions already pay. It never returns less than minFee.
func feeForLastTxn(group models.SimulateTransactionGroupResult, minFee uint64) (uint64, error) {
	required, err := requiredGroupFee(group, minFee)
	if err != nil {
		return 0, err
	}
	var paidByOthers uint64
	for _, result := range group.TxnResults[:max(len(group.TxnResults)-1, 0)] {
		paidByOthers += uint64(result.TxnResult.Transaction.Txn.Fee)
	}
	if required < paidByOthers+minFee {
		return minFee, nil
	}
	return required - paidByOthers, nil
}
