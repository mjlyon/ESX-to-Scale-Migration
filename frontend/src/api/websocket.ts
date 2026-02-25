export function createWebSocket(onMessage: (data: unknown) => void) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const url = `${protocol}//${window.location.host}/ws`
  const ws = new WebSocket(url)

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'subscribe_all' }))
  }

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      onMessage(data)
    } catch {
      // ignore parse errors
    }
  }

  return ws
}
