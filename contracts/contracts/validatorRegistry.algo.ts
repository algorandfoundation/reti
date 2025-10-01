import { StakedInfo, StakingPool } from './stakingPool.algo'
import {
    ALGORAND_ACCOUNT_MIN_BALANCE,
    APPLICATION_BASE_FEE,
    ASSET_HOLDING_FEE,
    GATING_TYPE_ASSET_ID,
    GATING_TYPE_ASSETS_CREATED_BY,
    GATING_TYPE_CONST_MAX,
    GATING_TYPE_CREATED_BY_NFD_ADDRESSES,
    GATING_TYPE_NONE,
    GATING_TYPE_SEGMENT_OF_NFD,
    MAX_EPOCH_LENGTH,
    MAX_NODES,
    MAX_PCT_TO_VALIDATOR,
    MAX_POOLS,
    MAX_POOLS_PER_NODE,
    MAX_POOLS_PER_STAKER,
    MAX_STAKERS_PER_POOL,
    MAX_VALIDATOR_HARD_PCT_OF_ONLINE_1DECIMAL,
    MAX_VALIDATOR_SOFT_PCT_OF_ONLINE_1DECIMAL,
    MIN_ALGO_STAKE_PER_POOL,
    MIN_EPOCH_LENGTH,
    MIN_PCT_TO_VALIDATOR,
    SSC_VALUE_BYTES,
    SSC_VALUE_UINT,
} from './constants.algo'
import {
    Constraints,
    MbrAmounts,
    NodePoolAssignmentConfig,
    PoolInfo,
    PoolTokenPayoutRatio,
    ValidatorConfig,
    ValidatorCurState,
    ValidatorIdType,
    ValidatorInfo,
    ValidatorPoolKey,
} from './validatorConfigs.algo'
import {
    uint64,
    Contract,
    Box,
    GlobalState,
    bytes,
    BoxMap,
    FixedArray,
    TemplateVar,
    assert,
    abimethod,
    clone,
    gtxn,
    assertMatch,
    Global,
    Txn,
    op,
    Bytes,
    Account,
    itxn,
    OnCompleteAction,
    emit,
    Application,
    ensureBudget,
    Asset,
    contract,
} from '@algorandfoundation/algorand-typescript'
import {
    abiCall,
    Address,
    compileArc4,
    encodeArc4,
    methodSelector,
    readonly,
    sizeOf,
    Uint16,
    Uint8,
} from '@algorandfoundation/algorand-typescript/arc4'
import { ITxn } from '@algorandfoundation/algorand-typescript/op'
import { wideRatio } from './utils.algo'

const nfdRegistryAppId = TemplateVar<uint64>('NFD_REGISTRY_APP_ID')

/**
 * ValidatorRegistry is the 'master contract' for the reti pooling protocol.
 * A single immutable instance of this is deployed.  All state for all validators including information about their
 * pools and nodes is stored via this contract in global state and box storage.  Data in the pools themselves is stored
 * within the StakingPool contract instance, also in global state and box storage.
 * See the StakingPool contract comments for details on how this contract creates new instances of them.
 */
@contract({ avmVersion: 11 })
export class ValidatorRegistry extends Contract {
    // ======
    // GLOBAL STATE AND TEMPLATES
    // ======
    stakingPoolApprovalProgram = Box<bytes>({ key: 'poolTemplateApprovalBytes' })

    stakingPoolInitialized = GlobalState<boolean>({ key: 'init' })

    numValidators = GlobalState<uint64>({ key: 'numV' })

    // Track the 'global' protocol number of stakers
    numStakers = GlobalState<uint64>({ key: 'numStakers' })

    // Track the 'global' protocol amount of stake
    totalAlgoStaked = GlobalState<uint64>({ key: 'staked' })

    // Validator list - simply incremental id - direct access to info for validator
    // and also contains all pool information (but not user-account ledger per pool)
    validatorList = BoxMap<ValidatorIdType, ValidatorInfo>({ keyPrefix: 'v' })

    // For given user staker address, which of up to MAX_POOLS_PER_STAKER validator/pools are they in
    // We use this to find a particular addresses deposits (in up to X independent pools w/ any validators)
    stakerPoolSet = BoxMap<Account, FixedArray<ValidatorPoolKey, typeof MAX_POOLS_PER_STAKER>>({ keyPrefix: 'sps' })

    // ======
    // PUBLIC CONTRACT METHODS
    // ======
    createApplication(): void {
        this.stakingPoolInitialized.value = false
        this.numValidators.value = 0
        this.numStakers.value = 0
        this.totalAlgoStaked.value = 0
    }

    initStakingContract(approvalProgramSize: uint64): void {
        // can only be called once !
        this.stakingPoolApprovalProgram.create({ size: approvalProgramSize })
    }

    loadStakingContractData(offset: uint64, data: bytes): void {
        assert(!this.stakingPoolInitialized.value)
        this.stakingPoolApprovalProgram.replace(offset, data)
    }

    finalizeStakingContract(): void {
        this.stakingPoolInitialized.value = true
    }

    /**
     * gas is a dummy no-op call that can be used to pool-up resource references and opcode cost
     */
    gas(): void {}

    /**
     * Returns the MBR amounts needed for various actions:
     * [
     *  addValidatorMbr: uint64 - mbr needed to add a new validator - paid to validator contract
     *  addPoolMbr: uint64 - mbr needed to add a new pool - paid to validator
     *  poolInitMbr: uint64 - mbr needed to initStorage() of pool - paid to pool itself
     *  addStakerMbr: uint64 - mbr staker needs to add to first staking payment (stays w/ validator)
     * ]
     */
    @readonly
    getMbrAmounts(): MbrAmounts {
        const stakingPool = compileArc4(StakingPool)
        // Cost for creator of validator contract itself is (but not really our problem - it's a bootstrap issue only)
        // this.minBalanceForAccount(0, 0, 0, 0, 0, 4, 0)
        return {
            addValidatorMbr: this.costForBoxStorage(
                1 /* v prefix */ + sizeOf<ValidatorIdType>() + sizeOf<ValidatorInfo>(),
            ),
            addPoolMbr: this.minBalanceForAccount(
                1,
                // we could calculate this directly by referencing the size of stakingPoolApprovalProgram but it would
                // mean our callers would have to reference the box AND buy up i/o - so just go max on extra pages
                3,
                0,
                0,
                0,
                stakingPool.globalUints,
                stakingPool.globalBytes,
            ),
            poolInitMbr:
                ALGORAND_ACCOUNT_MIN_BALANCE +
                this.costForBoxStorage(7 /* 'stakers' name */ + sizeOf<StakedInfo>() * MAX_STAKERS_PER_POOL),
            addStakerMbr:
                // how much to charge for first time a staker adds stake - since we add a tracking box per staker
                this.costForBoxStorage(
                    3 /* 'sps' prefix */ + sizeOf<Address>() + sizeOf<ValidatorPoolKey>() * MAX_POOLS_PER_STAKER,
                ), // size of key + all values
        }
    }

    /**
     * Returns the protocol constraints so that UIs can limit what users specify for validator configuration parameters.
     */
    @readonly
    getProtocolConstraints(): Constraints {
        return {
            epochPayoutRoundsMin: MIN_EPOCH_LENGTH,
            epochPayoutRoundsMax: MAX_EPOCH_LENGTH,
            minPctToValidatorWFourDecimals: MIN_PCT_TO_VALIDATOR,
            maxPctToValidatorWFourDecimals: MAX_PCT_TO_VALIDATOR,
            minEntryStake: MIN_ALGO_STAKE_PER_POOL,
            maxAlgoPerPool: this.maxAlgoAllowedPerPool(),
            maxAlgoPerValidator: this.maxAllowedStake(),
            amtConsideredSaturated: this.algoSaturationLevel(),
            maxNodes: MAX_NODES,
            maxPoolsPerNode: MAX_POOLS_PER_NODE,
            maxStakersPerPool: MAX_STAKERS_PER_POOL,
        }
    }

    /**
     * Returns the current number of validators
     */
    @readonly
    getNumValidators(): uint64 {
        return this.numValidators.value
    }

