const API_BASE = 'https://api.telegram.org'

function apiUrl(method: string) {
  return `${API_BASE}/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`
}

export async function sendMessage(chatId: number, text: string) {
  const res = await fetch(apiUrl('sendMessage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  })
  if (!res.ok) {
    console.error('Telegram sendMessage error:', res.status, await res.text())
  }
}

export async function setWebhook(url: string, secret: string) {
  const res = await fetch(apiUrl('setWebhook'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, secret_token: secret }),
  })
  return res.json()
}
