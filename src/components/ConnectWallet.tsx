import { useState } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { isDemoMode, robinhoodChainTestnet } from '../chain/config'

function shortAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export function ConnectWallet() {
  const { address, isConnected, chainId } = useAccount()
  const { connectors, connectAsync, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  const [error, setError] = useState<string | null>(null)

  const onRightChain = chainId === robinhoodChainTestnet.id

  const handleConnect = async () => {
    setError(null)
    const connector = connectors[0]
    if (!connector) {
      setError('No wallet found — staying in Demo Mode.')
      return
    }
    try {
      await connectAsync({ connector, chainId: robinhoodChainTestnet.id })
    } catch {
      setError('Wallet said no. Demo Mode continues.')
    }
  }

  return (
    <div className="wallet-area">
      <span
        className={`chain-dot ${isConnected && onRightChain ? 'chain-dot-live' : ''}`}
        title={
          isConnected && onRightChain
            ? 'Connected to Robinhood Chain Testnet'
            : isDemoMode
              ? 'Demo Mode — no contract connected'
              : 'Not connected to Robinhood Chain Testnet'
        }
      >
        <span className="visually-hidden">
          {isConnected && onRightChain
            ? 'Connected to Robinhood Chain Testnet'
            : 'Demo Mode'}
        </span>
      </span>
      {isConnected && address ? (
        <button
          type="button"
          className="btn btn-shell btn-sm"
          onClick={() => disconnect()}
          title="Disconnect wallet"
        >
          {shortAddress(address)}
        </button>
      ) : (
        <button
          type="button"
          className="btn btn-shell btn-sm"
          onClick={handleConnect}
          disabled={isPending}
        >
          {isPending ? 'Knocking…' : 'Connect Wallet'}
        </button>
      )}
      {error && (
        <span className="wallet-error" role="status">
          {error}
        </span>
      )}
    </div>
  )
}
