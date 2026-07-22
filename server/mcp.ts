/**
 * "Hire Dimidium's twin" — Dimidium as an MCP server.
 *
 * Exposes the askDimidium tool over the Streamable HTTP transport at
 * POST /api/public/mcp, stateless mode: any Claude/Cursor user can point
 * their MCP config at this URL and consult the egg before aping.
 *
 * Run: npm run mcp   (defaults to port 8787; override with PORT)
 */
import express from 'express'
import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { askDimidium, parseTimer } from '../src/lib/oracle'
import { ASSETS, INTENTIONS } from '../src/lib/types'
import type { Asset, Intention } from '../src/lib/types'

const PORT = Number(process.env.PORT ?? 8787)
const MCP_PATH = '/api/public/mcp'

function buildServer(): McpServer {
  const server = new McpServer({
    name: 'dimidium',
    version: '1.0.0',
  })

  server.registerTool(
    'askDimidium',
    {
      title: "Ask Dimidium's twin",
      description:
        'Consult Dimidium, the onchain future-self egg, before acting on a ' +
        'financial impulse. Returns a Washi-flavored second opinion plus a ' +
        'simulated HATCH (act now) vs SHELL (wait) projection over the ' +
        'incubation window. All numbers are simulated testnet data — this ' +
        'is a patience companion, not financial advice.',
      inputSchema: {
        asset: z
          .enum(ASSETS as [Asset, ...Asset[]])
          .describe('What the impulse is about: ETH, AAPL, TSLA, or SPY'),
        intention: z
          .enum(INTENTIONS as [Intention, ...Intention[]])
          .describe('What you are itching to do: Buy, Sell, Swap, or Transfer'),
        amount: z
          .number()
          .positive()
          .describe('How much: ETH for ETH, shares otherwise'),
        timer: z
          .string()
          .default('24h')
          .describe(
            "Incubation window to project across, e.g. '15m', '24h', '7d' " +
              '(1 minute to 365 days)',
          ),
      },
    },
    async ({ asset, intention, amount, timer }) => {
      if (parseTimer(timer) === null) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Dimidium squints at "${timer}". Try something like "15m", "24h" or "7d" (between 1 minute and 365 days).`,
            },
          ],
        }
      }

      const answer = askDimidium({ asset, intention, amount, timer })
      const p = answer.projection

      const text = [
        `🥚 ${answer.whisper} (whispered ${answer.washiWhispers}×)`,
        '',
        answer.opinion,
        '',
        `Verdict: ${answer.verdict}`,
        `Projection over one simulated ${p.windowLabel} window:`,
        `  entry ${p.entryPrice.toFixed(2)} → projected ${p.projectedPrice.toFixed(2)} (${p.movePct >= 0 ? '+' : ''}${p.movePct.toFixed(2)}%)`,
        `  HATCH (act now): $${p.hatchValue.toFixed(2)}`,
        `  SHELL (wait):    $${p.shellValue.toFixed(2)}`,
        `  difference:      ${p.differenceUsd >= 0 ? '+' : '−'}$${Math.abs(p.differenceUsd).toFixed(2)} — ${
          p.aheadHalf === 'tie' ? 'a genuine tie' : `${p.aheadHalf.toUpperCase()} is ahead`
        }`,
        '',
        answer.disclaimer,
      ].join('\n')

      return {
        content: [{ type: 'text', text }],
        structuredContent: answer as unknown as Record<string, unknown>,
      }
    },
  )

  return server
}

const app = express()
app.use(express.json({ limit: '256kb' }))

// Public endpoint: permissive CORS so browser-based MCP clients can call it.
app.use(MCP_PATH, (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Accept, Authorization, Mcp-Session-Id, Mcp-Protocol-Version',
  )
  res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id')
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  next()
})

// Stateless Streamable HTTP: a fresh server+transport per request, so the
// endpoint scales horizontally and never holds session state.
app.post(MCP_PATH, async (req, res) => {
  const server = buildServer()
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  })
  res.on('close', () => {
    void transport.close()
    void server.close()
  })
  try {
    await server.connect(transport)
    await transport.handleRequest(req, res, req.body)
  } catch (err) {
    console.error('MCP request failed:', err)
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'The egg dropped the request. Try again.' },
        id: null,
      })
    }
  }
})

// Stateless mode has no SSE stream or session to resume/delete.
for (const method of ['get', 'delete'] as const) {
  app[method](MCP_PATH, (_req, res) => {
    res.status(405).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message:
          'Method not allowed. Dimidium is stateless; POST JSON-RPC here. Humans: see /agents.',
      },
      id: null,
    })
  })
}

app.get('/healthz', (_req, res) => {
  res.json({ ok: true, egg: 'concentrating' })
})

/** Proxy Solend USDC supply APY for Shell yield / Atelier Earn cards.
 *  Responses are TTL-cached in memory so incubation traffic does not hammer Solend. */
const SOLEND_USDC_RESERVE = 'BgxfHJDzm44T7XG68MYKx7YisTjZu73tVovyZSjJMpmw'
const APY_TTL_MS = 15 * 60 * 1000
let apyCache:
  | {
      body: {
        reserve: string
        supplyApyPct: number
        borrowApyPct: number
        source: string
        product: string
        fetchedAt: number
        cache: 'miss' | 'hit'
      }
      expiresAt: number
    }
  | null = null
let apyInflight: Promise<typeof apyCache> | null = null

async function loadSolendApy() {
  const upstream = await fetch(
    `https://api.solend.fi/v1/reserves?ids=${SOLEND_USDC_RESERVE}`,
    { headers: { Accept: 'application/json' } },
  )
  if (!upstream.ok) {
    throw Object.assign(new Error('Solend was quiet.'), { status: upstream.status })
  }
  const data = (await upstream.json()) as {
    results?: Array<{ rates?: { supplyInterest?: string; borrowInterest?: string } }>
  }
  const supplyInterest = Number(data.results?.[0]?.rates?.supplyInterest)
  if (!Number.isFinite(supplyInterest)) {
    throw new Error('Solend APY missing.')
  }
  const fetchedAt = Date.now()
  apyCache = {
    body: {
      reserve: SOLEND_USDC_RESERVE,
      supplyApyPct: supplyInterest,
      borrowApyPct: Number(data.results?.[0]?.rates?.borrowInterest ?? NaN),
      source: 'solend',
      product: 'Atelier Earn',
      fetchedAt,
      cache: 'miss',
    },
    expiresAt: fetchedAt + APY_TTL_MS,
  }
  return apyCache
}

app.get('/api/earn/solend', async (_req, res) => {
  try {
    if (apyCache && Date.now() < apyCache.expiresAt) {
      res.json({ ...apyCache.body, cache: 'hit' })
      return
    }
    if (!apyInflight) {
      apyInflight = loadSolendApy().finally(() => {
        apyInflight = null
      })
    }
    const fresh = await apyInflight
    res.json(fresh!.body)
  } catch (err) {
    console.error('Solend proxy failed:', err)
    if (apyCache) {
      res.json({ ...apyCache.body, cache: 'stale', source: 'cache' })
      return
    }
    const status = (err as { status?: number }).status
    res.status(502).json({
      error: 'Solend was quiet.',
      status: status ?? 502,
    })
  }
})

app.listen(PORT, () => {
  console.log(`Dimidium MCP server listening on http://localhost:${PORT}${MCP_PATH}`)
  console.log('Tool: askDimidium(asset, intention, amount, timer)')
  console.log(`Earn proxy: http://localhost:${PORT}/api/earn/solend`)
})
