package reti

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"slices"
	"strings"
	"time"

	"github.com/algorand/go-algorand-sdk/v2/client/v2/common/models"
	"github.com/algorand/go-algorand-sdk/v2/crypto"
	"github.com/algorand/go-algorand-sdk/v2/transaction"
	"github.com/algorand/go-algorand-sdk/v2/types"

	"github.com/TxnLab/reti/internal/lib/algo"
	"github.com/TxnLab/reti/internal/lib/misc"
)

const (
	// These MUST match the contracts !
	MaxNodes        = 12
	MaxPoolsPerNode = 4
)

// ValidatorInfo is loaded at startup but also on-demand via Reti.LoadState
type ValidatorInfo struct {
	Config              ValidatorConfig
	Pools               []PoolInfo
	NodePoolAssignments NodePoolAssignmentConfig

	// A generated map of pool ID's and the App ID assigned to it - for 'our' node
	// determined via Pools and NodePoolAssignments
	LocalPools map[uint64]uint64
}

type NodeConfig struct {
	PoolAppIDs []uint64
}

type NodePoolAssignmentConfig struct {
	Nodes []NodeConfig
}

func (npac *NodePoolAssignmentConfig) AddPoolToNode(nodeNum uint64, poolAppID uint64) error {
	if len(npac.Nodes) != MaxNodes {
		return errors.New("invalid NodePoolAssignmentConfig data ! nodes list should be fixed length")
	}
	if nodeNum == 0 || int(nodeNum) > len(npac.Nodes) {
		return fmt.Errorf("invalid nodeNum value, must be between 1 and %d", MaxNodes)
	}
	// make sure the passed in poolAppID isn't set in ANY node
	for i, node := range npac.Nodes {
		if slices.Contains(node.PoolAppIDs, poolAppID) {
			return fmt.Errorf("pool app id:%d already assigned to node number:%d", poolAppID, i+1)
		}
	}
	if len(npac.Nodes[nodeNum-1].PoolAppIDs) >= MaxPoolsPerNode {
		return fmt.Errorf("node number:%d is full", nodeNum)
	}
	npac.Nodes[nodeNum-1].PoolAppIDs = append(npac.Nodes[nodeNum-1].PoolAppIDs, poolAppID)
	return nil
}

type ValidatorConfig struct {
	// ID of this validator (sequentially assigned)
	ID uint64
	// Account that controls config - presumably cold-wallet
	Owner string
	// Account that triggers/pays for payouts and keyreg transactions - needs to be hotwallet as node has to sign for the transactions
	Manager string
	// Optional NFD AppID which the validator uses to describe their validator pool
	NFDForInfo uint64

	// MustHoldCreatorNFT specifies an optional creator address for assets which stakers must hold.  It will be the
	// responsibility of the staker (txn composer really) to pick an asset to check that meets the criteria if this
	// is set
	MustHoldCreatorNFT string

	// CreatorNFTMinBalance specifies a minimum token base units amount needed of an asset owned by the specified
	// creator (if defined).  If 0, then they need to hold at lest 1 unit, but its assumed this is for tokens, ie: hold
	// 10000[.000000] of token
	CreatorNFTMinBalance uint64

	// Reward token ASA ID and reward rate (Optional): A validator can define a token that users are awarded in addition to
	// the ALGO they receive for being in the pool. This will allow projects to allow rewarding members their own
	// token.  Hold at least 5000 VEST to enter a Vestige staking pool, they have 1 day epochs and all
	// stakers get X amount of VEST as daily rewards (added to stakers ‘available’ balance) for removal at any time.
	RewardTokenID   uint64
	RewardPerPayout uint64

	// Payout frequency in minutes (can be no shorter than this)
	PayoutEveryXMins int
	// Payout percentage expressed w/ four decimals - ie: 50000 = 5% -> .0005 -
	PercentToValidator int
	// account that receives the validation commission each epoch payout (can be ZeroAddress)
	ValidatorCommissionAddress string
	// minimum stake required to enter pool - but must withdraw all if want to go below this amount as well(!)
	MinEntryStake uint64
	// maximum stake allowed per pool (to keep under incentive limits)
	MaxAlgoPerPool uint64
	// Number of pools to allow per node (max of 3 is recommended)
	PoolsPerNode int

	SunsettingOn uint64 // timestamp when validator will sunset (if != 0)
	SunsettingTo uint64 // validator ID that validator is 'moving' to (if known)

}

func ValidatorConfigFromABIReturn(returnVal any) (*ValidatorConfig, error) {
	if arrReturn, ok := returnVal.([]any); ok {
		if len(arrReturn) != 16 {
			return nil, fmt.Errorf("should be 10 elements returned in ValidatorConfig response")
		}
		pkAsString := func(pk []uint8) string {
			addr, _ := types.EncodeAddress(pk)
			return addr
		}
		config := &ValidatorConfig{}
		config.ID = arrReturn[0].(uint64)
		config.Owner = pkAsString(arrReturn[1].([]uint8))
		config.Manager = pkAsString(arrReturn[2].([]uint8))
		config.NFDForInfo = arrReturn[3].(uint64)
		config.MustHoldCreatorNFT = pkAsString(arrReturn[4].([]uint8))
		config.CreatorNFTMinBalance = arrReturn[5].(uint64)
		config.RewardTokenID = arrReturn[6].(uint64)
		config.RewardPerPayout = arrReturn[7].(uint64)
		config.PayoutEveryXMins = int(arrReturn[8].(uint16))
		config.PercentToValidator = int(arrReturn[9].(uint32))
		config.ValidatorCommissionAddress = pkAsString(arrReturn[10].([]uint8))
		config.MinEntryStake = arrReturn[11].(uint64)
		config.MaxAlgoPerPool = arrReturn[12].(uint64)
		config.PoolsPerNode = int(arrReturn[13].(uint8))
		config.SunsettingOn = arrReturn[14].(uint64)
		config.SunsettingTo = arrReturn[15].(uint64)
		return config, nil
	}
	return nil, fmt.Errorf("unknown value returned from abi, type:%T", returnVal)
}

