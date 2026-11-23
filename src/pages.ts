import {
  ListContainerProperty,
  ListItemContainerProperty,
  OsEventTypeList as Gesture,
  TextContainerProperty,
  type EvenHubEvent,
  type List_ItemEvent,
} from '@evenrealities/even_hub_sdk'

export interface Summary {
  id: string
  sender: string
  time: string
  summary: string
  replyDraft: string
  status: 'pending' | 'approved' | 'dismissed' | 'sent'
}

export type Page =
  | { kind: 'inbox'; rows: Summary[]; connection: 'connecting' | 'online' | 'offline' }
  | { kind: 'detail'; item: Summary; notice?: string }
  | { kind: 'approve'; item: Summary }

const ID = { inbox: 11, detail: 12, decision: 13 }
const ACTIONS = ['Approve & send', 'Dismiss without sending']

function label(value: string, max = 56) {
  const text = value.replace(/\s+/g, ' ').trim()
  return text.length <= max ? text : `${text.slice(0, max - 3)}...`
}

function inboxLabels(rows: Summary[]) {
  return rows.map((item, i) => label(`${i + 1}. ${label(item.sender, 15)}: ${item.summary}`))
}

function text(id: number, name: string, y: number, height: number, content: string, capture = false, frame = false) {
  return new TextContainerProperty({
    xPosition: 16, yPosition: y, width: 544, height,
    containerID: id, containerName: name, content, isEventCapture: capture ? 1 : 0,
    borderWidth: frame ? 1 : 0, borderColor: 7, paddingLength: frame ? 10 : 4,
  })
}

function list(id: number, name: string, y: number, height: number, items: string[]) {
  return new ListContainerProperty({
    xPosition: 16, yPosition: y, width: 544, height,
    containerID: id, containerName: name, isEventCapture: 1,
    borderWidth: 1, borderColor: 7, paddingLength: 7,
    itemContainer: new ListItemContainerProperty({
      itemCount: items.length, itemWidth: 520, itemName: items, isItemSelectBorderEn: 1,
    }),
  })
}

export function containers(page: Page) {
  const textObject: TextContainerProperty[] = []
  const listObject: ListContainerProperty[] = []
  const headings = { inbox: '01   TELEGRAM INBOX', detail: '02   MESSAGE SUMMARY', approve: '03   REVIEW DRAFT' }
  textObject.push(text(1, 'heading', 8, 33, `GlanceGram   /   ${headings[page.kind]}`))

  if (page.kind === 'inbox') {
    const { rows, connection } = page
    const status = connection === 'offline' ? 'Backend offline' : connection === 'connecting' ? 'Connecting...' : `${rows.length} recent ${rows.length === 1 ? 'message' : 'messages'}`
    textObject.push(text(2, 'status', 44, 31, status))
    if (rows.length) listObject.push(list(ID.inbox, 'messages', 79, 162, inboxLabels(rows)))
    else textObject.push(text(ID.inbox, 'empty', 79, 162, '\nNo messages yet.\n\nSend a message to the Telegram bot.', true, true))
    textObject.push(text(3, 'help', 249, 33, rows.length ? 'Scroll to select  /  Tap to open  /  Double-tap to exit' : 'Double-tap to exit'))
  } else if (page.kind === 'detail') {
    const { item } = page
    const time = new Date(item.time).toISOString().slice(0, 16).replace('T', ' ')
    textObject.push(text(2, 'sender', 43, 30, label(item.sender, 42)))
    textObject.push(text(3, 'timestamp', 74, 28, `${time} UTC  /  ${item.status.toUpperCase()}`))
    textObject.push(text(ID.detail, 'summary', 106, 137, item.summary, true, true))
    textObject.push(text(4, 'help', 248, 35, page.notice ?? (item.status === 'pending'
      ? 'Tap to review reply  /  Double-tap to inbox'
      : 'Double-tap to inbox')))
  } else {
    textObject.push(text(2, 'recipient', 43, 30, `To: ${label(page.item.sender, 42)}`))
    textObject.push(text(3, 'draft', 75, 96, page.item.replyDraft, false, true))
    listObject.push(list(ID.decision, 'decision', 176, 67, ACTIONS))
    textObject.push(text(4, 'help', 249, 33, 'Scroll to choose  /  Tap to confirm  /  Double-tap to back'))
  }
  return { containerTotalNum: textObject.length + listObject.length, textObject, listObject }
}

function eventType(envelope?: { eventType?: Gesture }) {
  if (!envelope) return null
  return envelope.eventType ?? Gesture.CLICK_EVENT
}

function selectedRow(event: List_ItemEvent, id: number, name: string, labels: string[]): number | undefined {
  if (event.containerID !== id && event.containerName !== name) return
  const index = event.currentSelectItemIndex
  const rowName = event.currentSelectItemName
  if (index !== undefined && Number.isInteger(index) && labels[index] && (!rowName || labels[index] === rowName)) return index
  if (!rowName) return
  const byName = labels.indexOf(rowName)
  if (byName >= 0) return byName
}

export type Action = { kind: 'open'; item: Summary } | { kind: 'review' | 'send' | 'dismiss' | 'back' | 'exit' | 'stop' }

export function route(page: Page, event: EvenHubEvent): Action | undefined {
  const system = eventType(event.sysEvent)
  const text = eventType(event.textEvent)
  const list = eventType(event.listEvent)
  if ([system, text, list].includes(Gesture.DOUBLE_CLICK_EVENT)) {
    return { kind: page.kind === 'inbox' ? 'exit' : 'back' }
  }
  if (system === Gesture.SYSTEM_EXIT_EVENT || system === Gesture.ABNORMAL_EXIT_EVENT) return { kind: 'stop' }

  if (event.listEvent && list === Gesture.CLICK_EVENT) {
    if (page.kind === 'inbox') {
      const index = selectedRow(event.listEvent, ID.inbox, 'messages', inboxLabels(page.rows))
      if (index !== undefined) return { kind: 'open', item: page.rows[index] }
    } else if (page.kind === 'approve') {
      const index = selectedRow(event.listEvent, ID.decision, 'decision', ACTIONS)
      if (index !== undefined) return { kind: index === 0 ? 'send' : 'dismiss' }
    }
  }
  if (page.kind === 'detail' && page.item.status === 'pending' && !event.listEvent &&
      (event.textEvent ? text === Gesture.CLICK_EVENT && (event.textEvent.containerID === ID.detail || event.textEvent.containerName === 'summary') : system === Gesture.CLICK_EVENT)) {
    return { kind: 'review' }
  }
}
