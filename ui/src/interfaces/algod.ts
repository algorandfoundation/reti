import { AlgoAmount } from '@algorandfoundation/algokit-utils/types/amount'
import algosdk, { BaseHTTPClientError, BaseHTTPClientResponse } from 'algosdk'

export interface AssetCreatorHolding
  extends Omit<algosdk.modelsv2.AssetHolding, 'getEncodingSchema' | 'toEncodingData'> {
  creator: string
}

export type AccountBalance = {
  amount: AlgoAmount
  available: AlgoAmount
  minimum: AlgoAmount
}

export type Exclude =
  | 'all'
  | 'assets'
  | 'created-assets'
  | 'apps-local-state'
  | 'created-apps'
  | 'none'

export class AlgodHttpError extends Error implements BaseHTTPClientError {
  constructor(
    message: string,
    public response: BaseHTTPClientResponse,
  ) {
    super(message)
    this.name = 'AlgodHttpError'
    this.response = response
  }
}

export interface NodeStatusResponse {
  /**
   * CatchupTime in nanoseconds
   */
  'catchup-time': number | bigint
  /**
   * LastRound indicates the last round seen
   */
  'last-round': number | bigint
  /**
   * LastVersion indicates the last consensus version supported
   */
  'last-version': string
  /**
   * NextVersion of consensus protocol to use
   */
  'next-version': string
  /**
   * NextVersionRound is the round at which the next consensus version will apply
   */
  'next-version-round': number | bigint
  /**
   * NextVersionSupported indicates whether the next consensus version is supported
   * by this node
   */
  'next-version-supported': boolean
  /**
   * StoppedAtUnsupportedRound indicates that the node does not support the new
   * rounds and has stopped making progress
   */
  'stopped-at-unsupported-round': boolean
  /**
   * TimeSinceLastRound in nanoseconds
   */
  'time-since-last-round': number | bigint
  /**
   * The current catchpoint that is being caught up to
   */
  catchpoint?: string
  /**
   * The number of blocks that have already been obtained by the node as part of the
   * catchup
   */
  'catchpoint-acquired-blocks'?: number | bigint
  /**
   * The number of accounts from the current catchpoint that have been processed so
   * far as part of the catchup
   */
  'catchpoint-processed-accounts'?: number | bigint
  /**
   * The number of key-values (KVs) from the current catchpoint that have been
   * processed so far as part of the catchup
   */
  'catchpoint-processed-kvs'?: number | bigint
  /**
   * The total number of accounts included in the current catchpoint
   */
  'catchpoint-total-accounts'?: number | bigint
  /**
   * The total number of blocks that are required to complete the current catchpoint
   * catchup
   */
  'catchpoint-total-blocks'?: number | bigint
  /**
   * The total number of key-values (KVs) included in the current catchpoint
   */
  'catchpoint-total-kvs'?: number | bigint
  /**
   * The number of accounts from the current catchpoint that have been verified so
   * far as part of the catchup
   */
  'catchpoint-verified-accounts'?: number | bigint
  /**
   * The number of key-values (KVs) from the current catchpoint that have been
   * verified so far as part of the catchup
   */
  'catchpoint-verified-kvs'?: number | bigint
  /**
   * The last catchpoint seen by the node
   */
  'last-catchpoint'?: string
  /**
   * Upgrade delay
   */
  'upgrade-delay'?: number | bigint
  /**
   * Next protocol round
   */
  'upgrade-next-protocol-vote-before'?: number | bigint
  /**
   * No votes cast for consensus upgrade
   */
  'upgrade-no-votes'?: number | bigint
  /**
   * This node's upgrade vote
   */
  'upgrade-node-vote'?: boolean
  /**
   * Total voting rounds for current upgrade
   */
  'upgrade-vote-rounds'?: number | bigint
  /**
   * Total votes cast for consensus upgrade
   */
  'upgrade-votes'?: number | bigint
  /**
   * Yes votes required for consensus upgrade
   */
  'upgrade-votes-required'?: number | bigint
  /**
   * Yes votes cast for consensus upgrade
   */
  'upgrade-yes-votes'?: number | bigint
}

