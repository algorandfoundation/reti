# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Réti Open Pooling — a decentralized staking pool protocol on Algorand. Three deliverables in one repo:

| Dir | What | Stack |
| --- | --- | --- |
| `contracts/` | The protocol itself (`ValidatorRegistry` + `StakingPool`) | TEALScript, vitest |
| `nodemgr/` | CLI + background daemon node runners install on their Algorand node | Go 1.23, urfave/cli v3 |
| `ui/` | Staking / validator-management dashboard | Vite, React 18, TanStack Router+Query |

`contracts`, `contracts/bootstrap`, and `ui` are a pnpm workspace (Node 20, pnpm 9.15.9). `nodemgr` is a separate Go module.

## Local development loop

```bash
pnpm install
cd contracts && pnpm run localnet   # algokit localnet named "reti" w/ ./localnet_config
cd contracts/bootstrap && pnpm run bootstrap
cd ui && pnpm run dev:localnet      # http://localhost:5173
```

The localnet **must** be the named `reti` sandbox from `contracts/localnet_config` — it runs a trunk algod with AVM 11 and a lowered stake requirement, and the contract tests manipulate block timestamp offsets, which a stock localnet won't allow.

`bootstrap` deploys the pool template + master validator and writes two files consumed by the rest of the repo: `ui/.env.localnet` (sets `VITE_RETI_APP_ID`) and `nodemgr/.env.sandbox` (test mnemonics + `RETI_APPID`). Re-run it after wiping localnet. Network variants: `pnpm run bootstrap:testnet` / `:mainnet` from the repo root.

## Commands