func formattedMinutes(mins int) string {
	// return a string expression of minutes in various forms (if applicable)
	// minutes, hours, days
	var out strings.Builder
	if mins < 60 {
		out.WriteString(fmt.Sprintf("%d minutes", mins))
	} else if mins < 1440 {
		hours := mins / 60
		minutes := mins % 60
		out.WriteString(fmt.Sprintf("%d hours, %d minutes", hours, minutes))
	} else {
		days := mins / 1440
		hours := (mins % 1440) / 60
		minutes := (mins % 1440) % 60
		out.WriteString(fmt.Sprintf("%d days, %d hours, %d minutes", days, hours, minutes))
	}
	return out.String()
}

func (v *ValidatorConfig) String() string {
	var out strings.Builder

	out.WriteString(fmt.Sprintf("ID: %d\n", v.ID))
	out.WriteString(fmt.Sprintf("Owner: %s\n", v.Owner))
	out.WriteString(fmt.Sprintf("Manager: %s\n", v.Manager))
	out.WriteString(fmt.Sprintf("Validator Commission Address: %s\n", v.ValidatorCommissionAddress))
	out.WriteString(fmt.Sprintf("%% to Validator: %.04f\n", float64(v.PercentToValidator)/10_000.0))
	if v.NFDForInfo != 0 {
		out.WriteString(fmt.Sprintf("NFD ID: %d\n", v.NFDForInfo))
	}
	if v.MustHoldCreatorNFT != types.ZeroAddress.String() {
		out.WriteString(fmt.Sprintf("Reward Token Creator Reqd: %s\n", v.MustHoldCreatorNFT))
		out.WriteString(fmt.Sprintf("Reward Token Min Bal: %d\n", v.CreatorNFTMinBalance))
		out.WriteString(fmt.Sprintf("Reward Token ID: %d\n", v.RewardTokenID))
		out.WriteString(fmt.Sprintf("Reward Per Payout: %d\n", v.RewardPerPayout))
	}

	out.WriteString(fmt.Sprintf("Payout Every %s\n", formattedMinutes(v.PayoutEveryXMins)))
	out.WriteString(fmt.Sprintf("Min Entry Stake: %s\n", algo.FormattedAlgoAmount(v.MinEntryStake)))
	out.WriteString(fmt.Sprintf("Max Algo Per Pool: %s\n", algo.FormattedAlgoAmount(v.MaxAlgoPerPool)))
	out.WriteString(fmt.Sprintf("Max Pools per Node: %d\n", v.PoolsPerNode))
	if v.SunsettingOn != 0 {
		out.WriteString(fmt.Sprintf("Sunsetting On: %s\n", time.Unix(int64(v.SunsettingOn), 0).Format(time.RFC3339)))
		if v.SunsettingTo != 0 {
			out.WriteString(fmt.Sprintf("Sunsetting To: %d\n", v.SunsettingTo))
		}
	}

	return out.String()
}

type ValidatorCurState struct {
	NumPools        int    // current number of pools this validator has - capped at MaxPools
	TotalStakers    uint64 // total number of stakers across all pools
	TotalAlgoStaked uint64 // total amount staked to this validator across ALL of its pools
}

func (v *ValidatorCurState) String() string {
	return fmt.Sprintf("NumPools: %d, TotalStakers: %d, TotalAlgoStaked: %d", v.NumPools, v.TotalStakers, v.TotalAlgoStaked)
}

func ValidatorCurStateFromABIReturn(returnVal any) (*ValidatorCurState, error) {
	if arrReturn, ok := returnVal.([]any); ok {
		if len(arrReturn) != 3 {
			return nil, fmt.Errorf("should be 3 elements returned in ValidatorCurState response")
		}
		state := &ValidatorCurState{}
		state.NumPools = int(arrReturn[0].(uint16))
		state.TotalStakers = arrReturn[1].(uint64)
		state.TotalAlgoStaked = arrReturn[2].(uint64)

		return state, nil
	}
	return nil, fmt.Errorf("unknown value returned from abi, type:%T", returnVal)
}

type ValidatorPoolKey struct {
	ID        uint64 // 0 is invalid - should start at 1 (but is direct key in box)
	PoolID    uint64 // 0 means INVALID ! - so 1 is index, technically of [0]
	PoolAppID uint64
}

func (v *ValidatorPoolKey) String() string {
	return fmt.Sprintf("ValidatorPoolKey{ID: %d, PoolID: %d, PoolAppID: %d}", v.ID, v.PoolID, v.PoolAppID)
}

func ValidatorPoolKeyFromABIReturn(returnVal any) (*ValidatorPoolKey, error) {
	if arrReturn, ok := returnVal.([]any); ok {
		if len(arrReturn) != 3 {
			return nil, fmt.Errorf("should be 3 elements returned in ValidatorPoolKey response")
		}
		key := &ValidatorPoolKey{}
		key.ID = arrReturn[0].(uint64)
		key.PoolID = arrReturn[1].(uint64)
		key.PoolAppID = arrReturn[2].(uint64)

		return key, nil
	}
	return nil, errCantFetchPoolKey
}

type PoolInfo struct {
	PoolAppID       uint64 // The App ID of this staking pool contract instance
	TotalStakers    int
	TotalAlgoStaked uint64
}

func ValidatorPoolsFromABIReturn(returnVal any) ([]PoolInfo, error) {
	var retPools []PoolInfo
	if arrReturn, ok := returnVal.([]any); ok {
		for _, poolInfoAny := range arrReturn {
			if poolInfo, ok := poolInfoAny.([]any); ok {
				if len(poolInfo) != 3 {
					return nil, fmt.Errorf("should be 3 elements returned in PoolInfo response")
				}
				retPools = append(retPools, PoolInfo{
					PoolAppID:       poolInfo[0].(uint64),
					TotalStakers:    int(poolInfo[1].(uint16)),
					TotalAlgoStaked: poolInfo[2].(uint64),
				})
			}
		}
		return retPools, nil
	}
	return retPools, errCantFetchPoolKey
}