    @readonly
    getValidatorConfig(validatorId: ValidatorIdType): ValidatorConfig {
        return this.validatorList(validatorId).value.config
    }

    @readonly
    getValidatorState(validatorId: ValidatorIdType): ValidatorCurState {
        return this.validatorList(validatorId).value.state
    }

    @readonly
    getValidatorOwnerAndManager(validatorId: ValidatorIdType): [Account, Account] {
        return [
            this.validatorList(validatorId).value.config.owner,
            this.validatorList(validatorId).value.config.manager,
        ]
    }

    /**
     * Return list of all pools for this validator.
     * @param {uint64} validatorId
     * @return {PoolInfo[]} - array of pools
     * Not callable from other contracts because >1K return but can be called w/ simulate which bumps log returns
     */
    @readonly
    getPools(validatorId: ValidatorIdType): PoolInfo[] {
        const retData: PoolInfo[] = []
        const poolSet = clone(this.validatorList(validatorId).value.pools)
        for (let i: uint64 = 0; i < poolSet.length; i += 1) {
            if (poolSet[i].poolAppId === 0) {
                // reached end of list...  we don't replace values here because pools can't be removed
                break
            }
            retData.push(poolSet[i])
        }
        return retData
    }

    /**
     * getPoolAppId is useful for callers to determine app to call for removing stake if they don't have staking or
     * want to get staker list for an account.  The staking pool also uses it to get the app id of staking pool 1
     * (which contains reward tokens if being used) so that the amount available can be determined.
     */
    @readonly
    getPoolAppId(validatorId: uint64, poolId: uint64): uint64 {
        assert(
            poolId !== 0 && poolId <= this.validatorList(validatorId).value.pools.length,
            'pool id must be between 1 and number of pools for this validator',
        )
        return this.validatorList(validatorId).value.pools[poolId - 1].poolAppId
    }

    @readonly
    getPoolInfo(poolKey: ValidatorPoolKey): PoolInfo {
        return this.validatorList(poolKey.id).value.pools[poolKey.poolId - 1]
    }

    /**
     * Calculate the maximum stake per pool for a given validator.
     * Normally this would be maxAlgoPerPool, but it should also never go above MaxAllowedStake / numPools so
     * as pools are added the max allowed per pool can reduce.
     *
     * @param {ValidatorIdType} validatorId - The id of the validator.
     */
    @readonly
    getCurMaxStakePerPool(validatorId: ValidatorIdType): uint64 {
        const numPools = this.validatorList(validatorId).value.state.numPools.asUint64()
        const hardMaxDividedBetweenPools: uint64 = this.maxAllowedStake() / numPools
        let maxPerPool: uint64 = this.validatorList(validatorId).value.config.maxAlgoPerPool
        if (maxPerPool === 0) {
            maxPerPool = this.maxAlgoAllowedPerPool()
        }
        if (hardMaxDividedBetweenPools < maxPerPool) {
            maxPerPool = hardMaxDividedBetweenPools
        }
        return maxPerPool
    }

    /**
     * Helper callers can call w/ simulate to determine if 'AddStaker' MBR should be included w/ staking amount
     * @param staker
     */
    @readonly
    doesStakerNeedToPayMBR(staker: Account): boolean {
        return !this.stakerPoolSet(staker).exists
    }

    /**
     * Retrieves the staked pools for an account.
     *
     * @param {Address} staker - The account to retrieve staked pools for.
     * @return {ValidatorPoolKey[]} - The array of staked pools for the account.
     */
    @readonly
    getStakedPoolsForAccount(staker: Account): ValidatorPoolKey[] {
        if (!this.stakerPoolSet(staker).exists) {
            return []
        }
        const retData: ValidatorPoolKey[] = []
        const poolSet = clone(this.stakerPoolSet(staker).value)
        for (let i: uint64 = 0; i < poolSet.length; i += 1) {
            if (poolSet[i].id !== 0) {
                retData.push(poolSet[i])
            }
        }
        return retData
    }

    /**
     * Retrieves the token payout ratio for a given validator - returning the pool ratios of whole so that token
     * payouts across pools can be based on a stable snaphost of stake.
     *
     * @param {ValidatorIdType} validatorId - The id of the validator.
     * @return {PoolTokenPayoutRatio} - The token payout ratio for the validator.
     */
    @readonly
    getTokenPayoutRatio(validatorId: ValidatorIdType): PoolTokenPayoutRatio {
        return this.validatorList(validatorId).value.tokenPayoutRatio
    }

    @readonly
    getNodePoolAssignments(validatorId: uint64): NodePoolAssignmentConfig {
        assert(this.validatorList(validatorId).exists, "the specified validator id doesn't exist")

        return this.validatorList(validatorId).value.nodePoolAssignments
    }

    @readonly
    getNFDRegistryID(): uint64 {
        return nfdRegistryAppId
    }

    /** Adds a new validator
     * Requires at least 10 ALGO as the 'fee' for the transaction to help dissuade spammed validator adds.
     *
     * @param {PayTxn} mbrPayment payment from caller which covers mbr increase of new validator storage
     * @param {string} nfdName (Optional) Name of nfd (used as double-check against id specified in config)
     * @param {ValidatorConfig} config ValidatorConfig struct
     * @returns {uint64} validator id
     */
    addValidator(mbrPayment: gtxn.PaymentTxn, nfdName: string, config: ValidatorConfig): uint64 {
        this.validateConfig(config)

        assertMatch(mbrPayment, {
            receiver: Global.currentApplicationAddress,
            amount: this.getMbrAmounts().addValidatorMbr,
        })

        assert(mbrPayment.fee > 10 * 1000000, 'fee must be 10 ALGO or more to prevent spamming of validators')

        // We're adding a new validator - same owner might have multiple - we don't care.
        const validatorId: uint64 = this.numValidators.value + 1
        this.numValidators.value = validatorId

        this.validatorList(validatorId).create()
        this.validatorList(validatorId).value.config = clone(config)
        this.validatorList(validatorId).value.config.id = validatorId
        // all other values being 0 is correct (for 'state' for eg)

        if (config.nfdForInfo !== 0) {
            // verify nfd is real, matches provided name, and owned by sender
            assert(this.isNFDAppIDValid(config.nfdForInfo), 'provided NFD must be valid')

            // Verify the NFDs owner is same as our sender (presumably either owner or manager)
            assert(
                Txn.sender === Account(op.AppGlobal.getExBytes(config.nfdForInfo, Bytes('i.owner.a'))[0]),
                'If specifying NFD, account adding validator must be owner',
            )
        }
        if (
            config.entryGatingType.asUint64() === GATING_TYPE_CREATED_BY_NFD_ADDRESSES ||
            config.entryGatingType.asUint64() === GATING_TYPE_SEGMENT_OF_NFD
        ) {
            // verify gating NFD is at least 'real' - since we just have app id - fetch its name then do is valid call
            assert(
                this.isNFDAppIDValid(config.entryGatingAssets[0]),
                'provided NFD App id for gating must be valid NFD',
            )
        }
        emit<retiOP_addedValidator>({ id: validatorId, owner: config.owner, manager: config.manager })
        return validatorId
    }

    /**
     * Changes the Validator manager for a specific Validator id.
     * [ ONLY OWNER CAN CHANGE ]
     *
     * @param {ValidatorIdType} validatorId - The id of the validator to change the manager for.
     * @param {Address} manager - The new manager address.
     */
    changeValidatorManager(validatorId: ValidatorIdType, manager: Account): void {
        this.callerMustBeOwner(validatorId)
        assert(manager !== Global.zeroAddress, 'needs to at least be valid address')
        this.validatorList(validatorId).value.config.manager = manager
    }

    /**
     * Updates the sunset information for a given validator.
     * [ ONLY OWNER CAN CHANGE ]
     *
     * @param {ValidatorIdType} validatorId - The id of the validator to update.
     * @param {uint64} sunsettingOn - The new sunset timestamp.
     * @param {uint64} sunsettingTo - The new sunset to validator id.
     */
    changeValidatorSunsetInfo(validatorId: ValidatorIdType, sunsettingOn: uint64, sunsettingTo: ValidatorIdType): void {
        this.callerMustBeOwner(validatorId)
        this.validatorList(validatorId).value.config.sunsettingOn = sunsettingOn
        this.validatorList(validatorId).value.config.sunsettingTo = sunsettingTo
    }

