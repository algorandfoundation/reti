export function getXGovUrlFromViteEnvironment(): string {
  if (!import.meta.env.VITE_XGOV_URL) {
    throw new Error(
      'Attempt to get xGov URL without specifying VITE_XGOV_URL in the environment variables',
    )
  }

  return import.meta.env.VITE_XGOV_URL
}

export function getXGovCloseWindowTS(): number {
  if (!import.meta.env.VITE_XGOV_VOTE_CLOSE_WINDOW_TS) {
    throw new Error(
      'Attempt to get xGov vote close window without specifying VITE_XGOV_VOTE_CLOSE_WINDOW_TS in the environment variables',
    )
  }

  return import.meta.env.VITE_XGOV_VOTE_CLOSE_WINDOW_TS
}

export function getXGovCommitteeRoundWindow(): bigint {
  if (!import.meta.env.VITE_XGOV_COMMITTEE_ROUND_WINDOW) {
    throw new Error(
      'Attempt to get xGov committee round window without specifying VITE_XGOV_COMMITTEE_ROUND_WINDOW in the environment variables',
    )
  }

  return BigInt(import.meta.env.VITE_XGOV_COMMITTEE_ROUND_WINDOW)
}

export function getXGovCommitteeRoundMultiple(): bigint {
  if (!import.meta.env.VITE_XGOV_COMMITTEE_ROUND_MULTIPLE) {
    throw new Error(
      'Attempt to get xGov committee round multiple without specifying VITE_XGOV_COMMITTEE_ROUND_MULTIPLE in the environment variables',
    )
  }

  return BigInt(import.meta.env.VITE_XGOV_COMMITTEE_ROUND_MULTIPLE)
}
