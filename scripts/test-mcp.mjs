/* Smoke test for the Dimidium MCP endpoint using the official client SDK. */
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

const URL_ = process.env.MCP_URL ?? 'http://localhost:8787/api/public/mcp'

const results = []
const check = (name, ok, extra = '') => {
  results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ` — ${extra}` : ''}`)
}

const client = new Client({ name: 'dimidium-smoke', version: '1.0.0' })
await client.connect(new StreamableHTTPClientTransport(new URL(URL_)))

const tools = await client.listTools()
check(
  'askDimidium tool listed',
  tools.tools.some((t) => t.name === 'askDimidium'),
  tools.tools.map((t) => t.name).join(', '),
)

const res = await client.callTool({
  name: 'askDimidium',
  arguments: { asset: 'ETH', intention: 'Buy', amount: 0.5, timer: '24h' },
})
const text = res.content?.[0]?.text ?? ''
check('answer has washi whisper', text.includes('Washi washi'), text.split('\n')[0])
check('answer has projection', /HATCH \(act now\)/.test(text))
check('answer has disclaimer', /Not financial advice/.test(text))
const s = res.structuredContent
check(
  'structured projection sane',
  s && s.projection && s.projection.hatchValue > 0 && s.projection.shellValue > 0,
  s ? `verdict=${s.verdict}, diff=$${Math.abs(s.projection.differenceUsd).toFixed(2)}` : 'missing',
)

const bad = await client.callTool({
  name: 'askDimidium',
  arguments: { asset: 'ETH', intention: 'Buy', amount: 1, timer: 'eleventy' },
})
check('bad timer rejected politely', bad.isError === true, bad.content?.[0]?.text?.slice(0, 60))

await client.close()

console.log(results.join('\n'))
console.log('\nSample answer:\n' + text)
if (results.some((r) => r.startsWith('FAIL'))) process.exit(1)