    /**
     * Changes the NFD for a validator in the validatorList contract.
     * [ ONLY OWNER CAN CHANGE ]
     *
     * @param {ValidatorIdType} validatorId - The id of the validator to update.
     * @param {uint64} nfdAppID - The application id of the NFD to assign to the validator.
     * @param {string} nfdName - The name of the NFD (which must match)
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    changeValidatorNFD(validatorId: ValidatorIdType, nfdAppID: uint64, nfdName: string): void {
        this.callerMustBeOwner(validatorId)
        // verify nfd is real, and owned by owner or manager
        assert(this.isNFDAppIDValid(nfdAppID), 'provided NFD must be valid')
        // we know sender is owner or manager - so if sender is owner of nfd - we're fine.
        assert(
            Txn.sender === Account(op.AppGlobal.getExBytes(nfdAppID, Bytes('i.owner.a'))[0]),
            'If specifying NFD, account adding validator must be owner',
        )
        this.validatorList(validatorId).value.config.nfdForInfo = nfdAppID
    }

    /**
     * Change the commission address that validator rewards are sent to.
     [ ONLY OWNER CAN CHANGE ]
     */
    changeValidatorCommissionAddress(validatorId: ValidatorIdType, commissionAddress: Account): void {
        this.callerMustBeOwner(validatorId)
        assert(commissionAddress !== Global.zeroAddress)
        this.validatorList(validatorId).value.config.validatorCommissionAddress = commissionAddress
    }

    /**
     * Allow the additional rewards (gating entry, additional token rewards) information be changed at will.
     * [ ONLY OWNER CAN CHANGE ]
     */
    changeValidatorRewardInfo(
        validatorId: ValidatorIdType,
        EntryGatingType: Uint8,
        EntryGatingAddress: Account,
        EntryGatingAssets: FixedArray<uint64, 4>,
        GatingAssetMinBalance: uint64,
        RewardPerPayout: uint64,
    ): void {
        this.callerMustBeOwner(validatorId)

        assert(
            EntryGatingType.asUint64() >= GATING_TYPE_NONE && EntryGatingType.asUint64() < GATING_TYPE_CONST_MAX,
            'invalid Entry gating type',
        )
        if (EntryGatingType.asUint64() === GATING_TYPE_ASSETS_CREATED_BY) {
            assert(EntryGatingAddress !== Global.zeroAddress)
        }
        if (
            EntryGatingType.asUint64() === GATING_TYPE_CREATED_BY_NFD_ADDRESSES ||
            EntryGatingType.asUint64() === GATING_TYPE_SEGMENT_OF_NFD
        ) {
            assert(this.isNFDAppIDValid(EntryGatingAssets[0]), 'provided NFD App id for gating must be valid NFD')
        }
        this.validatorList(validatorId).value.config.entryGatingType = EntryGatingType
        this.validatorList(validatorId).value.config.entryGatingAddress = EntryGatingAddress
        this.validatorList(validatorId).value.config.entryGatingAssets = clone(EntryGatingAssets)
        this.validatorList(validatorId).value.config.gatingAssetMinBalance = GatingAssetMinBalance
        this.validatorList(validatorId).value.config.rewardPerPayout = RewardPerPayout
    }

    /**
     * Adds a new pool to a validator's pool set, returning the 'key' to reference the pool in the future for staking, etc.
     * The caller must pay the cost of the validators MBR increase as well as the MBR that will be needed for the pool itself.
     *
     * [ ONLY OWNER OR MANAGER CAN call ]
     * @param {PayTxn} mbrPayment payment from caller which covers mbr increase of adding a new pool
     * @param {uint64} validatorId is id of validator to pool to (must be owner or manager)
     * @param {uint64} nodeNum is node number to add to
     * @returns {ValidatorPoolKey} pool key to created pool
     *
     */
    addPool(mbrPayment: gtxn.PaymentTxn, validatorId: ValidatorIdType, nodeNum: uint64): ValidatorPoolKey {
        const stakingPool = compileArc4(StakingPool)
        this.callerMustBeOwnerOrManager(validatorId)

        // must match MBR exactly
        assertMatch(mbrPayment, { receiver: Global.currentApplicationAddress, amount: this.getMbrAmounts().addPoolMbr })

        assert(this.validatorList(validatorId).exists, "specified validator id isn't valid")

        let numPools: uint64 = this.validatorList(validatorId).value.state.numPools.asUint64()
        if ((numPools as uint64) >= MAX_POOLS) {
            assert(false, 'already at max pool size')
        }
        numPools += 1

        // Create the actual staker pool contract instance
        itxn.applicationCall({
            onCompletion: OnCompleteAction.NoOp,
            approvalProgram: [
                this.stakingPoolApprovalProgram.extract(0, 4096),
                this.stakingPoolApprovalProgram.extract(4096, this.stakingPoolApprovalProgram.length - 4096),
            ],
            clearStateProgram: stakingPool.clearStateProgram,
            globalNumUint: stakingPool.globalUints,
            globalNumBytes: stakingPool.globalBytes,
            extraProgramPages: 3,
            appArgs: [
                // creatingContractID, validatorId, poolId, minEntryStake
                methodSelector('createApplication(uint64,uint64,uint64,uint64)void'),
                op.itob(Global.currentApplicationId.id),
                op.itob(validatorId),
                op.itob(numPools as uint64),
                op.itob(this.validatorList(validatorId).value.config.minEntryStake),
            ],
        }).submit()

        this.validatorList(validatorId).value.state.numPools = new Uint16(numPools)
        // We don't need to manipulate anything in the pools array as the '0' values are all correct for PoolInfo
        // No stakers, no algo staked
        const poolAppId = ITxn.createdApplicationId.id
        this.validatorList(validatorId).value.pools[numPools - 1].poolAppId = poolAppId
        this.addPoolToNode(validatorId, poolAppId, nodeNum)

        emit<retiOP_validatorAddedPool>({
            id: validatorId,
            num: new Uint16(numPools),
            poolAppId: poolAppId,
        })
        // PoolID is 1-based, 0 is invalid id
        return { id: validatorId, poolId: numPools as uint64, poolAppId: op.ITxn.createdApplicationId.id }
    }