**contracts/**
```bash
pnpm run build            # tealscript compile -> artifacts -> algokit client gen -> update_contract_artifacts.sh
pnpm run noalgobuild      # same, but --skip-algod (no localnet needed)
pnpm run test             # build + vitest (needs the reti localnet running)
pnpm run retest           # vitest only, skips the rebuild — use this while iterating on tests
pnpm exec vitest --run --test-timeout=120000 -t "adds a staking pool"   # single test
pnpm run lint | prettier | typecheck
```

**ui/**
```bash
pnpm run dev:localnet     # 5173 | dev:fnet 5203 | dev:testnet & dev:betanet 5183 | dev:mainnet 5193
pnpm run test             # vitest, non-watch, src/**/*.spec.ts(x)
pnpm exec vitest run src/utils/format.spec.ts     # single file
pnpm run playwright:test  # e2e; needs localnet + bootstrap, boots dev:localnet itself
pnpm run lint | prettier | typecheck | build
```

**nodemgr/** (no Go tests exist)
```bash
go build ./... && go vet ./...
go run . -n sandbox validator info        # top-level cmds: daemon, validator, pool, key
```

CI enforces, per package: lint + prettier + typecheck (+ test + build for `ui`), plus `contracts retest` and Playwright on PRs into `main`/`dev`. Run those before declaring work done.

## Architecture

### Protocol

`ValidatorRegistry` (`contracts/contracts/validatorRegistry.algo.ts`) is a single immutable master app. It holds all validator, node, and pool metadata in global state and boxes (`validatorList` BoxMap prefix `v`, per-staker `stakerPoolSet` prefix `sps`), and it stores the compiled `StakingPool` approval program in a box (`poolTemplateApprovalBytes`) to use as a **factory template** — every new pool is created from that on-chain bytecode.

`StakingPool` (`stakingPool.algo.ts`) is one app instance per pool, with its staker ledger (up to `MAX_STAKERS_PER_POOL` = 200 `StakedInfo` entries) in a single box, plus APR accumulators (`stakeAccumulator`/`rewardAccumulator`/`ewma`) updated at each epoch payout.

Authentication is bidirectional and is the security core: the registry only accepts calls from a pool address it itself created for that validator/pool id, and each pool only accepts calls from its recorded `creatingValidatorContractAppId`. Preserve both checks when touching cross-contract calls.

Shared ABI structs live in `validatorConfigs.algo.ts`; protocol limits in `constants.algo.ts` (`MAX_NODES` 8, `MAX_POOLS_PER_NODE` 3, `MAX_POOLS_PER_STAKER` 6, entry-gating types). Changing `MAX_POOLS` also requires hand-editing the `StaticArray` literal in `ValidatorInfo.pools` and `PoolTokenPayoutRatio` — TEALScript can't compute it. The registry↔pool circular import is deliberate (`eslint-disable import/no-cycle`), as are the `gas()` no-ops used to pool opcode budget and resource references.

### Generated code — never hand-edit

`contracts/pnpm run build` compiles to `contracts/contracts/artifacts/` (TEAL + arc32/arc4/arc56), generates typed clients into `contracts/contracts/clients/`, then `update_contract_artifacts.sh` copies:

- `*arc32*.json` → `nodemgr/internal/lib/reti/artifacts/contracts/` (`go:embed`-ed in `reti.go`)
- `clients/*.ts` → `ui/src/contracts/`

So `ui/src/contracts/*Client.ts` and the nodemgr artifacts are build output. Change the `.algo.ts` source and rebuild; both consumers pick it up. `ui/src/routeTree.gen.ts` is likewise generated (by the TanStack Router vite plugin).

### nodemgr

`main.go` → `app.go:initApp()` builds the urfave/cli command tree; the `Before` hook (`initClients`) resolves the network, layers env files (`.env.local`, `.env`, then `.env.<network>`), builds the algod/NFD clients, and constructs the `reti.Reti` client, then `LoadState`. Networks: `sandbox | fnet | betanet | testnet | mainnet`, each with a hardcoded default `RetiAppID` and algod URL in `internal/lib/algo/networks.go` — that's where a newly deployed master app id gets recorded. Overrides come from `RETI_APPID` / `RETI_VALIDATORID` / `RETI_NODENUM` (or `--usehostname` to derive the node number from a `-N` StatefulSet hostname suffix).

Signing is local-only: `algo.NewLocalKeyStore` picks up every env var whose name contains `_MNEMONIC` (e.g. `ALGO_MNEMONIC_L4J2`) — that's what bootstrap writes into `.env.sandbox`.

`daemon.go` is the long-running service and the reason nodemgr exists. Three goroutines:
- **KeyWatcher** — creates, renews, and switches Algorand participation keys, and takes pools online/offline (including sunsetting pools).
- **EpochUpdater** — waits for epoch-boundary rounds and calls `epochBalanceUpdate` on each pool as the validator manager.
- **StakerEvictor** — only when entry gating is configured; evicts stakers who no longer qualify.

It also serves prometheus metrics. `internal/lib/reti/` is the typed protocol wrapper (`validator.go`, `stakingpool.go`); `internal/lib/nfdapi` is generated swagger — don't edit by hand.

### ui

File-based routes in `src/routes/`. Data flow is: `src/api/queries.ts` exports `queryOptions` objects that both route `beforeLoad`/prefetch and components (`useQuery`/`useSuspenseQuery`) share, so cache keys stay consistent.

`src/api/clients.ts` is the only place clients are constructed. Note the pairing: `getValidatorClient`/`getStakingPoolClient` take a signer for writes, while `getSimulateValidatorClient`/`getSimulateStakingPoolClient` default the sender to `FEE_SINK` for read-only simulate calls that must work with no wallet connected. Reuse those rather than instantiating clients elsewhere.

`src/api/contracts.ts` holds every protocol read/write; `src/utils/contracts.ts` holds the derived math (saturation, max stake, reward eligibility, pool metrics) — check there before writing new calculations. NFD (nf.domains) supplies names and some entry-gating lookups; the Nodely API supplies node performance indicators.

**Bulk reads, not per-validator calls.** The dashboard reads on-chain state in aggregate, and new code should not reintroduce per-validator or per-pool round trips:

- Every validator's config/state/pools/nodePoolAssignments live in one `v`+id box, read for all validators at once by `fetchAllValidatorData` (`fetchAppBoxes` → `decodeValidatorInfo` → `validatorInfoToParts`). The per-validator `queryOptions` are seeded from that result rather than fetched. Box name encode/decode is `boxNameForId`/`idFromBoxName` in `src/utils/bytes.ts`.
- Every pool is created by the registry's app account, so `fetchPoolGlobalStates` gets all their global state (`lastPayout`, `algodVer`) from one `accountInformation` read.
- Both require **algosdk ≥ 3.6** for `getApplicationBoxes(...).include('values')` with cursor pagination. 3.6 also made `asset.params` optional — hence the `?.` on every `params` access.

**Caching and pacing.** `src/lib/queryPersister.ts` persists an allowlist of query key roots to IndexedDB (chosen over localStorage because protocol data is full of bigints, which structured clone handles natively), busted on `__APP_VERSION__`. `src/hooks/useQueuedQueries.ts` meters batches of queries, with `src/utils/rateLimit.ts` learning a per-host batch size (AIMD). `src/lib/axiosNfdApi.ts` layers an HTTP cache plus retry under the NFD queries — note the interceptor registration order there is load bearing and covered by a test.

Config is per-network via `vite --mode <network>` → `.env.<network>`. `ui/.env.template` carries the canonical block for every network (localnet/testnet/fnet/mainnet) and is what bootstrap slices `.env.localnet` out of; `.env.*` is gitignored, so update `.env.template` when an app id changes.

## Conventions

- Branch from `dev`; PRs target `dev`. Commits: `<type>(<scope>): <subject>` — types `feat|fix|docs|style|refactor|perf|test|chore`, scopes typically `contracts|ui|nodemgr|docs`, imperative, lowercase, no trailing period.
- Prettier settings differ per package: `contracts` uses tabWidth 4 / printWidth 120, `ui` uses tabWidth 2 / printWidth 100 (both: no semicolons, single quotes). Always run the package's own `prettier`/`lint` script rather than a repo-wide prettier.
- `contracts`, `contracts/bootstrap`, and `ui` package versions are kept in lockstep; a `chore: release v*` commit skips the lint CI workflows and a published release builds the Go binaries and the `algorandfoundation/reti` Docker image (`Dockerfile-nodemgr`).
- Public docs live on the `docs/gitbook` branch (source of truth for txnlab.gitbook.io/reti-open-pooling), not in `main`.