/**
 * Encoded block object.
 */
export interface BlockResponse {
  /**
   * Block header data.
   */
  block: BlockHeader
  /**
   * Optional certificate object. This is only included when the format is set to
   * message pack.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cert?: Record<string, any>
}

/**
 * Represents the metadata and state of a block.
 *
 * For more information, refer to: https://github.com/algorand/go-algorand/blob/master/data/bookkeeping/block.go
 */
export interface BlockHeader {
  /**
   * Transaction fees
   */
  fees: string
  /**
   * The number of leftover MicroAlgos after rewards distribution
   */
  frac: number
  /**
   * Genesis ID to which this block belongs
   */
  gen: string
  /**
   * Genesis hash to which this block belongs.
   */
  gh: string
  /**
   * The hash of the previous block
   */
  prev: string
  /**
   * Current protocol
   */
  proto: string
  /**
   * Rewards rate
   */
  rate: number
  /**
   * Round number
   */
  rnd: number
  /**
   * Rewards recalculation round
   */
  rwcalr: number
  /**
   * Rewards pool
   */
  rwd: string
  /**
   * Sortition seed
   */
  seed: string
  /**
   * Timestamp in seconds since epoch
   */
  ts: number
  /**
   * Transaction root SHA512_256
   */
  txn: string
  /**
   * Transaction root SHA256
   */
  txn256: string
  /**
   * StateProofTracking map of type to tracking data
   */
  spt: Map<number, Uint8Array>
}

/**
 * Application index and its parameters
 */
export interface Application {
  /**
   * (appidx) application index.
   */
  id: number | bigint
  /**
   * (appparams) application parameters.
   */
  params: ApplicationParams
}

/**
 * Stores the global information associated with an application.
 */
export interface ApplicationParams {
  /**
   * (approv) approval program.
   */
  'approval-program': string
  /**
   * (clearp) approval program.
   */
  'clear-state-program': string
  /**
   * The address that created this application. This is the address where the
   * parameters and global state for this application can be found.
   */
  creator: string
  /**
   * (epp) the amount of extra program pages available to this app.
   */
  'extra-program-pages'?: number | bigint
  /**
   * (gs) global state
   */
  'global-state'?: TealKeyValue[]
  /**
   * (gsch) global schema
   */
  'global-state-schema'?: ApplicationStateSchema
  /**
   * (lsch) local schema
   */
  'local-state-schema'?: ApplicationStateSchema
}

/**
 * Represents a key-value pair in an application store.
 */
export interface TealKeyValue {
  key: string
  /**
   * Represents a TEAL value.
   */
  value: TealValue
}

/**
 * Represents a TEAL value.
 */
export interface TealValue {
  /**
   * (tt) value type. Value `1` refers to **bytes**, value `2` refers to **uint**
   */
  type: number | bigint
  /**
   * (tb) bytes value.
   */
  bytes: string
  /**
   * (ui) uint value.
   */
  uint: number | bigint
}

/**
 * Specifies maximums on the number of each type that may be stored.
 */
export interface ApplicationStateSchema {
  /**
   * (nui) num of uints.
   */
  'num-uint': number | bigint
  /**
   * (nbs) num of byte slices.
   */
  'num-byte-slice': number | bigint
}

/**
 * Interfaces for the encoded transaction object. Every property is labelled with its associated Transaction type property
 */

export interface EncodedAssetParams {
  /**
   * assetTotal
   */
  t: number | bigint

  /**
   * assetDefaultFrozen
   */
  df: boolean

  /**
   * assetDecimals
   */
  dc: number

  /**
   * assetManager
   */
  m?: Buffer

  /**
   * assetReserve
   */
  r?: Buffer

  /**
   * assetFreeze
   */
  f?: Buffer

  /**
   * assetClawback
   */
  c?: Buffer

  /**
   * assetName
   */
  an?: string

  /**
   * assetUnitName
   */
  un?: string

  /**
   * assetURL
   */
  au?: string

  /**
   * assetMetadataHash
   */
  am?: Buffer
}

export interface EncodedLocalStateSchema {
  /**
   * appLocalInts
   */
  nui: number

