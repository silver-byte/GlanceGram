import { CreateStartUpPageContainer, RebuildPageContainer, waitForEvenAppBridge } from '@evenrealities/even_hub_sdk'
import { containers, route, type Page, type Summary } from './pages'

const api = 'http://127.0.0.1:8787/api'

const bridge = await waitForEvenAppBridge()
let inbox: Extract<Page, { kind: 'inbox' }> = { kind: 'inbox', rows: [], connection: 'connecting' }
let page: Page = inbox
let busy = false
let polling = false
let stopped = false

const result = await bridge.createStartUpPageContainer(new CreateStartUpPageContainer(containers(page)))
if (result !== 0) throw new Error(`GlanceGram startup failed (${result})`)

async function show(next: Page) {
  if (!await bridge.rebuildPageContainer(new RebuildPageContainer(containers(next)))) {
    throw new Error('GlanceGram could not rebuild the page')
  }
  page = next
}

async function refresh() {
  if (polling || stopped) return
  polling = true
  try {
    try {
      const response = await fetch(`${api}/summaries`, { signal: AbortSignal.timeout(5000) })
      if (!response.ok) throw new Error('Inbox unavailable')
      const data: { summaries: Summary[] } = await response.json()
      const rows = data.summaries.slice(0, 20).map(({ id, sender, time, summary, replyDraft, status }) =>
        ({ id, sender, time, summary, replyDraft, status }))
      inbox = { kind: 'inbox', rows, connection: 'online' }
    } catch {
      inbox = { ...inbox, connection: 'offline' }
    }
    if (!stopped && !busy && page.kind === 'inbox' && JSON.stringify(inbox) !== JSON.stringify(page)) {
      busy = true
      try { await show(inbox) } finally { busy = false }
    }
  } catch {
    console.error('GlanceGram inbox refresh failed')
  } finally {
    polling = false
  }
}

async function decide(decision: 'approve' | 'dismiss', item: Summary) {
  let next = item
  let notice: string
  try {
    const response = await fetch(`${api}/${decision}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: item.id }),
      signal: AbortSignal.timeout(20000),
    })
    const data: { summary?: Summary; telegramResult?: { httpStatus: number | null; ok: boolean } } = await response.json()
    next = data.summary ?? item
    if (response.ok && next.status === 'sent') notice = 'Reply sent  /  Double-tap to inbox'
    else if (response.ok && next.status === 'dismissed') notice = 'Dismissed  /  Double-tap to inbox'
    else if (data.telegramResult) notice = data.telegramResult.httpStatus
      ? `Send unconfirmed (HTTP ${data.telegramResult.httpStatus})  /  Double-tap to inbox`
      : 'Send unconfirmed  /  Double-tap to inbox'
    else notice = 'Action unavailable  /  Double-tap to inbox'
  } catch {
    notice = 'Action unconfirmed  /  Double-tap to inbox'
  }
  if (!stopped) await show({ kind: 'detail', item: next, notice })
}

const unsubscribe = bridge.onEvenHubEvent(event => {
  const action = route(page, event)
  if (!action) return
  if (action.kind === 'stop') {
    stopped = true
    clearInterval(refreshTimer)
    unsubscribe()
    return
  }
  if (busy) return
  busy = true
  void (async () => {
    if (action.kind === 'exit') await bridge.shutDownPageContainer(1)
    if (action.kind === 'back') {
      if (page.kind === 'approve') await show({ kind: 'detail', item: page.item })
      else await show(inbox)
    }
    if (action.kind === 'open') await show({ kind: 'detail', item: action.item })
    if (action.kind === 'review' && page.kind === 'detail') await show({ kind: 'approve', item: page.item })
    if (page.kind === 'approve' && (action.kind === 'send' || action.kind === 'dismiss')) {
      await decide(action.kind === 'send' ? 'approve' : 'dismiss', page.item)
    }
  })().catch(() => console.error('GlanceGram navigation failed')).finally(() => { busy = false })
})

const refreshTimer = setInterval(() => void refresh(), 3000)
void refresh()
