import { NodelyRetiPerfData } from '@/interfaces/nodely'

/**
 * Picks a validator's 24h voting performance score out of Nodely's per-pool rows.
 *
 * Nodely returns one row per staking pool; the first row for the validator wins, which is
 * what the Status column has always shown.
 *
 * Both sides are coerced rather than compared strictly. Nodely serializes `validatorid` as
 * a bare JSON number today, and a strict compare against a string id resolves to `undefined`
 * for every validator - which the UI renders as a confident "Not active" rather than as a
 * failure, so nothing surfaces the mismatch.
 *
 * @param rows - `data` from the `poolvotingperformance/24hr` response
 * @param validatorId - the validator to look up
 * @returns the score in the range 0-1, or `undefined` when Nodely has no row for it
 */
export function findValidatorPerf(
  rows: NodelyRetiPerfData[] | undefined,
  validatorId: number | bigint,
): number | undefined {
  return rows?.find((row) => Number(row.validatorid) === Number(validatorId))?.perf
}