    /**
     * Adds stake to a validator pool.
     *
     * @param {PayTxn} stakedAmountPayment - payment coming from staker to place into a pool
     * @param {ValidatorIdType} validatorId - The id of the validator.
     * @param {uint64} valueToVerify - only if validator has gating to enter - this is asset id or nfd id that corresponds to gating.
     * Txn sender is factored in as well if that is part of gating.
     * * @returns {ValidatorPoolKey} - The key of the validator pool.
     */
    addStake(
        stakedAmountPayment: gtxn.PaymentTxn,
        validatorId: ValidatorIdType,
        valueToVerify: uint64,
    ): ValidatorPoolKey {
        assert(this.validatorList(validatorId).exists, "specified validator id isn't valid")

        // Ensure this validator hasn't reached its sunset date
        if (this.validatorList(validatorId).value.config.sunsettingOn > 0) {
            // MI-05 [audit] - flipped assert
            assert(
                this.validatorList(validatorId).value.config.sunsettingOn > Global.latestTimestamp,
                "can't stake with a validator that is past its sunsetting time",
            )
        }

        const staker = Txn.sender
        // The prior transaction should be a payment to this pool for the amount specified.  If this is stakers
        // first time staking, then we subtract the required MBR from their payment as that MBR amount needs to stay
        // behind in this contract to cover the MBR needed for creating the 'stakerPoolSet' storage.
        assertMatch(stakedAmountPayment, {
            sender: staker,
            receiver: Global.currentApplicationAddress,
        })

        // If the validator specified that a specific token creator is required to stake, verify that the required
        // balance is held by the staker, and that the asset they offered up to validate was created by the account
        // the validator defined as its creator requirement.
        this.doesStakerMeetGating(validatorId, valueToVerify)

        let realAmount = stakedAmountPayment.amount
        let mbrAmtLeftBehind: uint64 = 0
        // determine if this is FIRST time this user has ever staked - they need to pay MBR
        if (this.doesStakerNeedToPayMBR(staker)) {
            // We'll deduct the required MBR from what the user is depositing by telling callPoolAddState to leave
            // that amount behind and subtract from their depositing stake.
            mbrAmtLeftBehind = this.getMbrAmounts().addStakerMbr
            realAmount -= mbrAmtLeftBehind
            this.stakerPoolSet(staker).create()
        }
        // Ensure we're not over our protocol maximum for combined stake in all pools using the
        // MAX_VALIDATOR_HARD_PCT_OF_ONLINE_1DECIMAL percentage
        assert(
            this.validatorList(validatorId).value.state.totalAlgoStaked + realAmount < this.maxAllowedStake(),
            'total staked for all of a validators pools may not exceed hard cap',
        )

        // find existing slot where staker is already in a pool w/ this validator, or if none found, then ensure they're
        // putting in minimum amount for this validator.
        const findRet = this.findPoolForStaker(validatorId, staker, realAmount)
        const poolKey = clone(findRet[0])
        const isNewStakerToValidator = findRet[1]
        const isNewStakerToProtocol = findRet[2]
        if (poolKey.poolId === 0) {
            assert(false, 'No pool available with free stake.  Validator needs to add another pool')
        }

        // Update StakerPoolList for this found pool (new or existing)
        this.updateStakerPoolSet(staker, poolKey)
        // Send the callers algo amount (- mbrAmtLeftBehind) to the specified staking pool, and it then updates
        // the staker data.
        this.callPoolAddStake(
            stakedAmountPayment,
            poolKey,
            mbrAmtLeftBehind,
            isNewStakerToValidator,
            isNewStakerToProtocol,
        )
        emit<retiOP_stakeAdded>({
            id: validatorId,
            poolNum: new Uint16(poolKey.poolId),
            poolAppId: poolKey.poolAppId,
            amountStaked: realAmount,
            staker: staker,
        })

        return poolKey
    }

    /**
     * setTokenPayoutRatio is called by Staking Pool # 1 (ONLY) to ask the validator (us) to calculate the ratios
     * of stake in the pools for subsequent token payouts (ie: 2 pools, '100' algo total staked, 60 in pool 1, and 40
     * in pool 2)  This is done so we have a stable snapshot of stake - taken once per epoch - only triggered by
     * pool 1 doing payout.  pools other than 1 doing payout call pool 1 to ask it do it first.
     * It would be 60/40% in the poolPctOfWhole values.  The token reward payouts then use these values instead of
     * their 'current' stake which changes as part of the payouts themselves (and people could be changing stake
     * during the epoch updates across pools)
     *
     * Multiple pools will call us via pool 1 (pool2->pool1->validator, etc.) so don't assert on pool1 calling multiple
     * times in same epoch.  Just return.
     *
     * @param validatorId - validator id (and thus pool) calling us.  Verified so that sender MUST be pool 1 of this validator.
     * @returns PoolTokenPayoutRatio - the finished ratio data
     */
    setTokenPayoutRatio(validatorId: ValidatorIdType): PoolTokenPayoutRatio {
        // Get pool 1 for this validator - caller MUST MATCH!
        const pool1AppID = this.validatorList(validatorId).value.pools[0].poolAppId
        assert(pool1AppID !== 0)
        // Sender has to match the pool app id passed in - so we ensure only pool 1 can call us.
        if (Txn.sender !== Application(pool1AppID).address) {
            return this.validatorList(validatorId).value.tokenPayoutRatio
        }

        // They can only call us if the epoch update time doesn't match what pool 1 already has - and it has to be at least
        // a full epoch since last update (unless not set).  Same check as pools themselves perform.
        // check which epoch we're currently in and if it's outside of last payout epoch.
        const curRound = Global.round
        const lastPayoutUpdate = this.validatorList(validatorId).value.tokenPayoutRatio.updatedForPayout
        if (lastPayoutUpdate !== 0) {
            // See if we've already done the calcs because payouts match - return what we already have.
            if (op.AppGlobal.getExUint64(pool1AppID, Bytes('lastPayout'))[0] === lastPayoutUpdate) {
                return this.validatorList(validatorId).value.tokenPayoutRatio
            }
            const epochRoundLength = this.validatorList(validatorId).value.config.epochRoundLength.asUint64()
            const thisEpochBegin: uint64 = curRound - (curRound % epochRoundLength)
            // Make sure our last payout epoch isn't still within the current epoch - we need to be at least one epoch past the last payout.
            if (lastPayoutUpdate - (lastPayoutUpdate % epochRoundLength) === thisEpochBegin) {
                return this.validatorList(validatorId).value.tokenPayoutRatio
            }
        }
        this.validatorList(validatorId).value.tokenPayoutRatio.updatedForPayout = curRound

        const curNumPools = this.validatorList(validatorId).value.state.numPools.asUint64()
        const totalStakeForValidator = this.validatorList(validatorId).value.state.totalAlgoStaked
        for (let i: uint64 = 0; i < curNumPools; i += 1) {
            // ie: this pool 2 has 1000 algo staked and the validator has 10,000 staked total (9000 pool 1, 1000 pool 2)
            // so this pool is 10% of the total and thus it gets 10% of the avail community token reward.
            // Get our pools pct of all stake w/ 4 decimals
            // ie, based on prior eg  - (1000 * 1e6) / 10000 = 100,000 (or 10%)
            const ourPoolPctOfWhole = wideRatio(
                [this.validatorList(validatorId).value.pools[i].totalAlgoStaked, 1_000_000],
                [totalStakeForValidator],
            )
            this.validatorList(validatorId).value.tokenPayoutRatio.poolPctOfWhole[i] = ourPoolPctOfWhole
        }
        return this.validatorList(validatorId).value.tokenPayoutRatio
    }

    /**
     * stakeUpdatedViaRewards is called by Staking pools to inform the validator (us) that a particular amount of total
     * stake has been added to the specified pool.  This is used to update the stats we have in our PoolInfo storage.
     * The calling App id is validated against our pool list as well.
     * @param {ValidatorPoolKey} poolKey - ValidatorPoolKey type
     * @param {uint64} algoToAdd - amount this validator's total stake increased via rewards
     * @param {uint64} rewardTokenAmountReserved - amount this validator's total stake increased via rewards (that should be
     * @param {uint64} validatorCommission - the commission amount the validator was paid, if any
     * @param {uint64} saturatedBurnToFeeSink - if the pool was in saturated state, the amount sent back to the fee sink.
     * seen as 'accounted for/pending spent')
     */
    stakeUpdatedViaRewards(
        poolKey: ValidatorPoolKey,
        algoToAdd: uint64,
        rewardTokenAmountReserved: uint64,
        validatorCommission: uint64,
        saturatedBurnToFeeSink: uint64,
    ): void {
        this.verifyPoolKeyCaller(poolKey)

        // Update the specified amount of stake (+reward tokens reserved) - update pool stats, then total validator stats
        this.validatorList(poolKey.id).value.pools[poolKey.poolId - 1].totalAlgoStaked += algoToAdd
        this.validatorList(poolKey.id).value.state.totalAlgoStaked += algoToAdd
        this.validatorList(poolKey.id).value.state.rewardTokenHeldBack += rewardTokenAmountReserved

        this.totalAlgoStaked.value += algoToAdd

        // Re-validate the NFD as well while we're here, removing as associated nfd if no longer owner
        this.reverifyNFDOwnership(poolKey.id)

        emit<retiOP_epochRewardUpdate>({
            id: poolKey.id,
            poolNum: new Uint16(poolKey.poolId),
            poolAppId: poolKey.poolAppId,
            algoAdded: algoToAdd,
            rewardTokenHeldBack: rewardTokenAmountReserved,
            saturatedBurnToFeeSink: saturatedBurnToFeeSink,
            validatorCommission: validatorCommission,
        })
    }

