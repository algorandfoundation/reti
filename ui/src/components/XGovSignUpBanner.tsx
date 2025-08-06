import { Validator } from "@/interfaces/validator"
import { Button } from "./ui/button"
import { useTransactionState, wrapTransactionSigner } from "@/hooks/useTransactionState"
import { TransactionSigner } from "algosdk"

export type XGovSignUpBannerProps = {
  validator: Validator
  activeAddress: string | null
  innerSigner: TransactionSigner
}

export function XGovSignUpBanner({ validator, activeAddress, innerSigner }: XGovSignUpBannerProps) {
  
  const {
    status,
    setStatus,
    errorMessage,
    setErrorMessage,
    isPending
  } = useTransactionState()

  // activeAddress,
  // innerSigner,
  // setStatus,
  // refetch,
  // xgovFee,
  // : SubscribeXGovProps
 const requestSubscribeXgov = async () => {
  if (!innerSigner) return;

  const transactionSigner = wrapTransactionSigner(
    innerSigner,
    setStatus,
  );

  setStatus("loading");

  if (!activeAddress || !transactionSigner) {
    setStatus(new Error("No active address or transaction signer"));
    return;
  }

  if (!xgovFee) {
    setStatus(new Error("xgovFee is not set"));
    return;
  }

  const suggestedParams = await algorand.getSuggestedParams();

  const payment = makePaymentTxnWithSuggestedParamsFromObject({
    from: activeAddress,
    to: algosdk.getApplicationAddress(RegistryAppID),
    amount: xgovFee,
    suggestedParams,
  });

  let builder: XGovRegistryComposer<any> = registryClient.newGroup();

  if (network === "testnet") {
    builder = builder.addTransaction(
      await registryClient.algorand.createTransaction.payment({
        sender: fundingLogicSig.address(),
        receiver: activeAddress,
        amount: (100).algos(),
      }),
      fundingLogicSigSigner,
    );
  }

  builder = builder.subscribeXgov({
    sender: activeAddress,
    signer: transactionSigner,
    args: {
      payment,
      votingAddress: activeAddress,
    },
    boxReferences: [
      xGovBoxName(activeAddress),
    ],
  });

  try {
    await builder.send();
    setStatus("confirmed");
    await sleep(800);
    setStatus("idle");
    await Promise.all(refetch.map(r => r()));
  } catch (e: any) {
    console.error("Error during subscribeXgov:", e.message);
    setStatus(new Error(`Failed to subscribe to be a xGov`));
    return;
  }
};
  
  if (validator.config.owner !== activeAddress || activeAddress === null) {
      return <></>
  }

  return (
    <div className="mt-6 rounded-xl mx-auto max-w-3xl w-full bg-algo-blue dark:bg-algo-teal">
      <div className="flex gap-4 justify-between items-center p-4">
        <div>
          <h2 className="text-lg font-semibold text-white dark:text-algo-black">xGov Pool Manager Sign Up</h2>
          <p className="text-sm text-gray-200 dark:text-gray-600">
            Participate in xGov on behalf of your pool!
          </p>
        </div>
        <Button
          className="bg-white dark:bg-algo-black hover:bg-algo-blue dark:hover:bg-algo-teal hover:text-white dark:hover:text-algo-black text-algo-black dark:text-white border border-algo-blue dark:border-algo-teal hover:border-white dark:hover:border-algo-black"
          onClick={xGovRequestSignUp}
        >
          Request Enrollment
        </Button>
      </div>
    </div>
  )
}