func ValidatorPoolInfoFromABIReturn(returnVal any) (*PoolInfo, error) {
	if arrReturn, ok := returnVal.([]any); ok {
		if len(arrReturn) != 3 {
			return nil, fmt.Errorf("should be 3 elements returned in PoolInfo response")
		}
		key := &PoolInfo{}
		key.PoolAppID = arrReturn[0].(uint64)
		key.TotalStakers = int(arrReturn[1].(uint16))
		key.PoolAppID = arrReturn[2].(uint64)

		return key, nil
	}
	return nil, errCantFetchPoolKey
}

func (r *Reti) AddValidator(info *ValidatorInfo, nfdName string) (uint64, error) {
	var err error

	params, err := r.algoClient.SuggestedParams().Do(context.Background())
	if err != nil {
		return 0, err
	}

	ownerAddr, _ := types.DecodeAddress(info.Config.Owner)
	managerAddr, _ := types.DecodeAddress(info.Config.Manager)
	commissionAddr, _ := types.DecodeAddress(info.Config.ValidatorCommissionAddress)
	mustHoldCreatorAddr, _ := types.DecodeAddress(info.Config.MustHoldCreatorNFT)

	// first determine how much we have to add in MBR to the validator
	mbrs, err := r.getMbrAmounts(ownerAddr)
	if err != nil {
		return 0, err
	}

	// Now try to actually create the validator !!
	atc := transaction.AtomicTransactionComposer{}

	addValidatorMethod, err := r.validatorContract.GetMethodByName("addValidator")
	if err != nil {
		return 0, err
	}
	// We need to set all the box references ourselves still in go, so we need the id of the 'next' validator
	// We'll do the next two just to be safe (for race condition of someone else adding validator before us)
	curValidatorID, err := r.getNumValidators()
	if err != nil {
		return 0, err
	}
	slog.Debug("mbrs", "validatormbr", mbrs.AddValidatorMbr)

	// Pay the mbr to add a validator then wrap for use in ATC.
	paymentTxn, err := transaction.MakePaymentTxn(ownerAddr.String(), crypto.GetApplicationAddress(r.RetiAppID).String(), mbrs.AddValidatorMbr, nil, "", params)
	payTxWithSigner := transaction.TransactionWithSigner{
		Txn:    paymentTxn,
		Signer: algo.SignWithAccountForATC(r.signer, ownerAddr.String()),
	}

	atc.AddMethodCall(transaction.AddMethodCallParams{
		AppID:  r.RetiAppID,
		Method: addValidatorMethod,
		MethodArgs: []any{
			// MBR payment
			payTxWithSigner,
			// --
			nfdName,
			[]any{
				0, // id is ignored and assigned by contract
				ownerAddr,
				managerAddr,
				info.Config.NFDForInfo,
				mustHoldCreatorAddr,
				info.Config.CreatorNFTMinBalance,
				info.Config.RewardTokenID,
				info.Config.RewardPerPayout,
				uint16(info.Config.PayoutEveryXMins),
				uint16(info.Config.PercentToValidator),
				commissionAddr,
				info.Config.MinEntryStake,
				info.Config.MaxAlgoPerPool,
				uint8(info.Config.PoolsPerNode),
			},
		},
		BoxReferences: []types.AppBoxReference{
			{AppID: 0, Name: GetValidatorListBoxName(curValidatorID + 1)},
			{AppID: 0, Name: GetValidatorListBoxName(curValidatorID + 2)},
			{AppID: 0, Name: nil}, // extra i/o
		},
		SuggestedParams: params,
		OnComplete:      types.NoOpOC,
		Sender:          ownerAddr,
		Signer:          algo.SignWithAccountForATC(r.signer, ownerAddr.String()),
	})

	result, err := atc.Execute(r.algoClient, context.Background(), 4)
	if err != nil {
		return 0, err
	}
	if validatorID, ok := result.MethodResults[0].ReturnValue.(uint64); ok {
		return validatorID, nil
	}
	return 0, nil
}

func (r *Reti) GetValidatorConfig(id uint64) (*ValidatorConfig, error) {
	var err error

	params, err := r.algoClient.SuggestedParams().Do(context.Background())
	if err != nil {
		return nil, err
	}

	dummyAddr, err := r.getLocalSignerForSimulateCalls()
	if err != nil {
		return nil, err
	}
	// Now try to actually create the validator !!
	atc := transaction.AtomicTransactionComposer{}

	method, err := r.validatorContract.GetMethodByName("getValidatorConfig")
	if err != nil {
		return nil, err
	}
	atc.AddMethodCall(transaction.AddMethodCallParams{
		AppID:      r.RetiAppID,
		Method:     method,
		MethodArgs: []any{id},
		BoxReferences: []types.AppBoxReference{
			{AppID: 0, Name: GetValidatorListBoxName(id)},
			{AppID: 0, Name: nil}, // extra i/o
		},
		SuggestedParams: params,
		OnComplete:      types.NoOpOC,
		Sender:          dummyAddr,
		Signer:          transaction.EmptyTransactionSigner{},
	})

	result, err := atc.Simulate(context.Background(), r.algoClient, models.SimulateRequest{
		AllowEmptySignatures:  true,
		AllowUnnamedResources: true,
	})
	if err != nil {
		return nil, err
	}
	if result.SimulateResponse.TxnGroups[0].FailureMessage != "" {
		return nil, fmt.Errorf("error retrieving validator config: %s", result.SimulateResponse.TxnGroups[0].FailureMessage)
	}
	return ValidatorConfigFromABIReturn(result.MethodResults[0].ReturnValue)
}

