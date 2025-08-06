import type { TransactionState } from "@/api/transaction_state";
import type { TransactionSigner } from "algosdk";
import { useMemo, useState } from "react";

export function isLoadingState(state: TransactionState) {
  return (
    state === "loading" ||
    state === "signing" ||
    state === "sending" || 
    state === "confirmed" // confirmed is also considered a loading state to ensure we have time to give the user feedback on the result
  )
}

export function useTransactionState() {
  const [status, setStatus] = useState<TransactionState>("idle");

  const reset = () => setStatus("idle")
  const errorMessage = status instanceof Error ? status?.message : undefined;
  const setErrorMessage = (err: string) => setStatus(new Error(err));
  const isPending = useMemo(() => isLoadingState(status), [status]);

  return {
    status,
    setStatus,
    errorMessage,
    setErrorMessage,
    reset,
    isPending,
  };
}

export function wrapTransactionSigner(
  transactionSigner: TransactionSigner,
  setStatus: (s: TransactionState) => void,
): TransactionSigner {
  return async function (txns, idxs) {
    setStatus("signing");
    const signed = await transactionSigner(txns, idxs);
    setStatus("sending");
    return signed
  };
}