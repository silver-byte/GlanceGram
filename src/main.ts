import { CreateStartUpPageContainer, RebuildPageContainer, waitForEvenAppBridge } from '@evenrealities/even_hub_sdk'
import { containers, route, type Page } from './pages'

const bridge = await waitForEvenAppBridge()
let inbox: Extract<Page, { kind: 'inbox' }> = { kind: 'inbox', rows: [], connection: 'connecting' }
let page: Page = inbox
let busy = false

const result = await bridge.createStartUpPageContainer(new CreateStartUpPageContainer(containers(page)))
if (result !== 0) throw new Error(`GlanceGram startup failed (${result})`)

async function show(next: Page) {
  if (!await bridge.rebuildPageContainer(new RebuildPageContainer(containers(next)))) {
    throw new Error('GlanceGram could not rebuild the page')
  }
  page = next
}

const unsubscribe = bridge.onEvenHubEvent(event => {
  const action = route(page, event)
  if (!action) return
  if (action.kind === 'stop') {
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
  })().catch(() => console.error('GlanceGram navigation failed')).finally(() => { busy = false })
})
