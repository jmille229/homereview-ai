'use client'

import { useEffect, useRef, useState } from 'react'
import { LoadingSpinner } from './LoadingSpinner'
import type { ChatMessage, ChatResponse } from '@/lib/types'

interface ChatInterfaceProps {
  sessionId:   string
  product:     string
  paidAt:      string
  initialMessages?: ChatMessage[]
}

const CHAT_DAYS: Record<string, number> = {
  brief:  30,
  shield: 60,
  bundle: 60,
}

export function ChatInterface({
  sessionId,
  product,
  paidAt,
  initialMessages = [],
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const chatDays = CHAT_DAYS[product] ?? 30
  const chatDaysMs = chatDays * 24 * 60 * 60 * 1000
  const expired = Date.now() - new Date(paidAt).getTime() > chatDaysMs

  const daysRemaining = expired
    ? 0
    : Math.ceil((new Date(paidAt).getTime() + chatDaysMs - Date.now()) / (1000 * 60 * 60 * 24))

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    const message = input.trim()
    if (!message || loading || expired) return

    const userMsg: ChatMessage = {
      role:      'user',
      content:   message,
      timestamp: new Date().toISOString(),
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          sessionId,
          message,
          history: messages.slice(-10), // send recent context only
        }),
      })

      const json: ChatResponse | { error: string } = await res.json()

      if (!res.ok || 'error' in json) {
        setError(('error' in json ? json.error : null) ?? 'Could not get a response. Please try again.')
        // Remove the optimistically added user message on failure
        setMessages(prev => prev.slice(0, -1))
        setInput(message)
        return
      }

      const assistantMsg: ChatMessage = {
        role:      'assistant',
        content:   (json as ChatResponse).reply,
        timestamp: new Date().toISOString(),
      }
      setMessages(prev => [...prev, assistantMsg])
    } catch {
      setError('Network error. Please try again.')
      setMessages(prev => prev.slice(0, -1))
      setInput(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Slim meta row — the navy band the report pages wrap this in already
          carries the heading, so a second full header here was pure noise. */}
      {!expired && (
        <p className="text-xs text-brand-muted mb-4">
          Ask anything about your situation · Unlimited questions · {daysRemaining} days remaining
        </p>
      )}

      {/* Message history */}
      {messages.length > 0 && (
        <div className="space-y-3 mb-4 max-h-[400px] overflow-y-auto pr-1">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`text-sm rounded-2xl px-4 py-2.5 max-w-[85%] leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-brand-navy text-white rounded-tr-sm'
                    : 'bg-brand-bg border border-brand-border text-brand-navy rounded-tl-sm'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-brand-bg border border-brand-border rounded-2xl rounded-tl-sm px-4 py-3">
                <LoadingSpinner size={14} color="#5A6678" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Starter prompts — shown when no messages yet */}
      {messages.length === 0 && !expired && (
        <div className="flex flex-wrap gap-2 mb-4">
          {[
            'What should I do first?',
            'Is this covered by home warranty?',
            'What questions should I ask?',
            'Can I do any of this myself?',
          ].map(prompt => (
            <button
              key={prompt}
              onClick={() => { setInput(prompt); }}
              className="text-xs px-3 py-2 bg-brand-bg border border-brand-border rounded-full text-brand-muted hover:border-brand-border-dark hover:text-brand-navy transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div role="alert" className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      {/* Input */}
      {expired ? (
        <div className="p-4 bg-brand-bg border border-brand-border rounded-xl text-center">
          <p className="text-xs text-brand-muted">
            Your {chatDays}-day chat window has expired.
          </p>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
            }}
            placeholder="Ask anything about your situation…"
            maxLength={2000}
            className="input flex-1"
            disabled={loading}
            aria-label="Chat message"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="px-4 py-2.5 bg-brand-navy text-white text-sm rounded-xl disabled:opacity-40 transition-opacity flex-shrink-0 flex items-center gap-2"
            aria-label="Send message"
          >
            {loading ? <LoadingSpinner size={14} color="white" /> : 'Send'}
          </button>
        </div>
      )}
    </div>
  )
}