  /**
   * appLocalByteSlices
   */
  nbs: number
}

export interface EncodedGlobalStateSchema {
  /**
   * appGlobalInts
   */
  nui: number

  /**
   * appGlobalByteSlices
   */
  nbs: number
}

export interface EncodedBoxReference {
  /**
   * index of the app ID in the foreign apps array
   */
  i: number

  /**
   * box name
   */
  n: Uint8Array
}

/**
 * A rough structure for the encoded transaction object. Every property is labelled with its associated Transaction type property
 */
export interface EncodedTransaction {
  /**
   * fee
   */
  fee?: number

  /**
   * firstRound
   */
  fv?: number

  /**
   * lastRound
   */
  lv: number

  /**
   * note
   */
  note?: Buffer

  /**
   * from
   */
  snd: Buffer

  /**
   * type
   */
  type: string

  /**
   * genesisID
   */
  gen: string

  /**
   * genesisHash
   */
  gh: Buffer

  /**
   * lease
   */
  lx?: Buffer

  /**
   * group
   */
  grp?: Buffer

  /**
   * amount
   */
  amt?: number | bigint

  /**
   * amount (but for asset transfers)
   */
  aamt?: number | bigint

  /**
   * closeRemainderTo
   */
  close?: Buffer

  /**
   * closeRemainderTo (but for asset transfers)
   */
  aclose?: Buffer

  /**
   * reKeyTo
   */
  rekey?: Buffer

  /**
   * to
   */
  rcv?: Buffer

  /**
   * to (but for asset transfers)
   */
  arcv?: Buffer

  /**
   * voteKey
   */
  votekey?: Buffer

  /**
   * selectionKey
   */
  selkey?: Buffer

  /**
   * stateProofKey
   */
  sprfkey?: Buffer

  /**
   * voteFirst
   */
  votefst?: number

  /**
   * voteLast
   */
  votelst?: number

  /**
   * voteKeyDilution
   */
  votekd?: number

  /**
   * nonParticipation
   */
  nonpart?: boolean

  /**
   * assetIndex
   */
  caid?: number

  /**
   * assetIndex (but for asset transfers)
   */
  xaid?: number

  /**
   * assetIndex (but for asset freezing/unfreezing)
   */
  faid?: number

  /**
   * freezeState
   */
  afrz?: boolean

  /**
   * freezeAccount
   */
  fadd?: Buffer

  /**
   * assetRevocationTarget
   */
  asnd?: Buffer

  /**
   * See EncodedAssetParams type
   */
  apar?: EncodedAssetParams

  /**
   * appIndex
   */
  apid?: number

  /**
   * appOnComplete
   */
  apan?: number

  /**
   * See EncodedLocalStateSchema type
   */
  apls?: EncodedLocalStateSchema

  /**
   * See EncodedGlobalStateSchema type
   */
  apgs?: EncodedGlobalStateSchema

  /**
   * appForeignApps
   */
  apfa?: number[]

  /**
   * appForeignAssets
   */
  apas?: number[]

  /**
   * appApprovalProgram
   */
  apap?: Buffer

  /**
   * appClearProgram
   */
  apsu?: Buffer

  /**
   * appArgs
   */
  apaa?: Buffer[]

  /**
   * appAccounts
   */
  apat?: Buffer[]

  /**
   * extraPages
   */
  apep?: number

  /**
   * boxes
   */
  apbx?: EncodedBoxReference[]

  /*
   * stateProofType
   */
  sptype?: number | bigint

  /**
   * stateProof
   */
  sp?: Buffer

  /**
   * stateProofMessage
   */
  spmsg?: Buffer
}

export interface EncodedSubsig {
  /**
   *  The public key
   */
  pk: Uint8Array

  /**
   * The signature provided by the public key, if any
   */
  s?: Uint8Array
}

/**
 * A rough structure for the encoded multi signature transaction object.
 * Every property is labelled with its associated `MultisigMetadata` type property
 */
export interface EncodedMultisig {
  /**
   * version
   */
  v: number

  /**
   * threshold
   */
  thr: number