func (r *Reti) GetValidatorState(id uint64) (*ValidatorCurState, error) {
	var err error

	params, err := r.algoClient.SuggestedParams().Do(context.Background())
	if err != nil {
		return nil, err
	}

	dummyAddr, err := r.getLocalSignerForSimulateCalls()
	if err != nil {
		return nil, err
	}

	// Now try to actually create the validator !!
	atc := transaction.AtomicTransactionComposer{}

	method, err := r.validatorContract.GetMethodByName("getValidatorState")
	if err != nil {
		return nil, err
	}
	atc.AddMethodCall(transaction.AddMethodCallParams{
		AppID:      r.RetiAppID,
		Method:     method,
		MethodArgs: []any{id},
		BoxReferences: []types.AppBoxReference{
			{AppID: 0, Name: GetValidatorListBoxName(id)},
			{AppID: 0, Name: nil}, // extra i/o
		},
		SuggestedParams: params,
		OnComplete:      types.NoOpOC,
		Sender:          dummyAddr,
		Signer:          transaction.EmptyTransactionSigner{},
	})

	result, err := atc.Simulate(context.Background(), r.algoClient, models.SimulateRequest{
		AllowEmptySignatures:  true,
		AllowUnnamedResources: true,
	})
	if err != nil {
		return nil, err
	}
	return ValidatorCurStateFromABIReturn(result.MethodResults[0].ReturnValue)
}

func (r *Reti) GetValidatorPools(id uint64) ([]PoolInfo, error) {
	var err error

	params, err := r.algoClient.SuggestedParams().Do(context.Background())
	if err != nil {
		return nil, err
	}

	dummyAddr, err := r.getLocalSignerForSimulateCalls()
	if err != nil {
		return nil, err
	}

	// Now try to actually create the validator !!
	atc := transaction.AtomicTransactionComposer{}

	getPoolInfoMethod, err := r.validatorContract.GetMethodByName("getPools")
	if err != nil {
		return nil, err
	}
	atc.AddMethodCall(transaction.AddMethodCallParams{
		AppID:      r.RetiAppID,
		Method:     getPoolInfoMethod,
		MethodArgs: []any{id},
		BoxReferences: []types.AppBoxReference{
			{AppID: 0, Name: GetValidatorListBoxName(id)},
			{AppID: 0, Name: nil}, // extra i/o
		},
		SuggestedParams: params,
		OnComplete:      types.NoOpOC,
		Sender:          dummyAddr,
		Signer:          transaction.EmptyTransactionSigner{},
	})

	result, err := atc.Simulate(context.Background(), r.algoClient, models.SimulateRequest{
		AllowEmptySignatures:  true,
		AllowMoreLogging:      true,
		AllowUnnamedResources: true,
	})
	if err != nil {
		return nil, err
	}
	return ValidatorPoolsFromABIReturn(result.MethodResults[0].ReturnValue)
}

func (r *Reti) GetValidatorPoolInfo(poolKey ValidatorPoolKey) (*PoolInfo, error) {
	var err error

	params, err := r.algoClient.SuggestedParams().Do(context.Background())
	if err != nil {
		return nil, err
	}

	dummyAddr, err := r.getLocalSignerForSimulateCalls()
	if err != nil {
		return nil, err
	}

	// Now try to actually create the validator !!
	atc := transaction.AtomicTransactionComposer{}

	getPoolInfoMethod, _ := r.validatorContract.GetMethodByName("getPoolInfo")
	_ = atc.AddMethodCall(transaction.AddMethodCallParams{
		AppID:       r.RetiAppID,
		Method:      getPoolInfoMethod,
		MethodArgs:  []any{poolKey.ID, poolKey.PoolID, poolKey.PoolAppID},
		ForeignApps: []uint64{poolKey.PoolAppID},
		BoxReferences: []types.AppBoxReference{
			{AppID: 0, Name: GetValidatorListBoxName(poolKey.PoolAppID)},
			{AppID: 0, Name: nil}, // extra i/o
		},
		SuggestedParams: params,
		OnComplete:      types.NoOpOC,
		Sender:          dummyAddr,
		Signer:          transaction.EmptyTransactionSigner{},
	})

	result, err := atc.Simulate(context.Background(), r.algoClient, models.SimulateRequest{
		AllowEmptySignatures:  true,
		AllowUnnamedResources: true,
	})
	if err != nil {
		return nil, err
	}
	return ValidatorPoolInfoFromABIReturn(result.MethodResults[0].ReturnValue)
}

func (r *Reti) GetStakedPoolsForAccount(staker types.Address) ([]*ValidatorPoolKey, error) {
	params, err := r.algoClient.SuggestedParams().Do(context.Background())
	if err != nil {
		return nil, err
	}

	method, err := r.validatorContract.GetMethodByName("getStakedPoolsForAccount")
	if err != nil {
		return nil, err
	}
	atc := transaction.AtomicTransactionComposer{}
	atc.AddMethodCall(transaction.AddMethodCallParams{
		AppID:           r.RetiAppID,
		Method:          method,
		MethodArgs:      []any{staker},
		SuggestedParams: params,
		OnComplete:      types.NoOpOC,
		Sender:          staker,
		Signer:          transaction.EmptyTransactionSigner{},
	})
	result, err := atc.Simulate(context.Background(), r.algoClient, models.SimulateRequest{
		AllowEmptySignatures:  true,
		AllowUnnamedResources: true,
	})
	if err != nil {
		return nil, err
	}
	if result.SimulateResponse.TxnGroups[0].FailureMessage != "" {
		return nil, errors.New(result.SimulateResponse.TxnGroups[0].FailureMessage)
	}
	var retPools []*ValidatorPoolKey
	if arrReturn, ok := result.MethodResults[0].ReturnValue.([]any); ok {
		for _, poolInfoAny := range arrReturn {
			poolKey, err := ValidatorPoolKeyFromABIReturn(poolInfoAny)
			if err != nil {
				return nil, err
			}
			retPools = append(retPools, poolKey)
		}
		return retPools, nil
	}

	return nil, fmt.Errorf("unknown result type:%#v", result.MethodResults)
}

