import { Link } from '@tanstack/react-router'
import { useWallet } from '@txnlab/use-wallet-react'
import { ArrowUpRight } from 'lucide-react'

export function Navigation() {
  const { activeAddress } = useWallet()
  const isTestnet = import.meta.env.VITE_ALGOD_NETWORK === 'testnet'

  return (
    <nav className="hidden flex-col gap-6 text-lg font-medium md:flex md:flex-row md:items-center md:gap-5 md:text-sm lg:gap-6">
      <Link
        to="/"
        className="text-muted-foreground transition-colors hover:text-foreground [&.active]:text-foreground"
      >
        Dashboard
      </Link>

      <Link
        to="/validators"
        className="text-muted-foreground transition-colors hover:text-foreground [&.active]:text-foreground"
      >
        Validators
      </Link>

      {activeAddress && (
        <Link
          to="/add"
          className="text-muted-foreground transition-colors hover:text-foreground [&.active]:text-foreground"
        >
          Add Validator
        </Link>
      )}

      <Link
        to="/institutional-support"
        className="text-muted-foreground transition-colors hover:text-foreground [&.active]:text-foreground"
      >
        Institutional Support
      </Link>

      <a
        href="https://txnlab.gitbook.io/reti-open-pooling"
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-0.5 text-muted-foreground transition-colors hover:text-foreground"
      >
        Docs
        <ArrowUpRight className="h-5 w-5 opacity-75" />
      </a>

      {isTestnet && (
        <a
          href="https://bank.testnet.algorand.network/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-0.5 text-muted-foreground transition-colors hover:text-foreground"
        >
          Dispenser
          <ArrowUpRight className="h-5 w-5 opacity-75" />
        </a>
      )}
    </nav>
  )
}
