'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import AuthGuard from '@/components/AuthGuard'
import ReactMarkdown from 'react-markdown'

// Icons as components for cleaner code
const Icons = {
  Menu: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  ),
  Plus: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  ),
  Image: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  Download: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  ),
  Send: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m0 0l-7 7m7-7l7 7" />
    </svg>
  ),
  Copy: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  ),
  Check: () => (
    <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  Trash: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
  Chat: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  Sparkles: () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  ),
  ChevronDown: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  ),
  Close: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  User: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  Logout: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  ),
  Settings: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
}

// Generate unique ID
const generateId = () => Math.random().toString(36).substring(2, 15)

function HomeContent() {
  const { user, signOut } = useAuth()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [conversations, setConversations] = useState([])
  const [currentConversationId, setCurrentConversationId] = useState(null)
  const [copiedId, setCopiedId] = useState(null)
  const [mode, setMode] = useState('chat') // 'chat' or 'image'
  const [modeMenuOpen, setModeMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)
  const inputContainerRef = useRef(null)
  const modeMenuRef = useRef(null)
  const userMenuRef = useRef(null)

  // Get user display info
  const userDisplayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'
  const userEmail = user?.email || ''
  const userInitials = userDisplayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modeMenuRef.current && !modeMenuRef.current.contains(event.target)) {
        setModeMenuOpen(false)
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Handle logout
  const handleLogout = async () => {
    await signOut()
    setUserMenuOpen(false)
  }

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px'
    }
  }, [input])

  // Load conversations from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('conversations')
    if (saved) {
      const parsed = JSON.parse(saved)
      setConversations(parsed)
    }
  }, [])

  // Save conversations to localStorage
  useEffect(() => {
    if (conversations.length > 0) {
      localStorage.setItem('conversations', JSON.stringify(conversations))
    }
  }, [conversations])

  // Start new chat
  const startNewChat = () => {
    const newId = generateId()
    setCurrentConversationId(newId)
    setMessages([])
    setSidebarOpen(false)
    setMode('chat') // Reset to chat mode
  }

  // Load conversation
  const loadConversation = (conv) => {
    setCurrentConversationId(conv.id)
    setMessages(conv.messages)
    setSidebarOpen(false)
  }

  // Delete conversation
  const deleteConversation = (e, convId) => {
    e.stopPropagation()
    setConversations(prev => prev.filter(c => c.id !== convId))
    if (currentConversationId === convId) {
      setCurrentConversationId(null)
      setMessages([])
    }
  }

  // Copy message to clipboard
  const copyMessage = async (content, id) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  // Handle send message
  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage = {
      id: generateId(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString()
    }

    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setIsLoading(true)

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    try {
      let data

      if (mode === 'image') {
        // Direct image generation
        const res = await fetch('/api/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: userMessage.content
          })
        })
        data = await res.json()

        if (data.success) {
          data = {
            post: `Here's the image I created for "${userMessage.content}":`,
            isImage: true,
            imageUrl: data.imageUrl,
            imagePrompt: data.prompt,
            model: data.model
          }
        } else {
          data = { error: data.error || 'Failed to generate image' }
        }
      } else {
        // Regular chat
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: userMessage.content,
            messages: newMessages
          })
        })
        data = await res.json()
      }

      const assistantMessage = {
        id: generateId(),
        role: 'assistant',
        content: data.error ? `Error: ${data.error}` : data.post,
        timestamp: new Date().toISOString(),
        ...(data.isImage && {
          isImage: true,
          imageUrl: data.imageUrl,
          imagePrompt: data.imagePrompt,
          model: data.model
        })
      }

      const updatedMessages = [...newMessages, assistantMessage]
      setMessages(updatedMessages)

      // Save to conversations
      const convId = currentConversationId || generateId()
      if (!currentConversationId) {
        setCurrentConversationId(convId)
      }

      setConversations(prev => {
        const existingIndex = prev.findIndex(c => c.id === convId)
        const conversation = {
          id: convId,
          title: userMessage.content.substring(0, 30) + (userMessage.content.length > 30 ? '...' : ''),
          messages: updatedMessages,
          updatedAt: new Date().toISOString()
        }

        if (existingIndex >= 0) {
          const updated = [...prev]
          updated[existingIndex] = conversation
          return updated
        }
        return [conversation, ...prev]
      })

    } catch (error) {
      const errorMessage = {
        id: generateId(),
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
        timestamp: new Date().toISOString()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  // Handle key press
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Select mode
  const selectMode = (newMode) => {
    setMode(newMode)
    setModeMenuOpen(false)
  }

  // Suggested prompts based on mode
  const suggestedPrompts = mode === 'image'
    ? [
        "A sunset over mountains with golden light",
        "A futuristic city at night with neon lights",
        "A cute robot playing with a cat",
        "An astronaut riding a horse on Mars"
      ]
    : [
        "Help me write a professional email",
        "Explain a complex topic simply",
        "Generate creative ideas for my project",
        "Help me solve a coding problem"
      ]

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`sidebar w-64 h-full flex flex-col ${sidebarOpen ? 'open' : ''}`}>
        {/* Sidebar Header */}
        <div className="p-3 border-b border-gray-800">
          <button
            onClick={startNewChat}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-lg border border-gray-700 hover:bg-gray-800 transition-colors text-sm"
          >
            <Icons.Plus />
            <span>New chat</span>
          </button>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto py-2">
          {conversations.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500 text-sm">
              No conversations yet
            </div>
          ) : (
            <div className="space-y-1 px-2">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => loadConversation(conv)}
                  className={`sidebar-item group flex items-center gap-3 px-3 py-3 rounded-lg cursor-pointer ${
                    currentConversationId === conv.id ? 'active' : ''
                  }`}
                >
                  <Icons.Chat />
                  <span className="flex-1 truncate text-sm">{conv.title}</span>
                  <button
                    onClick={(e) => deleteConversation(e, conv.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-700 rounded transition-opacity"
                  >
                    <Icons.Trash />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-gray-800">
          <div className="flex items-center gap-3 px-3 py-2 text-gray-400 text-sm">
            <Icons.Sparkles />
            <span>Your Personal AI Assistant</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-[#212121]">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <Icons.Menu />
            </button>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="hidden md:flex p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <Icons.Menu />
            </button>
            <h1 className="text-lg font-semibold">Your Personal AI Assistant</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={startNewChat}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <Icons.Plus />
            </button>

            {/* User Menu */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 p-1.5 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#10a37f] to-[#1a7f64] flex items-center justify-center text-sm font-medium">
                  {userInitials}
                </div>
              </button>

              {/* User Dropdown Menu */}
              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-[#2f2f2f] rounded-xl border border-gray-700 shadow-xl overflow-hidden animate-fade-in z-50">
                  {/* User Info */}
                  <div className="px-4 py-3 border-b border-gray-700">
                    <p className="font-medium text-white truncate">{userDisplayName}</p>
                    <p className="text-sm text-gray-400 truncate">{userEmail}</p>
                  </div>

                  {/* Menu Items */}
                  <div className="p-1">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-red-400 hover:bg-gray-700/50 rounded-lg transition-colors text-left"
                    >
                      <Icons.Logout />
                      <span>Sign out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            /* Empty State */
            <div className="h-full flex flex-col items-center justify-center px-4">
              <div className="max-w-2xl w-full text-center">
                <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-6 ${
                  mode === 'image'
                    ? 'bg-gradient-to-br from-purple-500 to-pink-500'
                    : 'bg-gradient-to-br from-[#10a37f] to-[#1a7f64]'
                }`}>
                  {mode === 'image' ? <Icons.Image /> : <Icons.Sparkles />}
                </div>
                <h2 className="text-2xl font-semibold mb-2">
                  {mode === 'image' ? 'What image shall I create?' : 'How can I help you today?'}
                </h2>
                <p className="text-gray-400 mb-8">
                  {mode === 'image'
                    ? 'Describe the image you want to generate. Be as detailed as you like!'
                    : "I'm your personal AI assistant, ready to help with writing, analysis, coding, and more."
                  }
                </p>

                {/* Suggested Prompts */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {suggestedPrompts.map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => setInput(prompt)}
                      className="p-4 text-left bg-[#2f2f2f] hover:bg-[#3f3f3f] rounded-xl border border-gray-700 transition-colors animate-fade-in"
                      style={{ animationDelay: `${i * 100}ms` }}
                    >
                      <span className="text-sm text-gray-300">{prompt}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Messages */
            <div className="max-w-3xl mx-auto w-full px-4 py-6">
              {messages.map((message, index) => (
                <div
                  key={message.id}
                  className={`mb-6 animate-fade-in ${message.role === 'user' ? 'flex justify-end' : ''}`}
                  style={{ animationDelay: '0ms' }}
                >
                  {message.role === 'user' ? (
                    /* User Message */
                    <div className="max-w-[85%] bg-[#2f2f2f] rounded-2xl px-4 py-3">
                      <p className="text-white whitespace-pre-wrap">{message.content}</p>
                    </div>
                  ) : (
                    /* Assistant Message */
                    <div className="group">
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          message.isImage
                            ? 'bg-gradient-to-br from-purple-500 to-pink-500'
                            : 'bg-gradient-to-br from-[#10a37f] to-[#1a7f64]'
                        }`}>
                          {message.isImage ? <Icons.Image /> : <Icons.Sparkles />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="message-content text-gray-100 prose prose-invert prose-sm max-w-none">
                            <ReactMarkdown>{message.content}</ReactMarkdown>
                          </div>
                          {/* Render image if present */}
                          {message.isImage && message.imageUrl && (
                            <div className="mt-4">
                              <div className="relative inline-block rounded-xl overflow-hidden border border-gray-700 shadow-lg generated-image">
                                <img
                                  src={message.imageUrl}
                                  alt={message.imagePrompt || 'Generated image'}
                                  className="max-w-full sm:max-w-md lg:max-w-lg rounded-xl"
                                  loading="lazy"
                                  onError={(e) => {
                                    e.target.style.display = 'none'
                                    e.target.nextSibling.style.display = 'flex'
                                  }}
                                />
                                <div className="hidden items-center justify-center w-64 h-64 bg-gray-800 text-gray-400 text-sm">
                                  Failed to load image
                                </div>
                                <div className="absolute bottom-2 right-2 flex gap-2">
                                  <a
                                    href={message.imageUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 bg-black/70 hover:bg-black/90 rounded-lg transition-colors"
                                    title="Open in new tab"
                                  >
                                    <Icons.Download />
                                  </a>
                                </div>
                              </div>
                              {message.model && (
                                <p className="text-xs text-gray-500 mt-2">
                                  Generated with {message.model}
                                </p>
                              )}
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => copyMessage(message.content, message.id)}
                              className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
                            >
                              {copiedId === message.id ? <Icons.Check /> : <Icons.Copy />}
                              {copiedId === message.id ? 'Copied!' : 'Copy'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Loading indicator */}
              {isLoading && (
                <div className="mb-6 animate-fade-in">
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      mode === 'image'
                        ? 'bg-gradient-to-br from-purple-500 to-pink-500'
                        : 'bg-gradient-to-br from-[#10a37f] to-[#1a7f64]'
                    }`}>
                      {mode === 'image' ? <Icons.Image /> : <Icons.Sparkles />}
                    </div>
                    <div className="py-4">
                      {mode === 'image' ? (
                        <div className="flex items-center gap-3">
                          <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-gray-400 text-sm">Creating your image...</span>
                        </div>
                      ) : (
                        <div className="typing-indicator flex gap-1">
                          <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                          <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                          <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-800 bg-[#212121] p-4">
          <div className="max-w-3xl mx-auto">
            <div
              ref={inputContainerRef}
              className="relative bg-[#2f2f2f] rounded-2xl border border-gray-700 focus-within:border-[#10a37f] transition-colors"
            >
              {/* Mode Selector Button */}
              <div className="absolute left-2 bottom-2" ref={modeMenuRef}>
                <button
                  onClick={() => setModeMenuOpen(!modeMenuOpen)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm ${
                    mode === 'image'
                      ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {mode === 'image' ? <Icons.Image /> : <Icons.Chat />}
                  <span className="hidden sm:inline">{mode === 'image' ? 'Create Image' : 'Chat'}</span>
                  <Icons.ChevronDown />
                </button>

                {/* Mode Dropdown Menu */}
                {modeMenuOpen && (
                  <div className="absolute bottom-full left-0 mb-2 w-56 bg-[#2f2f2f] rounded-xl border border-gray-700 shadow-xl overflow-hidden animate-fade-in z-50">
                    <div className="p-1">
                      <button
                        onClick={() => selectMode('chat')}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-colors text-left ${
                          mode === 'chat' ? 'bg-gray-700' : 'hover:bg-gray-700/50'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#10a37f] to-[#1a7f64] flex items-center justify-center">
                          <Icons.Chat />
                        </div>
                        <div>
                          <div className="font-medium text-white">Chat</div>
                          <div className="text-xs text-gray-400">Ask questions, get help</div>
                        </div>
                      </button>
                      <button
                        onClick={() => selectMode('image')}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-colors text-left ${
                          mode === 'image' ? 'bg-gray-700' : 'hover:bg-gray-700/50'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                          <Icons.Image />
                        </div>
                        <div>
                          <div className="font-medium text-white">Create Image</div>
                          <div className="text-xs text-gray-400">Generate AI images</div>
                        </div>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={mode === 'image' ? 'Describe the image you want to create...' : 'Message Your Personal AI Assistant...'}
                className="w-full bg-transparent pl-40 sm:pl-44 pr-14 py-4 text-white placeholder-gray-500 resize-none focus:outline-none auto-resize-textarea"
                rows={1}
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className={`absolute right-2 bottom-2 p-2 rounded-lg transition-colors disabled:cursor-not-allowed ${
                  mode === 'image'
                    ? 'bg-purple-500 disabled:bg-gray-600 text-white disabled:text-gray-400'
                    : 'bg-white disabled:bg-gray-600 text-black disabled:text-gray-400'
                }`}
              >
                <Icons.Send />
              </button>
            </div>
            <p className="text-xs text-gray-500 text-center mt-3">
              {mode === 'image'
                ? 'Describe your image and press Enter to generate'
                : 'Press Enter to send, Shift + Enter for new line'
              }
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}

// Wrap with AuthGuard to protect the route
export default function Home() {
  return (
    <AuthGuard>
      <HomeContent />
    </AuthGuard>
  )
}