    /**
     * stakeRemoved is called by Staking pools to inform the validator (us) that a particular amount of total stake has been removed
     * from the specified pool.  This is used to update the stats we have in our PoolInfo storage.
     * If any amount of rewardRemoved is specified, then that amount of reward is sent to the use
     * The calling App id is validated against our pool list as well.

     * @param {ValidatorPoolKey} poolKey calling us from which stake was removed
     * @param {Address} staker
     * @param {uint64} amountRemoved - algo amount removed
     * @param {uint64} rewardRemoved - if applicable, amount of token reward removed (by pool 1 caller) or TO remove and pay out (via pool 1 from different pool caller)
     * @param {boolean} stakerRemoved
     */
    stakeRemoved(
        poolKey: ValidatorPoolKey,
        staker: Account,
        amountRemoved: uint64,
        rewardRemoved: uint64,
        stakerRemoved: boolean,
    ): void {
        ensureBudget(300)
        this.verifyPoolKeyCaller(poolKey)

        // Yup - we've been called by an official staking pool telling us about stake that was removed from it,
        // so we can update our validator's staking stats.
        assert(amountRemoved > 0 || rewardRemoved > 0, 'should only be called if algo or reward was removed')

        // Remove the specified amount of stake - update pool stats, then total validator stats
        this.validatorList(poolKey.id).value.pools[poolKey.poolId - 1].totalAlgoStaked -= amountRemoved
        this.validatorList(poolKey.id).value.state.totalAlgoStaked -= amountRemoved
        this.totalAlgoStaked.value -= amountRemoved

        if (rewardRemoved > 0) {
            const rewardTokenID = this.validatorList(poolKey.id).value.config.rewardTokenId
            assert(rewardTokenID !== 0, "rewardRemoved can't be set if validator doesn't have reward token!")
            assert(
                this.validatorList(poolKey.id).value.state.rewardTokenHeldBack >= rewardRemoved,
                'reward being removed must be covered by hold back amount',
            )
            // If pool 1 is calling us, then they already sent the reward token to the staker and we just need to
            // update the rewardTokenHeldBack value and that's it.
            this.validatorList(poolKey.id).value.state.rewardTokenHeldBack -= rewardRemoved

            // If a different pool called us, then they CAN'T send the token - we've already updated the
            // rewardTokenHeldBack value and then call method in the pool that can only be called by us (the
            // validator), and can only be called on pool 1 [Index 0] - to have it do the token payout.
            if (poolKey.poolId !== 1) {
                abiCall<typeof StakingPool.prototype.payTokenReward>({
                    appId: Application(this.validatorList(poolKey.id).value.pools[0].poolAppId),
                    args: [staker, rewardTokenID, rewardRemoved],
                })
            }
            emit<retiOP_stakeRemoved>({
                id: poolKey.id,
                poolNum: new Uint16(poolKey.poolId),
                poolAppId: poolKey.poolAppId,
                staker: staker,
                amountUnstaked: amountRemoved,
                rewardTokenAssetId: rewardTokenID,
                rewardTokensReceived: rewardRemoved,
            })
        } else {
            emit<retiOP_stakeRemoved>({
                id: poolKey.id,
                poolNum: new Uint16(poolKey.poolId),
                poolAppId: poolKey.poolAppId,
                staker: staker,
                amountUnstaked: amountRemoved,
                // no tokens rewarded..
                rewardTokenAssetId: 0,
                rewardTokensReceived: 0,
            })
        }

        if (stakerRemoved) {
            // remove from that pool
            const totalStakers = this.validatorList(poolKey.id).value.pools[poolKey.poolId - 1].totalStakers.asUint64()
            this.validatorList(poolKey.id).value.pools[poolKey.poolId - 1].totalStakers = new Uint16(totalStakers - 1)
            // then update the staker set.
            const removeRet = this.removeFromStakerPoolSet(staker, {
                id: poolKey.id,
                poolId: poolKey.poolId,
                poolAppId: poolKey.poolAppId,
            })
            const stakerOutOfThisValidator = removeRet[0]
            const stakerOutOfProtocol = removeRet[1]
            // then remove as a staker from validator stats if they're 'out' of that validators pools
            if (stakerOutOfThisValidator) {
                this.validatorList(poolKey.id).value.state.totalStakers -= 1
            }
            // and remove from count of stakers in 'protocol' stats if they're out of ALL pools
            if (stakerOutOfProtocol) {
                this.numStakers.value -= 1
            }
        }
    }

    /**
     * Finds the pool for a staker based on the provided validator id, staker address, and amount to stake.
     * First checks the stakers 'already staked list' for the validator preferring those (adding if possible) then adds
     * to new pool if necessary.
     *
     * @param {ValidatorIdType} validatorId - The id of the validator.
     * @param {Address} staker - The address of the staker.
     * @param {uint64} amountToStake - The amount to stake.
     * @returns {ValidatorPoolKey, boolean, boolean} - The pool for the staker, true/false on whether the staker is 'new'
     * to this VALIDATOR, and true/false if staker is new to the protocol.
     */
    @readonly
    findPoolForStaker(
        validatorId: ValidatorIdType,
        staker: Account,
        amountToStake: uint64,
    ): [ValidatorPoolKey, boolean, boolean] {
        let isNewStakerToValidator = true
        let isNewStakerToProtocol = true
        // We have max per pool per validator - this value is stored in the pools as well, and they enforce it on their
        // addStake calls but the values should be the same, and we shouldn't even try to add stake if it won't even
        // be accepted.
        // However, one thing extra we also handle is have a 'soft' maximum per pool so that the amounts balance out based on
        // maxAllowedStake() (hard x % of all online stake) - taking that max / numPools.  This way as pools are added
        // to go beyond the individual pool maximum, the maximum for each pool starts to reflect the max allowed but
        // balanced across the pools.
        const maxPerPool = this.getCurMaxStakePerPool(validatorId)
        // If there's already a stake list for this account, walk that first, so if the staker is already in THIS
        // validator, then go to the stakers existing pool(s) w/ this validator first.
        if (this.stakerPoolSet(staker).exists) {
            const poolSet = clone(this.stakerPoolSet(staker).value)
            assert(validatorId !== 0)
            for (let i: uint64 = 0; i < poolSet.length; i += 1) {
                ensureBudget(300)
                if (poolSet[i].id === 0) {
                    continue
                }
                isNewStakerToProtocol = false
                if (poolSet[i].id === validatorId) {
                    // staker isn't new to this validator - but might still be out of room in this slot.
                    isNewStakerToValidator = false
                    if (
                        this.validatorList(validatorId).value.pools[poolSet[i].poolId - 1].totalAlgoStaked +
                            amountToStake <=
                        maxPerPool
                    ) {
                        return [poolSet[i], isNewStakerToValidator, isNewStakerToProtocol]
                    }
                }
            }
        }

        // No existing stake found or that we fit in to, so ensure the stake meets the 'minimum entry' amount
        assert(
            amountToStake >= this.validatorList(validatorId).value.config.minEntryStake,
            'must stake at least the minimum for this pool',
        )

        // Walk their desired validators pools and find free space
        const pools = clone(this.validatorList(validatorId).value.pools)
        const curNumPools = this.validatorList(validatorId).value.state.numPools.asUint64()
        for (let i: uint64 = 0; i < curNumPools; i += 1) {
            if (pools[i].totalAlgoStaked + amountToStake <= maxPerPool) {
                return [
                    { id: validatorId, poolId: i + 1, poolAppId: pools[i].poolAppId },
                    isNewStakerToValidator,
                    isNewStakerToProtocol,
                ]
            }
        }
        // Not found is poolId 0
        return [{ id: validatorId, poolId: 0, poolAppId: 0 }, isNewStakerToValidator, isNewStakerToProtocol]
    }

