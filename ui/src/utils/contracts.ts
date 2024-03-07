import {
  Validator,
  ValidatorConfig,
  ValidatorConfigRaw,
  ValidatorState,
  ValidatorStateRaw,
} from '@/interfaces/validator'

export function transformValidatorData(
  rawConfig: ValidatorConfigRaw,
  rawState: ValidatorStateRaw,
): Validator {
  const config: ValidatorConfig = {
    ID: rawConfig[0],
    Owner: rawConfig[1],
    Manager: rawConfig[2],
    NFDForInfo: rawConfig[3],
    PayoutEveryXMins: rawConfig[4],
    PercentToValidator: rawConfig[5],
    ValidatorCommissionAddress: rawConfig[6],
    MinEntryStake: rawConfig[7],
    MaxAlgoPerPool: rawConfig[8],
    PoolsPerNode: rawConfig[9],
  }

  const state: ValidatorState = {
    NumPools: rawState[0],
    TotalStakers: rawState[1],
    TotalAlgoStaked: rawState[2],
  }

  return {
    id: Number(config.ID),
    owner: config.Owner,
    manager: config.Manager,
    nfd: Number(config.NFDForInfo),
    payoutFrequency: config.PayoutEveryXMins,
    commission: config.PercentToValidator,
    commissionAccount: config.ValidatorCommissionAddress,
    minStake: Number(config.MinEntryStake),
    maxStake: Number(config.MaxAlgoPerPool),
    maxPools: config.PoolsPerNode,
    numPools: state.NumPools,
    numStakers: Number(state.TotalStakers),
    totalStaked: Number(state.TotalAlgoStaked),
  }
}
