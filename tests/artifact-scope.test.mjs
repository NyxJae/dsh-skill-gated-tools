/** Exercise the built plugin against the host test runtime. */
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import ToolRuntime, { defineTool } from '@deepseek-ai/dsh-tools'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import { createScope, scopeOf } from '@deepseek-ai/dsh-scope'
import * as gate from '../lib/index.js'

test('built gate discovers and masks tools in a host-created Agent scope', async t => {
  const tempRoot = new URL('../../../.temp/', import.meta.url)
  await mkdir(tempRoot, { recursive: true })
  const dir = await mkdtemp(new URL('skill-gate-artifact-', tempRoot))
  const bindingPath = join(dir, 'bindings.json')
  await writeFile(bindingPath, JSON.stringify({
    version: 1,
    bindings: [{ skill: 'research', tools: ['scoped_gated'] }],
    blockedTools: ['scoped_blocked'],
  }))
  const ctx = new Context()
  let handler
  const server = createServer((req, res) => {
    if (handler === undefined) { res.writeHead(404).end(); return }
    Promise.resolve(handler(req, res)).catch(error => { res.writeHead(500).end(String(error)) })
  })
  t.onTestFinished(async () => {
    await ctx.fiber.dispose()
    server.closeAllConnections()
    if (server.listening) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    await rm(dir, { recursive: true, force: true })
  })
  await ctx.plugin(SystemPrompt, { personaPrefix: '', personaSuffix: '' })
  await ctx.plugin(ToolRuntime)
  ctx.provide('webServer', { register: route => { handler = route.handler; return () => { handler = undefined } } })
  ctx.provide('connection', { requestRejection: () => undefined })
  const scopeHost = ctx.plugin({ name: 'artifact-scope-host', inject: ['tools'], apply() {} })
  await scopeHost
  const preset = createScope(scopeHost.ctx, {})
  ctx.provide('agentPresets', { acquireScope: async () => ({ key: scopeOf(preset.ctx), [Symbol.asyncDispose]: async () => {} }) })
  const agent = { id: 'artifact-scope-agent', session: { snapshotEvents: () => [] } }
  const scope = createScope(scopeHost.ctx, agent, { parent: scopeOf(preset.ctx) })
  agent.ctx = scope.ctx
  const register = (owner, name) => owner.tools.register(defineTool({
    name, description: 'Artifact scope fixture', parameters: {},
    output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
    execute: async () => name,
  }))
  // Restrictions apply to inherited registrations; Agent-local registrations are exempt.
  const presetTools = ['subagent_fork', 'scoped_gated', 'scoped_blocked']
  const agentTools = ['subagent', 'list_subagent_models']
  for (const name of presetTools) register(preset.ctx, name)
  for (const name of agentTools) register(scope.ctx, name)
  const allTools = [...presetTools, ...agentTools].sort()
  const plugin = ctx.plugin({ name: 'built-gate', inject: ['tools'], apply: owner => gate.apply(owner, { bindingPath }) })
  await plugin
  await ctx.parallel('agent/created', { agent })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const response = await fetch('http://127.0.0.1:' + server.address().port + '/skill-gate')
  assert.equal(response.status, 200)
  const snapshot = await response.json()
  console.log('Built artifact settings tools:', snapshot.tools.join(', '))
  assert.deepEqual(snapshot.tools, allTools)
  assert.deepEqual(snapshot.startupTools, [...presetTools].sort())
  const visible = () => ctx.tools.schemas(scopeOf(agent.ctx)).map(tool => tool.name).sort()
  assert.deepEqual(visible(), ['list_subagent_models', 'subagent', 'subagent_fork'])
  assert.equal(ctx.tools.executable('scoped_gated', scopeOf(agent.ctx)), undefined)
  assert.equal(ctx.tools.executable('scoped_blocked', scopeOf(agent.ctx)), undefined)
  await ctx.waterfall('tools/post-execute', { name: 'skill', arguments: { name: 'research' }, agent }, { isError: false },
    async () => ({ kind: 'accept' }))
  assert.deepEqual(visible(), ['list_subagent_models', 'scoped_gated', 'subagent', 'subagent_fork'])
  assert.equal(ctx.tools.executable('scoped_blocked', scopeOf(agent.ctx)), undefined)
  await plugin.dispose()
  assert.deepEqual(visible(), allTools)
  assert.equal(handler, undefined)
})
