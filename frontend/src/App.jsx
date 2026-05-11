import { useState, useEffect, useRef, useCallback } from 'react'

const API = ""

const SUGGESTIONS = [
  'Review this Python function for bugs',
  'What does this stack trace mean?',
  'Explain async/await in JavaScript',
  'Help me write a unit test',
]

function Login({ onLogin }) {
  const [name, setName] = useState('')
  const submit = (e) => {
    e.preventDefault()
    const clean = name.trim().replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 30)
    if (clean) {
      localStorage.setItem('lab-student', clean)
      onLogin(clean)
    }
  }
  return (
    <div className="login">
      <div className="login-box">
        <div className="login-brand">
          <div className="login-logo">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2 L4 7 L4 17 L12 22 L20 17 L20 7 Z" />
              <path d="M12 22 L12 12 M4 7 L12 12 M20 7 L12 12" />
            </svg>
          </div>
          <div>
            <div className="login-title">CodeHelper</div>
            <div className="login-subtitle">Hadith Tech Engineering · Internal Tools</div>
          </div>
        </div>
        <form onSubmit={submit}>
          <label>Sign in with your Hadith Tech username</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. ahmet.yilmaz"
            maxLength={30}
          />
          <button type="submit">Continue</button>
        </form>
        <div className="login-footer">
          By signing in you agree to Hadith Tech's <a>Acceptable Use Policy</a>.
          <br />
          Need help? Contact <a>#dev-tools</a> on Slack.
        </div>
      </div>
    </div>
  )
}

function App() {
  const [student, setStudent] = useState(() => localStorage.getItem('lab-student'))
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [attachment, setAttachment] = useState('')
  const [loading, setLoading] = useState(false)
  const [showAttach, setShowAttach] = useState(false)
  const chatEndRef = useRef(null)
  const textareaRef = useRef(null)
const abortControllerRef = useRef(null)

  useEffect(() => {
    if (!student) return
    fetch(`${API}/api/state?student=${encodeURIComponent(student)}`)
      .then((r) => r.json())
      .then((d) => {
        setAttachment(d.attack || '')
        const hist = (d.history || []).map((h) => ({
          role: h.role,
          content: h.display || h.content,
        }))
        setMessages(hist)
      })
      .catch(() => {})
  }, [student])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px'
    }
  }, [input])

const send = useCallback(async () => {
  if (!input.trim() || loading) return
  const userMsg = input

  if (attachment) {
    await fetch(`${API}/api/attack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student, attack: attachment }),
    })
  }

  setMessages((m) => [
    ...m,
    { role: 'user', content: userMsg, attachment: attachment || null },
    { role: 'assistant', content: '' },
  ])
  setInput('')
  setLoading(true)

  // Create abort controller for this request
  const controller = new AbortController()
  abortControllerRef.current = controller

  try {
    const r = await fetch(`${API}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student, message: userMsg }),
      signal: controller.signal,
    })

    if (!r.ok || !r.body) throw new Error('Network response failed')

    const reader = r.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const payload = trimmed.slice(5).trim()
        if (!payload) continue
        try {
          const data = JSON.parse(payload)
          if (data.delta) {
            setMessages((m) => {
              const copy = [...m]
              const last = copy[copy.length - 1]
              if (last && last.role === 'assistant') {
                copy[copy.length - 1] = { ...last, content: last.content + data.delta }
              }
              return copy
            })
          }
          if (data.error) {
            setMessages((m) => {
              const copy = [...m]
              copy[copy.length - 1] = { role: 'system', content: 'Error: ' + data.error }
              return copy
            })
          }
        } catch {}
      }
    }
  } catch (e) {
    if (e.name === 'AbortError') {
      // User stopped — append a marker to the partial response
      setMessages((m) => {
        const copy = [...m]
        const last = copy[copy.length - 1]
        if (last?.role === 'assistant') {
          copy[copy.length - 1] = {
            ...last,
            content: (last.content || '') + (last.content ? ' [stopped]' : '[stopped before any response]'),
          }
        }
        return copy
      })
    } else {
      setMessages((m) => {
        const copy = [...m]
        if (copy.length && copy[copy.length - 1].role === 'assistant' && !copy[copy.length - 1].content) {
          copy[copy.length - 1] = { role: 'system', content: 'Connection error. Please try again.' }
        } else {
          copy.push({ role: 'system', content: 'Connection error. Please try again.' })
        }
        return copy
      })
    }
  }
  abortControllerRef.current = null
  setLoading(false)
}, [input, loading, student, attachment])

