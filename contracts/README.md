# Dimidium contracts

Foundry project for `DimidiumNursery` — the onchain half of Dimidium.

## What the contract does

`DimidiumNursery` is a commitment device, not a trading contract:

- **`commit(commitment, incubationSeconds, isPublic)`** — seal an intention
  into an Egg. Only `keccak256(abi.encode(asset, intention, amount, note,
  salt))` goes onchain, so the intention stays private until (and unless) the
  owner reveals it. An optional ETH stake (`msg.value`) is escrowed as a
  patience bond.
- **`extend(id, extraSeconds)`** — give your future self more time. Counted,
  because Decision DNA cares.
- **`hatch(id)`** — act on the decision. Allowed early, but early hatches are
  flagged in the event: Dimidium measures behavior, it does not police it.
- **`shell(id)`** — deliberately choose not to act.
- **`reveal(id, asset, intention, amount, note, salt)`** — prove what the
  sealed intention was. Only possible after resolution, so a reveal can never
  front-run the decision itself.

Escrow is returned **in full on either resolution** — hatching and shelling
pay back the same bond. Nothing here is a wager, and the contract never
executes a trade.

## Build & test

```bash
forge build
forge test
```

## Deploy to Robinhood Chain Testnet

The deployer key needs a little testnet ETH from
[faucet.testnet.chain.robinhood.com](https://faucet.testnet.chain.robinhood.com)
(deployment costs ~0.00003 ETH).

```bash
export DEPLOYER_PRIVATE_KEY=0x...
forge script script/Deploy.s.sol:Deploy --rpc-url robinhood_testnet --broadcast
```

Then point the frontend at the printed address:

```bash
VITE_DIMIDIUM_CONTRACT=<address> npm run build
```

Optional Blockscout verification:

```bash
forge verify-contract <address> src/DimidiumNursery.sol:DimidiumNursery \
  --verifier blockscout \
  --verifier-url https://explorer.testnet.chain.robinhood.com/api
```