    /**
     * Find the specified pool (in any node number) and move it to the specified node.
     * The pool account is forced offline if moved so prior node will still run for 320 rounds but
     * new key goes online on new node soon after (320 rounds after it goes online)
     * No-op if success, asserts if not found or can't move  (no space in target)
     * [ ONLY OWNER OR MANAGER CAN CHANGE ]
     *
     * @param {ValidatorIdType} validatorId - The id of the validator.
     * @param {uint64} poolAppId
     * @param {uint64} nodeNum
     */
    movePoolToNode(validatorId: ValidatorIdType, poolAppId: uint64, nodeNum: uint64): void {
        this.callerMustBeOwnerOrManager(validatorId)

        const nodePoolAssignments = clone(this.validatorList(validatorId).value.nodePoolAssignments)
        assert(nodeNum >= 1 && nodeNum <= MAX_NODES, 'node number out of allowable range')
        // iterate  all the poolAppIds slots to find the specified poolAppId
        for (let srcNodeIdx: uint64 = 0; srcNodeIdx < MAX_NODES; srcNodeIdx += 1) {
            for (let i: uint64 = 0; i < MAX_POOLS_PER_NODE; i += 1) {
                if (nodePoolAssignments.nodes[srcNodeIdx].poolAppIds[i] === poolAppId) {
                    assert(nodeNum - 1 !== srcNodeIdx, "can't move to same node")
                    // found it - clear this slot
                    this.validatorList(validatorId).value.nodePoolAssignments.nodes[srcNodeIdx].poolAppIds[i] = 0

                    // Force that pool offline since it's moving nodes !
                    abiCall<typeof StakingPool.prototype.goOffline>({
                        appId: Application(poolAppId),
                    })

                    // now - add it to desired node
                    this.addPoolToNode(validatorId, poolAppId, nodeNum)
                    return
                }
            }
        }
        assert(false, "couldn't find pool app id in nodes to move")
    }

    /**
     * Sends the reward tokens held in pool 1 to specified receiver.
     * This is intended to be used by the owner when they want to get reward tokens 'back' which they sent to
     * the first pool (likely because validator is sunsetting.  Any tokens currently 'reserved' for stakers to claim will
     * NOT be sent as they must be held back for stakers to later claim.
     * [ ONLY OWNER CAN CALL]
     *
     * @param {ValidatorIdType} validatorId - The id of the validator.
     * @param {Address} receiver - the account to send the tokens to (must already be opted-in to the reward token)
     * @returns {uint64} the amount of reward token sent
     */
    emptyTokenRewards(validatorId: ValidatorIdType, receiver: Account): uint64 {
        this.callerMustBeOwner(validatorId)
        const rewardTokenId = this.validatorList(validatorId).value.config.rewardTokenId
        const rewardTokenHeldBack = this.validatorList(validatorId).value.state.rewardTokenHeldBack
        assert(rewardTokenId !== 0, "this validator doesn't have a reward token defined")
        const poolOneAppId = Application(this.validatorList(validatorId).value.pools[0].poolAppId)
        // get reward token balance in pool 1 (excluding the hold back amount)
        const tokenRewardBal: uint64 =
            op.AssetHolding.assetBalance(poolOneAppId.address, rewardTokenId)[0] - rewardTokenHeldBack

        // call pool 1 to send the token (minus the amount reserved) to the receiver
        abiCall<typeof StakingPool.prototype.payTokenReward>({
            appId: poolOneAppId,
            args: [receiver, rewardTokenId, tokenRewardBal],
        })
        assert(
            op.AssetHolding.assetBalance(poolOneAppId.address, rewardTokenId)[0] === rewardTokenHeldBack,
            'balance of remaining reward tokens should match the held back amount',
        )
        return tokenRewardBal
    }

    // ======
    // PRIVATE CONTRACT METHODS
    // Callable only internally
    // ======
    private callerMustBeOwner(validatorId: ValidatorIdType): void {
        assert(
            Txn.sender === this.validatorList(validatorId).value.config.owner,
            'can only be called by validator owner',
        )
    }

    private callerMustBeOwnerOrManager(validatorId: ValidatorIdType): void {
        assert(
            Txn.sender === this.validatorList(validatorId).value.config.owner ||
                Txn.sender === this.validatorList(validatorId).value.config.manager,
            'can only be called by owner or manager of validator',
        )
    }

    /**
     * verifyPoolKeyCaller verifies the passed in key (from a staking pool calling us to update metrics) is valid
     * and matches the information we have in our state.  'Fake' pools could call us to update our data, but they
     * can't fake the ids and most importantly application id(!) of the caller that has to match.
     */
    private verifyPoolKeyCaller(poolKey: ValidatorPoolKey): void {
        assert(this.validatorList(poolKey.id).exists, "the specified validator id isn't valid")
        assert(poolKey.poolId <= MAX_POOLS, 'pool id not in valid range')
        assert(
            poolKey.poolId > 0 && poolKey.poolId <= this.validatorList(poolKey.id).value.state.numPools.asUint64(),
            'pool id outside of range of pools created for this validator',
        )
        // validator id, pool id, pool app id might still be kind of spoofed, but they can't spoof us verifying they called us from
        // the contract address of the pool app id they represent.
        assert(
            poolKey.poolAppId === this.validatorList(poolKey.id).value.pools[poolKey.poolId - 1].poolAppId,
            "The passed in app id doesn't match the passed in ids",
        )
        // Sender has to match the pool app id passed in as well.
        assert(Txn.sender === Application(poolKey.poolAppId).address)
        // verify the state of the specified app (the staking pool itself) state matches as well !
        assert(poolKey.id === op.AppGlobal.getExUint64(poolKey.poolAppId, Bytes('validatorId'))[0])
        assert(poolKey.poolId === op.AppGlobal.getExUint64(poolKey.poolAppId, Bytes('poolId'))[0])
    }

    /**
     * This method verifies the ownership of NFD (Named Function Data) by a validator.
     * If the ownership is no longer valid, it removes the NFD from the validator's configuration.
     *
     * @param {ValidatorIdType} validatorId - The id of the validator whose data should be re-evaluated.
     */
    private reverifyNFDOwnership(validatorId: ValidatorIdType): void {
        const validatorConfig = clone(this.validatorList(validatorId).value.config)
        if (validatorConfig.nfdForInfo !== 0) {
            // We already verified the nfd id and name were correct at creation time - so we don't need to verify
            // the nfd is real anymore, just that its still owned by the validator.
            // const nfdOwner = Application(validatorConfig.nfdForInfo).globalState('i.owner.a') as Address
            const nfdOwner = new Address(op.AppGlobal.getExBytes(validatorConfig.nfdForInfo, Bytes('i.owner.a'))[0])
                .native

            // If they no longer own the nfd - remove it (!) from the validator config
            if (validatorConfig.owner !== nfdOwner && validatorConfig.manager !== nfdOwner) {
                // Remove the NFD from this validator !
                this.validatorList(validatorId).value.config.nfdForInfo = 0
            }
        }
    }

    private validateConfig(config: ValidatorConfig): void {
        // Verify all the values in the ValidatorConfig are correct
        assert(config.owner !== Global.zeroAddress)
        assert(config.manager !== Global.zeroAddress)
        assert(Txn.sender === config.owner, 'sender must be owner to add new validator')

        assert(
            config.entryGatingType.asUint64() >= GATING_TYPE_NONE &&
                config.entryGatingType.asUint64() <= GATING_TYPE_CONST_MAX,
            'gating type not valid',
        )
        assert(
            config.epochRoundLength.asUint64() >= MIN_EPOCH_LENGTH &&
                config.epochRoundLength.asUint64() <= MAX_EPOCH_LENGTH,
            'epoch length not in allowable range',
        )
        assert(
            config.percentToValidator.asUint64() >= MIN_PCT_TO_VALIDATOR &&
                config.percentToValidator.asUint64() <= MAX_PCT_TO_VALIDATOR,
            'commission percentage not valid',
        )
        if (config.percentToValidator.asUint64() !== 0) {
            assert(
                config.validatorCommissionAddress !== Global.zeroAddress,
                'validatorCommissionAddress must be set if percent to validator is not 0',
            )
        }
        assert(config.minEntryStake >= MIN_ALGO_STAKE_PER_POOL, 'staking pool must have minimum entry of 1 algo')
        // we don't care about maxAlgoPerPool - if set to 0 it floats w/ network incentive values: maxAlgoAllowedPerPool()
        assert(
            config.poolsPerNode.asUint64() > 0 && config.poolsPerNode.asUint64() <= MAX_POOLS_PER_NODE,
            'number of pools per node must be be between 1 and the maximum allowed number',
        )
        if (config.sunsettingOn !== 0) {
            assert(config.sunsettingOn > Global.latestTimestamp, 'sunsettingOn must be later than now if set')
        }
    }

