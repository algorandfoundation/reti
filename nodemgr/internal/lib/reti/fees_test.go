package reti

import (
	"testing"

	"github.com/algorand/go-algorand-sdk/v2/client/v2/common/models"
	"github.com/algorand/go-algorand-sdk/v2/types"
)

const testMinFee = 1000

func simTxn(fee uint64, inner ...models.PendingTransactionResponse) models.PendingTransactionResponse {
	return models.PendingTransactionResponse{
		Transaction: types.SignedTxn{Txn: types.Transaction{Header: types.Header{Fee: types.MicroAlgos(fee)}}},
		InnerTxns:   inner,
	}
}

func simGroup(usage uint64, txns ...models.PendingTransactionResponse) models.SimulateTransactionGroupResult {
	group := models.SimulateTransactionGroupResult{GroupUsage: usage}
	for _, txn := range txns {
		group.TxnResults = append(group.TxnResults, models.SimulateTransactionResult{TxnResult: txn})
	}
	return group
}

func TestGroupFees(t *testing.T) {
	tests := []struct {
		name         string
		group        models.SimulateTransactionGroupResult
		wantRequired uint64
		wantLastTxn  uint64
	}{
		{
			name:         "group usage: epoch update paying a reward, gas calls pay nothing",
			group:        simGroup(4_000_000, simTxn(0), simTxn(0), simTxn(240_000, simTxn(0))),
			wantRequired: 4000,
			wantLastTxn:  4000,
		},
		{
			name:         "group usage: add stake, gas call and payment pay their own min fee",
			group:        simGroup(8_000_000, simTxn(1000), simTxn(1000), simTxn(240_000, simTxn(0, simTxn(0), simTxn(0)), simTxn(0), simTxn(0))),
			wantRequired: 8000,
			wantLastTxn:  6000,
		},
		{
			name:         "group usage: fractional usage rounds up once for the group",
			group:        simGroup(3_500_001, simTxn(0), simTxn(0), simTxn(240_000)),
			wantRequired: 3501,
			wantLastTxn:  3501,
		},
		{
			name:         "group usage wins over the transaction count",
			group:        simGroup(9_000_000, simTxn(0), simTxn(0), simTxn(240_000)),
			wantRequired: 9000,
			wantLastTxn:  9000,
		},
		{
			name:         "last txn never pays less than the min fee",
			group:        simGroup(2_000_000, simTxn(5000), simTxn(240_000)),
			wantRequired: 2000,
			wantLastTxn:  1000,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got, err := requiredGroupFee(tt.group, testMinFee); err != nil || got != tt.wantRequired {
				t.Errorf("requiredGroupFee() = %d, %v, want %d", got, err, tt.wantRequired)
			}
			if got, err := feeForLastTxn(tt.group, testMinFee); err != nil || got != tt.wantLastTxn {
				t.Errorf("feeForLastTxn() = %d, %v, want %d", got, err, tt.wantLastTxn)
			}
		})
	}
}

func TestGroupFeesWithoutGroupUsage(t *testing.T) {
	// an algod older than 5.0 reports no usage: fail rather than guess a fee
	group := simGroup(0, simTxn(0), simTxn(0), simTxn(240_000, simTxn(0)))
	if _, err := requiredGroupFee(group, testMinFee); err != errNoGroupUsage {
		t.Errorf("requiredGroupFee() error = %v, want %v", err, errNoGroupUsage)
	}
	if _, err := feeForLastTxn(group, testMinFee); err != errNoGroupUsage {
		t.Errorf("feeForLastTxn() error = %v, want %v", err, errNoGroupUsage)
	}
}
