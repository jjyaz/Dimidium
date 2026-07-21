# Dimidium

**Meet the half of you that waits.**

Dimidium is an onchain "future-self" companion. Blockchains record what people
did — Dimidium records the missing half: what someone nearly did, waited to
do, or deliberately chose not to do.

Users place a financial intention inside an Egg, choose an incubation period,
and watch two possible timelines:

1. **HATCH** — what might happen if they act.
2. **SHELL** — what might happen if they wait.

When incubation ends, the user can hatch the decision, return it to the
shell, or let it incubate longer. Dimidium measures patience, conviction, and
adherence to the user's own rules — not simply profit.

> Incubate an onchain decision. Watch both possible futures. Then hatch it —
> or don't.

## Status

Early **Robinhood Chain testnet** concept. Prototype mode uses simulated data
and does not execute trades. Not financial advice. No token. No pressure.

## Running locally

```bash
npm install
npm run dev
```

Then open the printed local URL. Build for production with `npm run build`.

## Pages

- `/` — Hero, story, and the interactive Egg Composer
- `/nursery` — The Nursery: your eggs on curved shelves, with filters
- `/egg/:id` — Incubation detail: countdown, twin HATCH/SHELL timelines, actions
- `/dna` — Decision DNA: five-lobed behavioral portrait and Shell Fragments
- `/how-it-works` — Future architecture and chain details

## Wallet & chain

The app uses Wagmi + Viem and is configured for **Robinhood Chain Testnet**
(chain id `46630`, RPC `https://rpc.testnet.chain.robinhood.com`). Everything
works without a wallet in Demo Mode. All chain configuration lives in
`src/chain/config.ts`; set `VITE_DIMIDIUM_CONTRACT` to wire in a commitment
contract later. While no contract address is configured, the app never
attempts a transaction.

## Tech

- React 19 + TypeScript + Vite
- React Router for real routes
- Wagmi + Viem for wallet/network behavior
- Plain hand-rolled CSS — soft 3D clay design system, film grain, organic
  egg shapes, `prefers-reduced-motion` respected throughout
- Demo decisions persist in `localStorage` (seeded with four examples on
  first visit)

No eggs were traded during this simulation.
