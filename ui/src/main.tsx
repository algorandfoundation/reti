import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import {
  NetworkConfigBuilder,
  SupportedWallet,
  WalletId,
  WalletManager,
  WalletProvider,
  useWallet,
} from '@txnlab/use-wallet-react'
import { SnackbarProvider } from 'notistack'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import ErrorBoundary from '@/components/ErrorBoundary'
import { Toaster } from '@/components/ui/sonner'
import { WalletShortcutHandler } from '@/components/WalletShortcutHandler'
import { WALLETCONNECT_PROJECT_ID } from '@/constants/env'
import { ThemeProvider } from '@/providers/ThemeProvider'
import { routeTree } from '@/routeTree.gen'
import '@/styles/main.css'
import {
  getAlgodConfigFromViteEnvironment,
  getAlgodNetwork,
  getKmdConfigFromViteEnvironment,
} from '@/utils/network/getAlgoClientConfigs'

// use-wallet configuration
let wallets: SupportedWallet[]
const siteName = 'Réti Pooling'
if (import.meta.env.VITE_ALGOD_NETWORK === 'localnet') {
  const kmdConfig = getKmdConfigFromViteEnvironment()
  wallets = [
    {
      id: WalletId.KMD,
      options: {
        wallet: kmdConfig.wallet,
        baseServer: kmdConfig.server,
        token: String(kmdConfig.token),
        port: String(kmdConfig.port),
      },
    },
    { id: WalletId.LUTE, options: { siteName } },
  ]
} else {
  wallets = [
    WalletId.DEFLY,
    WalletId.PERA,
    { id: WalletId.LUTE, options: { siteName } },
    {
      id: WalletId.WALLETCONNECT,
      options: {
        projectId: WALLETCONNECT_PROJECT_ID,
        explorerRecommendedWalletIds: [
          '5864e2ced7c293ed18ac35e0db085c09ed567d67346ccb6f58a0327a75137489',
        ],
      },
    },
    WalletId.KIBISIS,
    WalletId.EXODUS,
    WalletId.W3_WALLET,
  ]
}

const algodConfig = getAlgodConfigFromViteEnvironment()
const defaultNetwork = getAlgodNetwork()

const defaultConfig = new NetworkConfigBuilder().build()

const walletManager = new WalletManager({
  wallets,
  defaultNetwork,
  networks: {
    [defaultNetwork]: {
      ...defaultConfig[defaultNetwork],
      algod: {
        ...defaultConfig[defaultNetwork].algod,
        baseServer: algodConfig.server,
        port: algodConfig.port,
        token: algodConfig.token as string,
      },
    },
  },
  options: {
    resetNetwork: true,
  },
})

// Tanstack Query client instance
const queryClient = new QueryClient()

// Tanstack Router instance
const router = createRouter({
  routeTree,
  context: {
    queryClient,
    walletManager: undefined!,
  },
  defaultPreloadStaleTime: 0,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

function InnerApp() {
  const { activeAddress } = useWallet()
  return (
    <RouterProvider router={router} context={{ queryClient, walletManager: { activeAddress } }} />
  )
}

function AppProviders() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <SnackbarProvider maxSnack={3}>
            <WalletProvider manager={walletManager}>
              <InnerApp />
              <WalletShortcutHandler />
            </WalletProvider>
          </SnackbarProvider>
        </QueryClientProvider>
      </HelmetProvider>
      <Toaster />
    </ThemeProvider>
  )
}

function App() {
  return (
    <React.StrictMode>
      <ErrorBoundary>
        <AppProviders />
      </ErrorBoundary>
    </React.StrictMode>
  )
}

const rootElement = document.getElementById('app')!
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(<App />)
}
