import { Address } from '@algorandfoundation/algorand-typescript/arc4'
import {
    PoolTokenPayoutRatio,
    ValidatorConfig,
    ValidatorPoolKey,
    ValidatorIdType,
    ValidatorCurState,
} from './validatorConfigs.algo'
import { uint64, Contract } from '@algorandfoundation/algorand-typescript'

export class ValidatorRegistryInterface extends Contract {
    // @ts-expect-error: This is a placeholder for the interface
    getValidatorConfig(validatorId: ValidatorIdType): ValidatorConfig {}
    stakeRemoved(
        poolKey: ValidatorPoolKey,
        staker: Address,
        amountRemoved: uint64,
        rewardRemoved: uint64,
        stakerRemoved: boolean,
    ): void {}
    // @ts-expect-error: This is a placeholder for the interface
    getPoolAppId(validatorId: uint64, poolId: uint64): uint64 {}
    // @ts-expect-error: This is a placeholder for the interface
    setTokenPayoutRatio(validatorId: ValidatorIdType): PoolTokenPayoutRatio {}
    // @ts-expect-error: This is a placeholder for the interface
    getValidatorState(validatorId: ValidatorIdType): ValidatorCurState {}
    stakeUpdatedViaRewards(
        poolKey: ValidatorPoolKey,
        algoToAdd: uint64,
        rewardTokenAmountReserved: uint64,
        validatorCommission: uint64,
        saturatedBurnToFeeSink: uint64,
    ): void {}
    // @ts-expect-error: This is a placeholder for the interface
    getValidatorOwnerAndManager(validatorId: ValidatorIdType): [Address, Address] {}
}