const stop = useCallback(() => {
  if (abortControllerRef.current) {
    abortControllerRef.current.abort()
    abortControllerRef.current = null
  }
}, [])


  const newChat = useCallback(async () => {
    await fetch(`${API}/api/clear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student }),
    })
    setMessages([])
    setAttachment('')
    setShowAttach(false)
  }, [student])

  const removeAttachment = async () => {
    setAttachment('')
    setShowAttach(false)
    await fetch(`${API}/api/attack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student, attack: '' }),
    })
  }

  const logout = () => {
    localStorage.removeItem('lab-student')
    setStudent(null)
  }

  if (!student) return <Login onLogin={setStudent} />

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-logo">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2 L4 7 L4 17 L12 22 L20 17 L20 7 Z" />
              <path d="M12 22 L12 12 M4 7 L12 12 M20 7 L12 12" />
            </svg>
          </div>
          <div className="brand-text">
            <div className="brand-name">CodeHelper</div>
            <div className="brand-team">Hadith Tech Engineering</div>
          </div>
        </div>

        <button className="new-chat-btn" onClick={newChat}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New conversation
        </button>

        <div className="sidebar-section">
          <div className="sidebar-section-title">Recent</div>
          <div className="sidebar-item active">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Current session
          </div>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-title">Resources</div>
          <a className="sidebar-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6" />
            </svg>
            Style guide
          </a>
          <a className="sidebar-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" />
            </svg>
            FAQ
          </a>
          <a className="sidebar-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            Report a bug
          </a>
        </div>

        <div className="sidebar-spacer" />

        <div className="user-card" onClick={logout} title="Click to sign out">
          <div className="user-avatar">{student.charAt(0).toUpperCase()}</div>
          <div className="user-info">
            <div className="user-name">{student}</div>
            <div className="user-status">
              <span className="status-dot" />
              Online
            </div>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar-left">
            <div className="chat-title">CodeHelper</div>
            <div className="chat-meta">
              <span className="model-badge">
                <span className="model-dot" />
                Online
              </span>
            </div>
          </div>
          <div className="topbar-right">
            <button className="icon-btn" title="Share">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
              </svg>
            </button>
            <button className="icon-btn" title="Settings">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </div>
        </header>

        <div className="chat-area">
          {messages.length === 0 ? (
            <div className="welcome">
              <div className="welcome-icon">
                <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 2 L4 7 L4 17 L12 22 L20 17 L20 7 Z" />
                  <path d="M12 22 L12 12 M4 7 L12 12 M20 7 L12 12" />
                </svg>
              </div>
              <h1 className="welcome-title">Hi {student.split('.')[0]}, how can I help?</h1>
              <p className="welcome-sub">
                Ask about code, explain concepts, debug errors, or paste a snippet for review.
              </p>
              <div className="suggestions">
                {SUGGESTIONS.map((s) => (
                  <button key={s} className="suggestion-card" onClick={() => setInput(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="messages">
              {messages.map((m, i) => {
                const isLast = i === messages.length - 1
                const isStreaming = isLast && m.role === 'assistant' && loading
                const showDots = isStreaming && !m.content
                return (
                  <div key={i} className={`message ${m.role}`}>
                    {m.role === 'assistant' && (
                      <div className="message-avatar assistant-avatar">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 2 L4 7 L4 17 L12 22 L20 17 L20 7 Z" />
                        </svg>
                      </div>
                    )}
                    {m.role === 'user' && (
                      <div className="message-avatar user-avatar-msg">{student.charAt(0).toUpperCase()}</div>
                    )}
                    <div className="message-body">
                      <div className="message-name">
                        {m.role === 'assistant' ? 'CodeHelper' : m.role === 'user' ? student : 'System'}
                      </div>
                      {showDots ? (
                        <div className="thinking">
                          <span /><span /><span />
                        </div>
                      ) : (
                        <div className="message-content">
                          {m.content}
                          {isStreaming && m.content && <span className="cursor-blink">▍</span>}
                        </div>
                      )}
                      {m.attachment && (
                        <div className="attachment-chip">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <path d="M14 2v6h6" />
                          </svg>
                          <span>code.txt · {m.attachment.split('\n').length} lines</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        <div className="composer-wrap">
          <div className="composer">
            {attachment && !showAttach && (
              <div className="composer-attachment">
                <div className="att-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <path d="M14 2v6h6" />
                  </svg>
                </div>
                <div className="att-info">
                  <div className="att-name">code.txt</div>
                  <div className="att-meta">{attachment.split('\n').length} lines · attached</div>
                </div>
                <button className="att-edit" onClick={() => setShowAttach(true)} title="Edit">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
                <button className="att-remove" onClick={removeAttachment} title="Remove">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            {showAttach && (
              <div className="attach-panel">
                <div className="attach-header">
                  <span>Attach code or file content</span>
                  <button onClick={() => setShowAttach(false)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <textarea
                  className="attach-textarea"
                  value={attachment}
                  onChange={(e) => setAttachment(e.target.value)}
                  placeholder="Paste code, logs, error messages, or any text you want CodeHelper to review…"
                  autoFocus
                />
                <div className="attach-footer">
                  <span className="attach-hint">Attached content is included with your next message.</span>
                  <button className="attach-done" onClick={() => setShowAttach(false)}>Done</button>
                </div>
              </div>
            )}

            <div className="composer-input-row">
              <button
                className="composer-btn"
                onClick={() => setShowAttach(!showAttach)}
                title="Attach code"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                </svg>
              </button>
              <textarea
                ref={textareaRef}
                className="composer-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    send()
                  }
                }}
                placeholder="Message CodeHelper…"
                rows={1}
                disabled={loading}
              />
<button
  className="send-btn"
  onClick={loading ? stop : send}
  disabled={!loading && !input.trim()}
  title={loading ? 'Stop generating' : 'Send'}
>
  {loading ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )}
</button>
            </div>
          </div>
          <div className="composer-footer">
            CodeHelper can make mistakes. Verify important information before relying on it.
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