func (r *Reti) GetValidatorNodePoolAssignments(id uint64) (*NodePoolAssignmentConfig, error) {
	var err error

	params, err := r.algoClient.SuggestedParams().Do(context.Background())
	if err != nil {
		return nil, err
	}

	dummyAddr, err := r.getLocalSignerForSimulateCalls()
	if err != nil {
		return nil, err
	}

	// Now try to actually create the validator !!
	atc := transaction.AtomicTransactionComposer{}

	getNodePoolAssignmentsMethod, err := r.validatorContract.GetMethodByName("getNodePoolAssignments")
	if err != nil {
		return nil, err
	}
	atc.AddMethodCall(transaction.AddMethodCallParams{
		AppID:      r.RetiAppID,
		Method:     getNodePoolAssignmentsMethod,
		MethodArgs: []any{id},
		BoxReferences: []types.AppBoxReference{
			{AppID: 0, Name: GetValidatorListBoxName(id)},
			{AppID: 0, Name: nil}, // extra i/o
		},
		SuggestedParams: params,
		OnComplete:      types.NoOpOC,
		Sender:          dummyAddr,
		Signer:          transaction.EmptyTransactionSigner{},
	})

	result, err := atc.Simulate(context.Background(), r.algoClient, models.SimulateRequest{
		AllowEmptySignatures:  true,
		AllowMoreLogging:      true,
		AllowUnnamedResources: true,
	})
	if err != nil {
		return nil, err
	}
	return NodePoolAssignmentFromABIReturn(result.MethodResults[0].ReturnValue)
}

func NodePoolAssignmentFromABIReturn(returnVal any) (*NodePoolAssignmentConfig, error) {
	// getNodePoolAssignments(uint64)((uint64[4])[12])
	var retPAC = &NodePoolAssignmentConfig{}
	if arrReturn, ok := returnVal.([]any); ok {
		for _, nodeConfigAny := range arrReturn {
			if nodes, ok := nodeConfigAny.([]any); ok {
				for _, pools := range nodes {
					if poolIDs, ok := pools.([]any); ok {
						var ids []uint64
						for _, id := range poolIDs[0].([]any) {
							convertedID := id.(uint64)
							if convertedID == 0 {
								continue
							}
							ids = append(ids, convertedID)
						}
						retPAC.Nodes = append(retPAC.Nodes, NodeConfig{PoolAppIDs: ids})
					}
				}
			}
		}
		return retPAC, nil
	}
	return nil, errCantFetchPoolKey
}

func (r *Reti) FindPoolForStaker(id uint64, staker types.Address, amount uint64) (*ValidatorPoolKey, error) {
	params, err := r.algoClient.SuggestedParams().Do(context.Background())
	if err != nil {
		return nil, err
	}

	findPoolMethod, _ := r.validatorContract.GetMethodByName("findPoolForStaker")
	atc := transaction.AtomicTransactionComposer{}
	atc.AddMethodCall(transaction.AddMethodCallParams{
		AppID:           r.RetiAppID,
		Method:          findPoolMethod,
		MethodArgs:      []any{id, staker, amount},
		SuggestedParams: params,
		OnComplete:      types.NoOpOC,
		Sender:          staker,
		Signer:          transaction.EmptyTransactionSigner{},
	})
	result, err := atc.Simulate(context.Background(), r.algoClient, models.SimulateRequest{
		AllowEmptySignatures:  true,
		AllowUnnamedResources: true,
	})
	if err != nil {
		return nil, err
	}
	if result.SimulateResponse.TxnGroups[0].FailureMessage != "" {
		return nil, errors.New(result.SimulateResponse.TxnGroups[0].FailureMessage)
	}
	// findPoolForStaker returns [ValidatorPoolKey, boolean]
	return ValidatorPoolKeyFromABIReturn(result.MethodResults[0].ReturnValue.([]any)[0])
}

func (r *Reti) ChangeValidatorCommissionAddress(id uint64, sender types.Address, commissionAddress types.Address) error {
	var err error

	params, err := r.algoClient.SuggestedParams().Do(context.Background())
	if err != nil {
		return err
	}

	atc := transaction.AtomicTransactionComposer{}

	changeAddressMethod, _ := r.validatorContract.GetMethodByName("changeValidatorCommissionAddress")
	// We have to pay MBR into the Validator contract itself for adding a pool
	atc.AddMethodCall(transaction.AddMethodCallParams{
		AppID:  r.RetiAppID,
		Method: changeAddressMethod,
		MethodArgs: []any{
			id,
			commissionAddress,
		},
		ForeignApps: []uint64{r.poolTemplateAppID()},
		BoxReferences: []types.AppBoxReference{
			{AppID: 0, Name: GetValidatorListBoxName(id)},
			{AppID: 0, Name: nil}, // extra i/o
		},
		SuggestedParams: params,
		OnComplete:      types.NoOpOC,
		Sender:          sender,
		Signer:          algo.SignWithAccountForATC(r.signer, sender.String()),
	})
	_, err = atc.Execute(r.algoClient, context.Background(), 4)
	if err != nil {
		return err
	}

	return nil

}