  /**
   * Subset of signatures. A threshold of `thr` signors is required.
   */
  subsig: EncodedSubsig[]
}

export interface EncodedLogicSig {
  l: Uint8Array
  arg?: Uint8Array[]
  sig?: Uint8Array
  msig?: EncodedMultisig
}

export interface EncodedLogicSigAccount {
  lsig: EncodedLogicSig
  sigkey?: Uint8Array
}

/**
 * A structure for an encoded signed transaction object
 */
export interface EncodedSignedTransaction {
  /**
   * Transaction signature
   */
  sig?: Buffer

  /**
   * The transaction that was signed
   */
  txn: EncodedTransaction

  /**
   * Multisig structure
   */
  msig?: EncodedMultisig

  /**
   * Logic signature
   */
  lsig?: EncodedLogicSig

  /**
   * The signer, if signing with a different key than the Transaction type `from` property indicates
   */
  sgnr?: Buffer
}

/**
 * Request type for simulation endpoint.
 */
export interface SimulateRequest {
  /**
   * The transaction groups to simulate.
   */
  'txn-groups': SimulateRequestTransactionGroup[]
  /**
   * Allows transactions without signatures to be simulated as if they had correct
   * signatures.
   */
  'allow-empty-signatures'?: boolean
  /**
   * Lifts limits on log opcode usage during simulation.
   */
  'allow-more-logging'?: boolean
  /**
   * Allows access to unnamed resources during simulation.
   */
  'allow-unnamed-resources'?: boolean
  /**
   * An object that configures simulation execution trace.
   */
  'exec-trace-config'?: SimulateTraceConfig
  /**
   * Applies extra opcode budget during simulation for each transaction group.
   */
  'extra-opcode-budget'?: number | bigint
  /**
   * If provided, specifies the round preceding the simulation. State changes through
   * this round will be used to run this simulation. Usually only the 4 most recent
   * rounds will be available (controlled by the node config value MaxAcctLookback).
   * If not specified, defaults to the latest available round.
   */
  round?: number | bigint
}

/**
 * A transaction group to simulate.
 */
export interface SimulateRequestTransactionGroup {
  /**
   * An atomic transaction group.
   */
  txns: EncodedSignedTransaction[]
}

/**
 * Result of a transaction group simulation.
 */
export interface SimulateResponse {
  /**
   * The round immediately preceding this simulation. State changes through this
   * round were used to run this simulation.
   */
  'last-round': number | bigint
  /**
   * A result object for each transaction group that was simulated.
   */
  'txn-groups': SimulateTransactionGroupResult[]
  /**
   * The version of this response object.
   */
  version: number | bigint
  /**
   * The set of parameters and limits override during simulation. If this set of
   * parameters is present, then evaluation parameters may differ from standard
   * evaluation in certain ways.
   */
  'eval-overrides'?: SimulationEvalOverrides
  /**
   * An object that configures simulation execution trace.
   */
  'exec-trace-config'?: SimulateTraceConfig
  /**
   * Initial states of resources that were accessed during simulation.
   */
  'initial-states'?: SimulateInitialStates
}

/**
 * Simulation result for an atomic transaction group
 */
export interface SimulateTransactionGroupResult {
  /**
   * Simulation result for individual transactions
   */
  'txn-results': SimulateTransactionResult[]
  /**
   * Total budget added during execution of app calls in the transaction group.
   */
  'app-budget-added'?: number | bigint
  /**
   * Total budget consumed during execution of app calls in the transaction group.
   */
  'app-budget-consumed'?: number | bigint
  /**
   * If present, indicates which transaction in this group caused the failure. This
   * array represents the path to the failing transaction. Indexes are zero based,
   * the first element indicates the top-level transaction, and successive elements
   * indicate deeper inner transactions.
   */
  'failed-at'?: (number | bigint)[]
  /**
   * If present, indicates that the transaction group failed and specifies why that
   * happened
   */
  'failure-message'?: string
  /**
   * These are resources that were accessed by this group that would normally have
   * caused failure, but were allowed in simulation. Depending on where this object
   * is in the response, the unnamed resources it contains may or may not qualify for
   * group resource sharing. If this is a field in SimulateTransactionGroupResult,
   * the resources do qualify, but if this is a field in SimulateTransactionResult,
   * they do not qualify. In order to make this group valid for actual submission,
   * resources that qualify for group sharing can be made available by any
   * transaction of the group; otherwise, resources must be placed in the same
   * transaction which accessed them.
   */
  'unnamed-resources-accessed'?: SimulateUnnamedResourcesAccessed
}

/**
 * Simulation result for an atomic transaction group
 */
export interface SimulateTransactionResult {
  /**
   * Details about a pending transaction. If the transaction was recently confirmed,
   * includes confirmation details like the round and reward details.
   */
  'txn-result': PendingTransactionResponse
  /**
   * Budget used during execution of an app call transaction. This value includes
   * budged used by inner app calls spawned by this transaction.
   */
  'app-budget-consumed'?: number | bigint
  /**
   * The execution trace of calling an app or a logic sig, containing the inner app
   * call trace in a recursive way.
   */
  'exec-trace'?: SimulationTransactionExecTrace
  /**
   * Budget used during execution of a logic sig transaction.
   */
  'logic-sig-budget-consumed'?: number | bigint
  /**
   * These are resources that were accessed by this group that would normally have
   * caused failure, but were allowed in simulation. Depending on where this object
   * is in the response, the unnamed resources it contains may or may not qualify for
   * group resource sharing. If this is a field in SimulateTransactionGroupResult,
   * the resources do qualify, but if this is a field in SimulateTransactionResult,
   * they do not qualify. In order to make this group valid for actual submission,
   * resources that qualify for group sharing can be made available by any
   * transaction of the group; otherwise, resources must be placed in the same
   * transaction which accessed them.
   */
  'unnamed-resources-accessed'?: SimulateUnnamedResourcesAccessed
}

/**
 * Details about a pending transaction. If the transaction was recently confirmed,
 * includes confirmation details like the round and reward details.
 */
export interface PendingTransactionResponse {
  /**
   * Indicates that the transaction was kicked out of this node's transaction pool
   * (and specifies why that happened). An empty string indicates the transaction
   * wasn't kicked out of this node's txpool due to an error.
   */
  'pool-error': string
  /**
   * The raw signed transaction.
   */
  txn: EncodedSignedTransaction
  /**
   * The application index if the transaction was found and it created an
   * application.
   */
  'application-index'?: number | bigint
  /**
   * The number of the asset's unit that were transferred to the close-to address.
   */
  'asset-closing-amount'?: number | bigint
  /**
   * The asset index if the transaction was found and it created an asset.
   */
  'asset-index'?: number | bigint
  /**
   * Rewards in microalgos applied to the close remainder to account.
   */
  'close-rewards'?: number | bigint
  /**
   * Closing amount for the transaction.
   */
  'closing-amount'?: number | bigint
  /**
   * The round where this transaction was confirmed, if present.
   */
  'confirmed-round'?: number | bigint
  /**
   * Global state key/value changes for the application being executed by this
   * transaction.
   */
  'global-state-delta'?: EvalDeltaKeyValue[]
  /**
   * Inner transactions produced by application execution.
   */
  'inner-txns'?: PendingTransactionResponse[]
  /**
   * Local state key/value changes for the application being executed by this
   * transaction.
   */
  'local-state-delta'?: AccountStateDelta[]
  /**
   * Logs for the application being executed by this transaction.
   */
  logs?: Uint8Array[]
  /**
   * Rewards in microalgos applied to the receiver account.
   */
  'receiver-rewards'?: number | bigint
  /**
   * Rewards in microalgos applied to the sender account.
   */
  'sender-rewards'?: number | bigint
}

/**
 * The execution trace of calling an app or a logic sig, containing the inner app
 * call trace in a recursive way.
 */
export interface SimulationTransactionExecTrace {
  /**
   * SHA512_256 hash digest of the approval program executed in transaction.
   */
  'approval-program-hash'?: Uint8Array
  /**
   * Program trace that contains a trace of opcode effects in an approval program.
   */
  'approval-program-trace'?: SimulationOpcodeTraceUnit[]
  /**
   * SHA512_256 hash digest of the clear state program executed in transaction.
   */
  'clear-state-program-hash'?: Uint8Array
  /**
   * Program trace that contains a trace of opcode effects in a clear state program.
   */
  'clear-state-program-trace'?: SimulationOpcodeTraceUnit[]
  /**
   * An array of SimulationTransactionExecTrace representing the execution trace of
   * any inner transactions executed.
   */
  'inner-trace'?: SimulationTransactionExecTrace[]
  /**
   * SHA512_256 hash digest of the logic sig executed in transaction.
   */
  'logic-sig-hash'?: Uint8Array
  /**
   * Program trace that contains a trace of opcode effects in a logic sig.
   */
  'logic-sig-trace'?: SimulationOpcodeTraceUnit[]
}

/**
 * These are resources that were accessed by this group that would normally have
 * caused failure, but were allowed in simulation. Depending on where this object
 * is in the response, the unnamed resources it contains may or may not qualify for
 * group resource sharing. If this is a field in SimulateTransactionGroupResult,
 * the resources do qualify, but if this is a field in SimulateTransactionResult,
 * they do not qualify. In order to make this group valid for actual submission,
 * resources that qualify for group sharing can be made available by any
 * transaction of the group; otherwise, resources must be placed in the same
 * transaction which accessed them.
 */
export interface SimulateUnnamedResourcesAccessed {
  /**
   * The unnamed accounts that were referenced. The order of this array is arbitrary.
   */
  accounts?: string[]
  /**
   * The unnamed application local states that were referenced. The order of this
   * array is arbitrary.
   */
  'app-locals'?: ApplicationLocalReference[]
  /**
   * The unnamed applications that were referenced. The order of this array is
   * arbitrary.
   */
  apps?: (number | bigint)[]
  /**
   * The unnamed asset holdings that were referenced. The order of this array is
   * arbitrary.
   */
  'asset-holdings'?: AssetHoldingReference[]
  /**
   * The unnamed assets that were referenced. The order of this array is arbitrary.
   */
  assets?: (number | bigint)[]
  /**
   * The unnamed boxes that were referenced. The order of this array is arbitrary.
   */
  boxes?: BoxReference[]
  /**
   * The number of extra box references used to increase the IO budget. This is in
   * addition to the references defined in the input transaction group and any
   * referenced to unnamed boxes.
   */
  'extra-box-refs'?: number | bigint
}

/**
 * Key-value pairs for StateDelta.
 */
export interface EvalDeltaKeyValue {
  key: string
  /**
   * Represents a TEAL value delta.
   */
  value: EvalDelta
}

/**
 * Represents a TEAL value delta.
 */
export interface EvalDelta {
  /**
   * (at) delta action.
   */
  action: number | bigint
  /**
   * (bs) bytes value.
   */
  bytes?: string
  /**
   * (ui) uint value.
   */
  uint?: number | bigint
}

/**
 * Application state delta.
 */
export interface AccountStateDelta {
  address: string
  /**
   * Application state delta.
   */
  delta: EvalDeltaKeyValue[]
}

/**
 * The set of trace information and effect from evaluating a single opcode.
 */
export interface SimulationOpcodeTraceUnit {
  /**
   * The program counter of the current opcode being evaluated.
   */
  pc: number | bigint
  /**
   * The writes into scratch slots.
   */
  'scratch-changes'?: ScratchChange[]
  /**
   * The indexes of the traces for inner transactions spawned by this opcode, if any.
   */
  'spawned-inners'?: (number | bigint)[]
  /**
   * The values added by this opcode to the stack.
   */
  'stack-additions'?: AvmValue[]
  /**
   * The number of deleted stack values by this opcode.
   */
  'stack-pop-count'?: number | bigint
  /**
   * The operations against the current application's states.
   */
  'state-changes'?: ApplicationStateOperation[]
}

/**
 * A write operation into a scratch slot.
 */
export interface ScratchChange {
  /**
   * Represents an AVM value.
   */
  'new-value': AvmValue
  /**
   * The scratch slot written.
   */
  slot: number | bigint
}

/**
 * An operation against an application's global/local/box state.
 */
export interface ApplicationStateOperation {
  /**
   * Type of application state. Value `g` is **global state**, `l` is **local
   * state**, `b` is **boxes**.
   */
  'app-state-type': string
  /**
   * The key (name) of the global/local/box state.
   */
  key: Uint8Array
  /**
   * Operation type. Value `w` is **write**, `d` is **delete**.
   */
  operation: string
  /**
   * For local state changes, the address of the account associated with the local
   * state.
   */
  account?: string
  /**
   * Represents an AVM value.
   */
  'new-value'?: AvmValue
}

/**
 * Represents an AVM value.
 */
export interface AvmValue {
  /**
   * value type. Value `1` refers to **bytes**, value `2` refers to **uint64**
   */
  type: number | bigint
  /**
   * bytes value.
   */
  bytes?: Uint8Array
  /**
   * uint value.
   */
  uint?: number | bigint
}

/**
 * Represents an AVM key-value pair in an application store.
 */
export interface AvmKeyValue {
  key: Uint8Array
  /**
   * Represents an AVM value.
   */
  value: AvmValue
}

/**
 * References an account's local state for an application.
 */
export interface ApplicationLocalReference {
  /**
   * Address of the account with the local state.
   */
  account: string
  /**
   * Application ID of the local state application.
   */
  app: number | bigint
}

/**
 * References an asset held by an account.
 */
export interface AssetHoldingReference {
  /**
   * Address of the account holding the asset.
   */
  account: string
  /**
   * Asset ID of the holding.
   */
  asset: number | bigint
}

/**
 * References a box of an application.
 */
export interface BoxReference {
  /**
   * Application ID which this box belongs to
   */
  app: number | bigint
  /**
   * Base64 encoded box name
   */
  name: Uint8Array
}

/**
 * The set of parameters and limits override during simulation. If this set of
 * parameters is present, then evaluation parameters may differ from standard
 * evaluation in certain ways.
 */
export interface SimulationEvalOverrides {
  /**
   * If true, transactions without signatures are allowed and simulated as if they
   * were properly signed.
   */
  'allow-empty-signatures'?: boolean
  /**
   * If true, allows access to unnamed resources during simulation.
   */
  'allow-unnamed-resources'?: boolean
  /**
   * The extra opcode budget added to each transaction group during simulation
   */
  'extra-opcode-budget'?: number | bigint
  /**
   * The maximum log calls one can make during simulation
   */
  'max-log-calls'?: number | bigint
  /**
   * The maximum byte number to log during simulation
   */
  'max-log-size'?: number | bigint
}

export interface SimulateTraceConfig {
  /**
   * A boolean option for opting in execution trace features simulation endpoint.
   */
  enable?: boolean
  /**
   * A boolean option enabling returning scratch slot changes together with execution
   * trace during simulation.
   */
  'scratch-change'?: boolean
  /**
   * A boolean option enabling returning stack changes together with execution trace
   * during simulation.
   */
  'stack-change'?: boolean
  /**
   * A boolean option enabling returning application state changes (global, local,
   * and box changes) with the execution trace during simulation.
   */
  'state-change'?: boolean
}

/**
 * Initial states of resources that were accessed during simulation.
 */
export interface SimulateInitialStates {
  /**
   * The initial states of accessed application before simulation. The order of this
   * array is arbitrary.
   */
  'app-initial-states'?: ApplicationInitialStates[]
}

/**
 * An application's initial global/local/box states that were accessed during
 * simulation.
 */
export interface ApplicationInitialStates {
  /**
   * Application index.
   */
  id: number | bigint
  /**
   * An application's global/local/box state.
   */
  'app-boxes'?: ApplicationKVStorage
  /**
   * An application's global/local/box state.
   */
  'app-globals'?: ApplicationKVStorage
  /**
   * An application's initial local states tied to different accounts.
   */
  'app-locals'?: ApplicationKVStorage[]
}

/**
 * An application's global/local/box state.
 */
export interface ApplicationKVStorage {
  /**
   * Key-Value pairs representing application states.
   */
  kvs: AvmKeyValue[]
  /**
   * The address of the account associated with the local state.
   */
  account?: string
}
