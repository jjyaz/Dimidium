/**
 * Blockchain configuration for Dimidium.
 *
 * Everything chain-related lives in this file so that a real commitment
 * contract can be wired in later without touching UI code.
 */
import { http, createConfig } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { defineChain } from 'viem'

export const robinhoodChainTestnet = defineChain({
  id: 46630,
  name: 'Robinhood Chain Testnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.chain.robinhood.com'] },
  },
  blockExplorers: {
    default: {
      name: 'Robinhood Chain Explorer',
      url: 'https://explorer.testnet.chain.robinhood.com',
    },
  },
  testnet: true,
})

/**
 * Address of the DimidiumNursery commitment contract (see contracts/).
 * Leave empty for Demo Mode — the app will never attempt a transaction
 * while this is unset. Set VITE_DIMIDIUM_CONTRACT after deploying with
 * contracts/script/Deploy.s.sol.
 */
export const DIMIDIUM_CONTRACT_ADDRESS: `0x${string}` | '' =
  (import.meta.env.VITE_DIMIDIUM_CONTRACT as `0x${string}` | undefined) ?? ''

export { dimidiumNurseryAbi } from './nurseryAbi'

export const isDemoMode = DIMIDIUM_CONTRACT_ADDRESS === ''

export const wagmiConfig = createConfig({
  chains: [robinhoodChainTestnet],
  connectors: [injected()],
  transports: {
    [robinhoodChainTestnet.id]: http(),
  },
})