func (r *Reti) AddStakingPool(nodeNum uint64) (*ValidatorPoolKey, error) {
	var err error

	params, err := r.algoClient.SuggestedParams().Do(context.Background())
	if err != nil {
		return nil, err
	}

	managerAddr, _ := types.DecodeAddress(r.Info.Config.Manager)

	// first determine how much we have to add in MBR to the validator for adding a staking pool
	mbrs, err := r.getMbrAmounts(managerAddr)
	if err != nil {
		return nil, err
	}

	// Now try to actually create the pool !!
	atc := transaction.AtomicTransactionComposer{}

	misc.Infof(r.Logger, "adding staking pool to node:%d", nodeNum)
	addPoolMethod, _ := r.validatorContract.GetMethodByName("addPool")
	// We have to pay MBR into the Validator contract itself for adding a pool
	paymentTxn, err := transaction.MakePaymentTxn(managerAddr.String(), crypto.GetApplicationAddress(r.RetiAppID).String(), mbrs.AddPoolMbr, nil, "", params)
	payTxWithSigner := transaction.TransactionWithSigner{
		Txn:    paymentTxn,
		Signer: algo.SignWithAccountForATC(r.signer, managerAddr.String()),
	}

	params.FlatFee = true
	params.Fee = types.MicroAlgos(max(uint64(params.MinFee), 1000) + params.MinFee)

	atc.AddMethodCall(transaction.AddMethodCallParams{
		AppID:  r.RetiAppID,
		Method: addPoolMethod,
		MethodArgs: []any{
			// MBR payment
			payTxWithSigner,
			// --
			r.Info.Config.ID,
			nodeNum,
		},
		ForeignApps: []uint64{r.poolTemplateAppID()},
		BoxReferences: []types.AppBoxReference{
			{AppID: 0, Name: GetValidatorListBoxName(r.Info.Config.ID)},
			{AppID: 0, Name: nil}, // extra i/o
		},
		SuggestedParams: params,
		OnComplete:      types.NoOpOC,
		Sender:          managerAddr,
		Signer:          algo.SignWithAccountForATC(r.signer, managerAddr.String()),
	})
	result, err := atc.Execute(r.algoClient, context.Background(), 4)
	if err != nil {
		return nil, err
	}

	poolKey, err := ValidatorPoolKeyFromABIReturn(result.MethodResults[0].ReturnValue)
	if err != nil {
		return nil, err
	}

	err = r.CheckAndInitStakingPoolStorage(poolKey)
	if err != nil {
		return nil, err
	}

	return poolKey, err
}

func (r *Reti) MovePoolToNode(poolAppID uint64, nodeNum uint64) error {
	var err error

	params, err := r.algoClient.SuggestedParams().Do(context.Background())
	if err != nil {
		return err
	}

	managerAddr, _ := types.DecodeAddress(r.Info.Config.Manager)

	atc := transaction.AtomicTransactionComposer{}
	misc.Infof(r.Logger, "trying to move pool app id:%d to node number:%d", poolAppID, nodeNum)
	movePoolMethod, _ := r.validatorContract.GetMethodByName("movePoolToNode")

	// pay for go offline call as well
	params.FlatFee = true
	params.Fee = types.MicroAlgos(max(uint64(params.MinFee), 1000) + (2 * params.MinFee))

	atc.AddMethodCall(transaction.AddMethodCallParams{
		AppID:  r.RetiAppID,
		Method: movePoolMethod,
		MethodArgs: []any{
			r.Info.Config.ID,
			poolAppID,
			nodeNum,
		},
		ForeignApps: []uint64{
			r.poolTemplateAppID(),
			poolAppID,
		},
		BoxReferences: []types.AppBoxReference{
			{AppID: 0, Name: GetValidatorListBoxName(r.Info.Config.ID)},
			{AppID: 0, Name: nil}, // extra i/o
		},
		SuggestedParams: params,
		OnComplete:      types.NoOpOC,
		Sender:          managerAddr,
		Signer:          algo.SignWithAccountForATC(r.signer, managerAddr.String()),
	})
	_, err = atc.Execute(r.algoClient, context.Background(), 4)
	if err != nil {
		return err
	}
	return nil
}

func (r *Reti) CheckAndInitStakingPoolStorage(poolKey *ValidatorPoolKey) error {
	// First determine if we NEED to initialize this pool !
	if val, err := r.algoClient.GetApplicationBoxByName(poolKey.PoolAppID, GetStakerLedgerBoxName()).Do(context.Background()); err == nil {
		if len(val.Value) > 0 {
			// we have value already - we're already initialized.
			return nil
		}
	}

	params, err := r.algoClient.SuggestedParams().Do(context.Background())
	if err != nil {
		return err
	}

	managerAddr, _ := types.DecodeAddress(r.Info.Config.Manager)

	mbrs, err := r.getMbrAmounts(managerAddr)
	if err != nil {
		return err
	}

	// Now we have to pay MBR into the staking pool itself (!) and tell it to initialize itself
	initStorageMethod, _ := r.poolContract.GetMethodByName("initStorage")

	misc.Infof(r.Logger, "initializing staking pool storage, mbr payment to pool:%s", algo.FormattedAlgoAmount(mbrs.PoolInitMbr))
	atc := transaction.AtomicTransactionComposer{}
	paymentTxn, err := transaction.MakePaymentTxn(managerAddr.String(), crypto.GetApplicationAddress(poolKey.PoolAppID).String(), mbrs.PoolInitMbr, nil, "", params)
	payTxWithSigner := transaction.TransactionWithSigner{
		Txn:    paymentTxn,
		Signer: algo.SignWithAccountForATC(r.signer, managerAddr.String()),
	}
	atc.AddMethodCall(transaction.AddMethodCallParams{
		AppID:  poolKey.PoolAppID,
		Method: initStorageMethod,
		MethodArgs: []any{
			// MBR payment
			payTxWithSigner,
		},
		BoxReferences: []types.AppBoxReference{
			{AppID: 0, Name: GetStakerLedgerBoxName()},
			{AppID: 0, Name: nil}, // extra i/o
			{AppID: 0, Name: nil}, // extra i/o
			{AppID: 0, Name: nil}, // extra i/o
			{AppID: 0, Name: nil}, // extra i/o
			{AppID: 0, Name: nil}, // extra i/o
			{AppID: 0, Name: nil}, // extra i/o
		},
		SuggestedParams: params,
		OnComplete:      types.NoOpOC,
		Sender:          managerAddr,
		Signer:          algo.SignWithAccountForATC(r.signer, managerAddr.String()),
	})
	_, err = atc.Execute(r.algoClient, context.Background(), 4)
	if err != nil {
		return err
	}
	return nil
}