    /**
     * Adds a stakers amount of algo to a validator pool, transferring the algo we received from them (already verified
     * by our caller) to the staking pool account, and then telling it about the amount being added for the specified
     * staker.
     *
     * @param {PayTxn} stakedAmountPayment - payment coming from staker to place into a pool
     * @param {ValidatorPoolKey} poolKey - The key of the validator pool.
     * @param {uint64} mbrAmtPaid - Amount the user is leaving behind in the validator to pay for their staker MBR cost
     * @param {boolean} isNewStakerToValidator - if this is a new, first-time staker to the validator
     * @param {boolean} isNewStakerToProtocol - if this is a new, first-time staker to the protocol
     */
    private callPoolAddStake(
        stakedAmountPayment: gtxn.PaymentTxn,
        poolKey: ValidatorPoolKey,
        mbrAmtPaid: uint64,
        isNewStakerToValidator: boolean,
        isNewStakerToProtocol: boolean,
    ): void {
        const poolAppId = this.validatorList(poolKey.id).value.pools[poolKey.poolId - 1].poolAppId

        // forward the payment on to the pool via 2 txns
        // payment + 'add stake' call
        abiCall<typeof StakingPool.prototype.addStake>({
            appId: Application(poolAppId),
            args: [
                // =======
                // THIS IS A SEND of the amount received right back out and into the staking pool contract account.
                itxn.payment({
                    amount: stakedAmountPayment.amount - mbrAmtPaid,
                    receiver: Application(poolAppId).address,
                }),
                // =======
                stakedAmountPayment.sender,
            ],
        })
        ensureBudget(500)

        // Stake has been added to the pool - get its new totals and add to our own tracking data
        const [poolNumStakers, numStakersDefined] = op.AppGlobal.getExUint64(poolAppId, Bytes('numStakers'))
        const [poolAlgoStaked, stakedDefined] = op.AppGlobal.getExUint64(poolAppId, Bytes('staked'))
        assert(numStakersDefined)
        assert(stakedDefined)

        this.validatorList(poolKey.id).value.pools[poolKey.poolId - 1].totalStakers = new Uint16(poolNumStakers)
        this.validatorList(poolKey.id).value.pools[poolKey.poolId - 1].totalAlgoStaked = poolAlgoStaked

        // now update our validator and global totals
        if (isNewStakerToValidator) {
            this.validatorList(poolKey.id).value.state.totalStakers += 1
        }
        if (isNewStakerToProtocol) {
            this.numStakers.value += 1
        }
        this.validatorList(poolKey.id).value.state.totalAlgoStaked += stakedAmountPayment.amount - mbrAmtPaid
        this.totalAlgoStaked.value += stakedAmountPayment.amount - mbrAmtPaid
    }

    private updateStakerPoolSet(staker: Account, poolKey: ValidatorPoolKey) {
        assert(this.stakerPoolSet(staker).exists)

        const poolSet = clone(this.stakerPoolSet(staker).value)
        let firstEmpty: uint64 = 0
        for (let i: uint64 = 0; i < this.stakerPoolSet(staker).value.length; i += 1) {
            if (
                poolSet[i].id === poolKey.id &&
                poolSet[i].poolId === poolKey.poolId &&
                poolSet[i].poolAppId === poolKey.poolAppId
            ) {
                // all bytes compare - already in pool set
                return
            }
            if (firstEmpty === 0 && poolSet[i].id === 0) {
                firstEmpty = i + 1
            }
        }
        if (firstEmpty === 0) {
            assert(false, 'No empty slot available in the staker pool set')
        }
        this.stakerPoolSet(staker).value[firstEmpty - 1] = clone(poolKey)
    }

    /**
     * Removes a pool key from the staker's active pool set - fails if not found (!)
     *
     * @param {Address} staker - The address of the staker.
     * @param {ValidatorPoolKey} poolKey - The pool key they should be stored in
     *
     * @return [boolean, boolean] [is the staker gone from ALL pools of the given VALIDATOR, and is staker gone from ALL pools]
     */
    private removeFromStakerPoolSet(staker: Account, poolKey: ValidatorPoolKey): [boolean, boolean] {
        // track how many pools staker is in, so we  can know if they remove all stake from all pools of this validator
        let inSameValidatorPoolCount: uint64 = 0
        let inAnyPoolCount: uint64 = 0
        let found = false

        const poolSet = clone(this.stakerPoolSet(staker).value)
        for (let i: uint64 = 0; i < this.stakerPoolSet(staker).value.length; i += 1) {
            if (poolSet[i].id === 0) {
                continue
            }
            inAnyPoolCount += 1
            if (poolSet[i].id === poolKey.id) {
                if (
                    poolSet[i].id === poolKey.id &&
                    poolSet[i].poolId === poolKey.poolId &&
                    poolSet[i].poolAppId === poolKey.poolAppId
                ) {
                    found = true
                    // 'zero' it out
                    this.stakerPoolSet(staker).value[i] = { id: 0, poolId: 0, poolAppId: 0 }
                } else {
                    inSameValidatorPoolCount += 1
                }
            }
        }
        if (!found) {
            assert(false, 'No matching slot found when told to remove a pool from the stakers set')
        }
        // Are they completely out of the staking pool ?
        return [inSameValidatorPoolCount === 0, inAnyPoolCount === 0]
    }

    private addPoolToNode(validatorId: ValidatorIdType, poolAppId: uint64, nodeNum: uint64) {
        const nodePoolAssignments = clone(this.validatorList(validatorId).value.nodePoolAssignments)
        const maxPoolsPerNodeForThisValidator = this.validatorList(validatorId).value.config.poolsPerNode
        // add the new staking pool to the specified node number - if there is room
        assert(nodeNum >= 1 && nodeNum <= MAX_NODES, 'node number not in valid range')
        // iterate all the poolAppIds slots to see if any are free (appid of 0)
        for (let i: uint64 = 0; i < maxPoolsPerNodeForThisValidator.asUint64(); i += 1) {
            if (nodePoolAssignments.nodes[nodeNum - 1].poolAppIds[i] === 0) {
                // update box data
                this.validatorList(validatorId).value.nodePoolAssignments.nodes[nodeNum - 1].poolAppIds[i] = poolAppId
                return
            }
        }
        assert(false, 'no available space in specified node for this pool')
    }

    /**
     * Checks if a staker meets the gating requirements specified by the validator.
     *
     * @param {ValidatorIdType} validatorId - The id of the validator.
     * @param {uint64} valueToVerify - The value to verify against the gating requirements.
     * @returns {void} or asserts if requirements not met.
     */
    private doesStakerMeetGating(validatorId: ValidatorIdType, valueToVerify: uint64): void {
        const type = this.validatorList(validatorId).value.config.entryGatingType
        if (type.asUint64() === GATING_TYPE_NONE) {
            return
        }
        const staker = Txn.sender
        const config = clone(this.validatorList(validatorId).value.config)

        // If an asset gating - check the balance requirement - can handle whether right asset afterward
        if (
            type.asUint64() === GATING_TYPE_ASSETS_CREATED_BY ||
            type.asUint64() === GATING_TYPE_ASSET_ID ||
            type.asUint64() === GATING_TYPE_CREATED_BY_NFD_ADDRESSES
        ) {
            assert(valueToVerify !== 0)
            let balRequired = this.validatorList(validatorId).value.config.gatingAssetMinBalance
            if (balRequired === 0) {
                balRequired = 1
            }
            assert(
                op.AssetHolding.assetBalance(staker, valueToVerify)[0] >= balRequired,
                'must have required minimum balance of validator defined token to add stake',
            )
        }
        if (type.asUint64() === GATING_TYPE_ASSETS_CREATED_BY) {
            assert(
                Asset(valueToVerify).creator === config.entryGatingAddress,
                'specified asset must be created by creator that the validator defined as a requirement to stake',
            )
        }
        if (type.asUint64() === GATING_TYPE_ASSET_ID) {
            let found = false
            for (const assetId of config.entryGatingAssets) {
                if (valueToVerify === assetId) {
                    found = true
                    break
                }
            }
            assert(found, 'specified asset must be identical to the asset id defined as a requirement to stake')
        }
        if (type.asUint64() === GATING_TYPE_CREATED_BY_NFD_ADDRESSES) {
            // Walk all the linked addresses defined by the gating NFD (stored packed in v.caAlgo.0.as as a 'set' of 32-byte PKs)
            // if any are the creator of the specified asset then we pass.
            assert(
                this.isAddressInNFDCAAlgoList(config.entryGatingAssets[0], Asset(valueToVerify).creator),
                'specified asset must be created by creator that is one of the linked addresses in an nfd',
            )
        }
        if (type.asUint64() === GATING_TYPE_SEGMENT_OF_NFD) {
            // verify nfd is real...
            const userOfferedNFDAppID = valueToVerify
            assert(this.isNFDAppIDValid(userOfferedNFDAppID), 'provided NFD must be valid')

            // now see if specified NFD's owner, or any of its caAlgo fields matches the staker's address
            assert(
                op.AppGlobal.getExBytes(userOfferedNFDAppID, Bytes('i.owner.a'))[0] === encodeArc4(staker) ||
                    this.isAddressInNFDCAAlgoList(userOfferedNFDAppID, staker),
                "provided nfd for entry isn't owned or linked to the staker",
            )

            // We at least know it's a real NFD - now... is it a segment of the root NFD the validator defined ?
            assert(
                op.btoi(op.AppGlobal.getExBytes(userOfferedNFDAppID, Bytes('i.parentAppID'))[0]) ===
                    config.entryGatingAssets[0],
                'specified nfd must be a segment of the nfd the validator specified as a requirement',
            )
        }
    }