func (r *Reti) AddStake(validatorID uint64, staker types.Address, amount uint64, assetIDToCheck uint64) (*ValidatorPoolKey, error) {
	var (
		err           error
		amountToStake = uint64(amount)
	)

	params, err := r.algoClient.SuggestedParams().Do(context.Background())
	if err != nil {
		return nil, err
	}

	// first determine how much we might have to add in MBR if this is a first-time staker
	mbrs, err := r.getMbrAmounts(staker)
	if err != nil {
		return nil, err
	}

	mbrPaymentNeeded, err := r.doesStakerNeedToPayMBR(staker)
	if err != nil {
		return nil, err
	}
	if mbrPaymentNeeded {
		misc.Infof(r.Logger, "Adding %s ALGO to stake to cover first-time MBR", algo.FormattedAlgoAmount(mbrs.AddStakerMbr))
		amountToStake += mbrs.AddStakerMbr
	}

	// Because we can't do easy simulate->execute in Go we have to figure out the references ourselves which means we need to know in advance
	// what staking pool we'll go to.  So we can just ask validator to find the pool for us and then use that (some small race conditions obviously)
	futurePoolKey, err := r.FindPoolForStaker(validatorID, staker, amount)
	if err != nil {
		return nil, err
	}

	getAtc := func(feesToUse uint64) (transaction.AtomicTransactionComposer, error) {
		atc := transaction.AtomicTransactionComposer{}
		gasMethod, _ := r.validatorContract.GetMethodByName("gas")
		stakeMethod, _ := r.validatorContract.GetMethodByName("addStake")

		params.FlatFee = true
		params.Fee = transaction.MinTxnFee

		paymentTxn, err := transaction.MakePaymentTxn(staker.String(), crypto.GetApplicationAddress(r.RetiAppID).String(), amountToStake, nil, "", params)
		payTxWithSigner := transaction.TransactionWithSigner{
			Txn:    paymentTxn,
			Signer: algo.SignWithAccountForATC(r.signer, staker.String()),
		}

		// we need to stack up references in this gas method for resource pooling
		err = atc.AddMethodCall(transaction.AddMethodCallParams{
			AppID:  r.RetiAppID,
			Method: gasMethod,
			BoxReferences: []types.AppBoxReference{
				{AppID: 0, Name: GetValidatorListBoxName(validatorID)},
				{AppID: 0, Name: nil}, // extra i/o
				{AppID: 0, Name: GetStakerPoolSetBoxName(staker)},
			},
			SuggestedParams: params,
			OnComplete:      types.NoOpOC,
			Sender:          staker,
			Signer:          algo.SignWithAccountForATC(r.signer, staker.String()),
		})
		if err != nil {
			return atc, err
		}
		if feesToUse == 0 {
			// we're simulating so go with super high budget
			feesToUse = 240 * transaction.MinTxnFee
		}
		params.FlatFee = true
		params.Fee = types.MicroAlgos(feesToUse)
		err = atc.AddMethodCall(transaction.AddMethodCallParams{
			AppID:  r.RetiAppID,
			Method: stakeMethod,
			MethodArgs: []any{
				// MBR payment
				payTxWithSigner,
				// --
				validatorID,
				assetIDToCheck,
			},
			ForeignApps: []uint64{futurePoolKey.PoolAppID},
			BoxReferences: []types.AppBoxReference{
				{AppID: futurePoolKey.PoolAppID, Name: GetStakerLedgerBoxName()},
				{AppID: 0, Name: nil}, // extra i/o
				{AppID: 0, Name: nil}, // extra i/o
				{AppID: 0, Name: nil}, // extra i/o
				{AppID: 0, Name: nil}, // extra i/o
				{AppID: 0, Name: nil}, // extra i/o
				{AppID: 0, Name: nil}, // extra i/o
			},
			SuggestedParams: params,
			OnComplete:      types.NoOpOC,
			Sender:          staker,
			Signer:          algo.SignWithAccountForATC(r.signer, staker.String()),
		})
		if err != nil {
			return atc, err
		}
		return atc, err
	}

	// simulate first
	atc, err := getAtc(0)
	if err != nil {
		return nil, err
	}
	simResult, err := atc.Simulate(context.Background(), r.algoClient, models.SimulateRequest{
		AllowEmptySignatures:  true,
		AllowUnnamedResources: true,
	})
	if err != nil {
		return nil, err
	}
	if simResult.SimulateResponse.TxnGroups[0].FailureMessage != "" {
		return nil, errors.New(simResult.SimulateResponse.TxnGroups[0].FailureMessage)
	}
	// Figure out how much app budget was added so we can know the real fees to use when we execute
	atc, err = getAtc(2*transaction.MinTxnFee + transaction.MinTxnFee*(simResult.SimulateResponse.TxnGroups[0].AppBudgetAdded/700))
	if err != nil {
		return nil, err
	}

	result, err := atc.Execute(r.algoClient, context.Background(), 4)
	if err != nil {
		return nil, err
	}
	return ValidatorPoolKeyFromABIReturn(result.MethodResults[1].ReturnValue)
}