    /**
     * Checks if the given NFD App id is valid.  Using only the App id there's no validation against the name (ie: that nfd X is name Y)
     * So it's assumed for the caller, the app id alone is fine.  The name is fetched from the specified app id and the two
     * together are used for validity check call to the nfd registry.
     *
     * @param {uint64} nfdAppID - The NFD App id to verify.
     *
     * @returns {boolean} - Returns true if the NFD App id is valid, otherwise false.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private isNFDAppIDValid(nfdAppID: uint64): boolean {
        // verify NFD user wants to offer up for testing is at least 'real' - since we just have app id - fetch its name then do is valid call
        // const userOfferedNFDName = Application(nfdAppID).globalState('i.name') as string

        // TODO: Is there a way to do an ABI call without a method prototype?
        // const userOfferedNFDName = op.AppGlobal.getExBytes(nfdAppID, Bytes('i.name'))

        // return abiCall<[string, uint64], boolean>({
        //   applicationID: Application(this.nfdRegistryAppId),
        //   name: 'isValidNfdAppId',
        //   methodArgs: [userOfferedNFDName, nfdAppID],
        // }).returnValue
        return true
    }

    /**
     * Checks if the specified address is present in an NFDs list of verified addresses.
     * The NFD is assumed to have already been validated as official.
     *
     * @param {uint64} nfdAppID - The NFD application id.
     * @param {Address} addrToFind - The address to find in the v.caAlgo.0.as property
     * @return {boolean} - `true` if the address is present, `false` otherwise.
     */
    private isAddressInNFDCAAlgoList(nfdAppID: uint64, addrToFind: Account): boolean {
        itxn.applicationCall({
            appId: Application(nfdAppID),
            appArgs: [Bytes('read_property'), Bytes('v.caAlgo.0.as')],
        }).submit()
        const caAlgoData = op.ITxn.lastLog
        for (let i: uint64 = 0; i < caAlgoData.length; i += 32) {
            const addr = op.extract(caAlgoData, i, 32)
            if (addr !== encodeArc4(Global.zeroAddress) && addr === encodeArc4(addrToFind)) {
                return true
            }
        }
        return false
    }

    /**
     * Returns the maximum allowed stake per validator based on a percentage of all current online stake before
     * the validator is considered saturated - where rewards are diminished.
     * NOTE: this function is defined twice - here and in staking pool contract.  Both must be identical.
     */
    private algoSaturationLevel(): uint64 {
        const online = this.getCurrentOnlineStake()

        return wideRatio([online, MAX_VALIDATOR_SOFT_PCT_OF_ONLINE_1DECIMAL], [1000])
    }

    /**
     * Returns the MAXIMUM allowed stake per validator based on a percentage of all current online stake.
     * Adding stake is completely blocked at this amount.
     */
    private maxAllowedStake(): uint64 {
        const online = this.getCurrentOnlineStake()

        return wideRatio([online, MAX_VALIDATOR_HARD_PCT_OF_ONLINE_1DECIMAL], [1000])
    }

    /**
     * Returns the MAXIMUM allowed stake per pool and still receive incentives - we'll treat this as the 'max per pool'
     */
    private maxAlgoAllowedPerPool(): uint64 {
        return Global.payoutsMaxBalance
    }

    private getCurrentOnlineStake(): uint64 {
        return op.onlineStake()
    }

    private minBalanceForAccount(
        contracts: uint64,
        extraPages: uint64,
        assets: uint64,
        localInts: uint64,
        localBytes: uint64,
        globalInts: uint64,
        globalBytes: uint64,
    ): uint64 {
        let minBal: uint64 = ALGORAND_ACCOUNT_MIN_BALANCE
        minBal += contracts * APPLICATION_BASE_FEE
        minBal += extraPages * APPLICATION_BASE_FEE
        minBal += assets * ASSET_HOLDING_FEE
        minBal += localInts * SSC_VALUE_UINT
        minBal += globalInts * SSC_VALUE_UINT
        minBal += localBytes * SSC_VALUE_BYTES
        minBal += globalBytes * SSC_VALUE_BYTES
        return minBal
    }

    private costForBoxStorage(totalNumBytes: uint64): uint64 {
        const SCBOX_PERBOX = 2500
        const SCBOX_PERBYTE = 400

        return SCBOX_PERBOX + totalNumBytes * SCBOX_PERBYTE
    }
}

// ======
// EVENTS - logged for notable changes
// ======

/**
 * Logs the addition of a new validator to the system, its initial owner and manager
 */
type retiOP_addedValidator = {
    // Assigned Validator ID
    id: uint64
    // Owner account
    owner: Account
    // Manager account
    manager: Account
}

/**
 * Logs the addition of a new pool to a particular validator ID
 */
type retiOP_validatorAddedPool = {
    // Validator ID
    id: uint64
    // Pool number
    num: Uint16
    // Pool application ID
    poolAppId: uint64
}

/**
 * Logs how much stake was added by a staker to a particular staking pool
 */
type retiOP_stakeAdded = {
    // Validator ID staker staked with
    id: uint64
    // Pool number stake went to
    poolNum: Uint16
    // Pool application ID
    poolAppId: uint64
    // Staker account
    staker: Account
    // Amount staked
    amountStaked: uint64
}

/**
 * Logs how much algo was detected as being added to a staking pool as part of epoch reward calculations.
 * Commission amount to validator, excess burned if pool is saturated, and the amount of tokens held back are logged as well.
 */
type retiOP_epochRewardUpdate = {
    // Validator ID
    id: uint64
    // Pool number rewards were accounted for
    poolNum: Uint16
    // Pool application ID
    poolAppId: uint64
    // Amount validator received (if anything)
    validatorCommission: uint64
    // Saturated burn sent BACK to fee sink (if saturated pool)
    saturatedBurnToFeeSink: uint64
    // Algo amount added
    algoAdded: uint64
    // Reward token amount held back for future payout
    rewardTokenHeldBack: uint64
}

/**
 * Logs how much stake was removed by a staker from a particular staking pool
 */
type retiOP_stakeRemoved = {
    // Validator ID staker staked with
    id: uint64
    // Pool number stake was removed from
    poolNum: Uint16
    // Pool application ID
    poolAppId: uint64
    // Staker account
    staker: Account
    // Amount of stake removed
    amountUnstaked: uint64
    // Number of reward tokens also received
    rewardTokensReceived: uint64
    // Reward token (if applicable) asset id
    rewardTokenAssetId: uint64
}