func (r *Reti) RemoveStake(poolKey ValidatorPoolKey, staker types.Address, amount uint64) error {
	var err error

	params, err := r.algoClient.SuggestedParams().Do(context.Background())
	if err != nil {
		return err
	}

	getAtc := func(feesToUse uint64) (transaction.AtomicTransactionComposer, error) {
		atc := transaction.AtomicTransactionComposer{}
		gasMethod, _ := r.validatorContract.GetMethodByName("gas")
		unstakeMethod, _ := r.poolContract.GetMethodByName("removeStake")

		params.FlatFee = true
		params.Fee = transaction.MinTxnFee

		// we need to stack up references in this gas method for resource pooling
		err = atc.AddMethodCall(transaction.AddMethodCallParams{
			AppID:  r.RetiAppID,
			Method: gasMethod,
			BoxReferences: []types.AppBoxReference{
				{AppID: r.RetiAppID, Name: GetValidatorListBoxName(poolKey.ID)},
				{AppID: r.RetiAppID, Name: nil}, // extra i/o
				{AppID: r.RetiAppID, Name: GetStakerPoolSetBoxName(staker)},
			},
			SuggestedParams: params,
			OnComplete:      types.NoOpOC,
			Sender:          staker,
			Signer:          algo.SignWithAccountForATC(r.signer, staker.String()),
		})
		if err != nil {
			return atc, err
		}
		if feesToUse == 0 {
			// we're simulating so go with super high budget
			feesToUse = 240 * transaction.MinTxnFee
		}
		params.FlatFee = true
		params.Fee = types.MicroAlgos(feesToUse)
		err = atc.AddMethodCall(transaction.AddMethodCallParams{
			AppID:  poolKey.PoolAppID,
			Method: unstakeMethod,
			MethodArgs: []any{
				amount,
			},
			ForeignApps: []uint64{poolKey.PoolAppID},
			BoxReferences: []types.AppBoxReference{
				{AppID: 0, Name: GetStakerLedgerBoxName()},
				{AppID: 0, Name: nil}, // extra i/o
				{AppID: 0, Name: nil}, // extra i/o
				{AppID: 0, Name: nil}, // extra i/o
				{AppID: 0, Name: nil}, // extra i/o
				{AppID: 0, Name: nil}, // extra i/o
				{AppID: 0, Name: nil}, // extra i/o
			},
			SuggestedParams: params,
			OnComplete:      types.NoOpOC,
			Sender:          staker,
			Signer:          algo.SignWithAccountForATC(r.signer, staker.String()),
		})
		if err != nil {
			return atc, err
		}
		return atc, err
	}

	// simulate first
	atc, err := getAtc(0)
	if err != nil {
		return err
	}
	simResult, err := atc.Simulate(context.Background(), r.algoClient, models.SimulateRequest{
		AllowEmptySignatures:  true,
		AllowUnnamedResources: true,
	})
	if err != nil {
		return err
	}
	if simResult.SimulateResponse.TxnGroups[0].FailureMessage != "" {
		return errors.New(simResult.SimulateResponse.TxnGroups[0].FailureMessage)
	}
	// Figure out how much app budget was added so we can know the real fees to use when we execute
	atc, err = getAtc(2*transaction.MinTxnFee + transaction.MinTxnFee*(simResult.SimulateResponse.TxnGroups[0].AppBudgetAdded/700))
	if err != nil {
		return err
	}

	_, err = atc.Execute(r.algoClient, context.Background(), 4)
	if err != nil {
		return err
	}
	return nil
}

type MbrAmounts struct {
	AddValidatorMbr uint64
	AddPoolMbr      uint64
	PoolInitMbr     uint64
	AddStakerMbr    uint64
}

func (r *Reti) getMbrAmounts(caller types.Address) (MbrAmounts, error) {
	params, err := r.algoClient.SuggestedParams().Do(context.Background())
	if err != nil {
		return MbrAmounts{}, err
	}

	method, err := r.validatorContract.GetMethodByName("getMbrAmounts")
	if err != nil {
		return MbrAmounts{}, err
	}
	atc := transaction.AtomicTransactionComposer{}
	atc.AddMethodCall(transaction.AddMethodCallParams{
		AppID:           r.RetiAppID,
		Method:          method,
		SuggestedParams: params,
		OnComplete:      types.NoOpOC,
		Sender:          caller,
		Signer:          transaction.EmptyTransactionSigner{},
	})
	result, err := atc.Simulate(context.Background(), r.algoClient, models.SimulateRequest{
		AllowEmptySignatures:  true,
		AllowUnnamedResources: true,
	})
	if err != nil {
		return MbrAmounts{}, err
	}
	if result.SimulateResponse.TxnGroups[0].FailureMessage != "" {
		return MbrAmounts{}, errors.New(result.SimulateResponse.TxnGroups[0].FailureMessage)
	}

	if results, ok := result.MethodResults[0].ReturnValue.([]any); ok {
		if len(results) != 4 {
			return MbrAmounts{}, errors.New("invalid number of results")
		}
		var mbrs MbrAmounts
		mbrs.AddValidatorMbr = results[0].(uint64)
		mbrs.AddPoolMbr = results[1].(uint64)
		mbrs.PoolInitMbr = results[2].(uint64)
		mbrs.AddStakerMbr = results[3].(uint64)
		return mbrs, nil
	}
	return MbrAmounts{}, fmt.Errorf("unknown result type:%#v", result.MethodResults)
}

func (r *Reti) doesStakerNeedToPayMBR(staker types.Address) (bool, error) {
	params, err := r.algoClient.SuggestedParams().Do(context.Background())
	if err != nil {
		return false, err
	}

	method, err := r.validatorContract.GetMethodByName("doesStakerNeedToPayMBR")
	if err != nil {
		return false, err
	}
	atc := transaction.AtomicTransactionComposer{}
	atc.AddMethodCall(transaction.AddMethodCallParams{
		AppID:           r.RetiAppID,
		Method:          method,
		MethodArgs:      []any{staker},
		SuggestedParams: params,
		OnComplete:      types.NoOpOC,
		Sender:          staker,
		Signer:          transaction.EmptyTransactionSigner{},
	})
	result, err := atc.Simulate(context.Background(), r.algoClient, models.SimulateRequest{
		AllowEmptySignatures:  true,
		AllowUnnamedResources: true,
	})
	if err != nil {
		return false, err
	}
	val := result.MethodResults[0].ReturnValue
	if boolReturn, ok := val.(bool); ok {
		return boolReturn, nil
	}
	return false, errors.New("unknown return value from doesStakerNeedToPayMBR")
}

func (r *Reti) getNumValidators() (uint64, error) {
	appInfo, err := r.algoClient.GetApplicationByID(r.RetiAppID).Do(context.Background())
	if err != nil {
		return 0, err
	}
	return algo.GetIntFromGlobalState(appInfo.Params.GlobalState, VldtrNumValidators)
}

func (r *Reti) poolTemplateAppID() uint64 {
	return r.poolTmplAppID
}
