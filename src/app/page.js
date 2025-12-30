'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'

// Icons
const Icons = {
  Sparkles: ({ className = "w-6 h-6" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  ),
  Chat: ({ className = "w-6 h-6" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  Image: ({ className = "w-6 h-6" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  Code: ({ className = "w-6 h-6" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  ),
  Zap: ({ className = "w-6 h-6" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  Shield: ({ className = "w-6 h-6" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  Globe: ({ className = "w-6 h-6" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
  ),
  Check: ({ className = "w-5 h-5" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  ArrowRight: ({ className = "w-5 h-5" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
    </svg>
  ),
  Menu: ({ className = "w-6 h-6" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  ),
  Close: ({ className = "w-6 h-6" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  Users: ({ className = "w-6 h-6" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  TrendingUp: ({ className = "w-6 h-6" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  ),
}

// Pricing data with usage-based model for UnitPay
const pricingPlans = [
  {
    name: 'Starter',
    description: 'Perfect for trying out the platform',
    price: 0,
    priceLabel: 'Free',
    period: 'forever',
    highlight: false,
    features: [
      '100 chat messages / month',
      '10 image generations / month',
      'Basic AI models',
      'Email support',
      'Community access',
    ],
    limits: {
      chatMessages: 100,
      imageGenerations: 10,
    },
    cta: 'Get Started Free',
    ctaLink: '/auth/signup',
  },
  {
    name: 'Pro',
    description: 'For professionals who need more power',
    price: 29,
    priceLabel: '$29',
    period: '/month',
    highlight: true,
    popular: true,
    features: [
      '2,000 chat messages / month',
      '200 image generations / month',
      'Advanced AI models (GPT-4, Claude)',
      'Priority support',
      'API access',
      'Usage-based overage pricing:',
    ],
    usageRates: [
      { label: 'Extra chat messages', rate: '$0.002/msg' },
      { label: 'Extra image generations', rate: '$0.02/img' },
    ],
    limits: {
      chatMessages: 2000,
      imageGenerations: 200,
    },
    cta: 'Start Pro Trial',
    ctaLink: '/auth/signup?plan=pro',
  },
  {
    name: 'Team',
    description: 'For teams building AI-powered products',
    price: 99,
    priceLabel: '$99',
    period: '/month',
    highlight: false,
    features: [
      '10,000 chat messages / month',
      '1,000 image generations / month',
      'All AI models + early access',
      'Dedicated account manager',
      'Team collaboration tools',
      'Volume discount pricing:',
    ],
    usageRates: [
      { label: 'Extra chat messages', rate: '$0.001/msg' },
      { label: 'Extra image generations', rate: '$0.015/img' },
    ],
    limits: {
      chatMessages: 10000,
      imageGenerations: 1000,
    },
    cta: 'Contact Sales',
    ctaLink: '/auth/signup?plan=team',
  },
]

const features = [
  {
    icon: Icons.Chat,
    title: 'AI Chat Assistant',
    description: 'Get instant answers, brainstorm ideas, and solve complex problems with our advanced AI chat.',
  },
  {
    icon: Icons.Image,
    title: 'Image Generation',
    description: 'Create stunning images from text descriptions using state-of-the-art AI models.',
  },
  {
    icon: Icons.Code,
    title: 'Code Assistant',
    description: 'Debug code, generate solutions, and learn new programming concepts with AI help.',
  },
  {
    icon: Icons.Zap,
    title: 'Lightning Fast',
    description: 'Get responses in seconds with our optimized infrastructure and model selection.',
  },
  {
    icon: Icons.Shield,
    title: 'Secure & Private',
    description: 'Your data is encrypted and never used to train models. Enterprise-grade security.',
  },
  {
    icon: Icons.Globe,
    title: 'Available Everywhere',
    description: 'Access from any device, anywhere. Works on web, mobile, and desktop.',
  },
]

const faqs = [
  {
    question: 'How does usage-based pricing work?',
    answer: 'Each plan includes a base amount of messages and image generations. If you exceed your limits, you pay a small per-use fee. This ensures you only pay for what you use, with predictable base costs.',
  },
  {
    question: 'Can I upgrade or downgrade my plan?',
    answer: 'Yes! You can change your plan at any time. When upgrading, you get immediate access to new features. When downgrading, the change takes effect at the end of your billing cycle.',
  },
  {
    question: 'What AI models do you use?',
    answer: 'We use a combination of leading AI models including Llama 3.3, GPT-4, and Claude for chat, and Flux, Stable Diffusion, and Imagen for image generation. Pro and Team plans get access to the most advanced models.',
  },
  {
    question: 'Is my data secure?',
    answer: 'Your conversations and generated content are encrypted and stored securely. We never use your data to train AI models, and you can delete your data at any time.',
  },
  {
    question: 'Do you offer enterprise plans?',
    answer: 'Yes! For organizations with specific needs, we offer custom enterprise plans with dedicated support, custom integrations, SLA guarantees, and volume pricing. Contact us for details.',
  },
]

// Demo scenarios for the interactive demo
const demoScenarios = [
  {
    type: 'image',
    userMessage: 'Create a futuristic city skyline at sunset',
    aiResponse: "Here's your futuristic city skyline at sunset:",
    gradient: 'from-purple-900/50 via-pink-900/50 to-orange-900/50',
  },
  {
    type: 'chat',
    userMessage: 'Explain quantum computing in simple terms',
    aiResponse: "Quantum computing uses quantum bits (qubits) that can exist in multiple states simultaneously, unlike classical bits. This allows quantum computers to process many possibilities at once, making them incredibly powerful for specific tasks like cryptography, drug discovery, and optimization problems.",
  },
  {
    type: 'image',
    userMessage: 'A magical forest with glowing mushrooms',
    aiResponse: "Here's your magical forest:",
    gradient: 'from-emerald-900/50 via-teal-900/50 to-cyan-900/50',
  },
  {
    type: 'chat',
    userMessage: 'Write a haiku about coding',
    aiResponse: "Lines of logic flow\nBugs hide in the syntax deep\nCoffee fuels the fix",
  },
  {
    type: 'image',
    userMessage: 'An astronaut playing guitar on Mars',
    aiResponse: "Here's your space musician:",
    gradient: 'from-red-900/50 via-orange-900/50 to-amber-900/50',
  },
]

// Interactive Demo Component
function InteractiveDemo() {
  const [currentScenario, setCurrentScenario] = useState(0)
  const [displayedUserText, setDisplayedUserText] = useState('')
  const [displayedAiText, setDisplayedAiText] = useState('')
  const [phase, setPhase] = useState('typing-user') // 'typing-user' | 'loading' | 'typing-ai' | 'complete'
  const [isImageLoading, setIsImageLoading] = useState(false)

  const scenario = demoScenarios[currentScenario]

  // Reset and start animation for current scenario
  const startAnimation = useCallback(() => {
    setDisplayedUserText('')
    setDisplayedAiText('')
    setPhase('typing-user')
    setIsImageLoading(false)
  }, [])

  // Type user message
  useEffect(() => {
    if (phase !== 'typing-user') return

    const text = scenario.userMessage
    if (displayedUserText.length < text.length) {
      const timer = setTimeout(() => {
        setDisplayedUserText(text.slice(0, displayedUserText.length + 1))
      }, 40)
      return () => clearTimeout(timer)
    } else {
      // Done typing user message, start loading
      const timer = setTimeout(() => {
        setPhase('loading')
        if (scenario.type === 'image') {
          setIsImageLoading(true)
        }
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [phase, displayedUserText, scenario])

  // Loading phase
  useEffect(() => {
    if (phase !== 'loading') return

    const loadTime = scenario.type === 'image' ? 2000 : 800
    const timer = setTimeout(() => {
      setPhase('typing-ai')
      setIsImageLoading(false)
    }, loadTime)
    return () => clearTimeout(timer)
  }, [phase, scenario.type])

  // Type AI response
  useEffect(() => {
    if (phase !== 'typing-ai') return

    const text = scenario.aiResponse
    if (displayedAiText.length < text.length) {
      const speed = scenario.type === 'chat' ? 15 : 30
      const timer = setTimeout(() => {
        setDisplayedAiText(text.slice(0, displayedAiText.length + 1))
      }, speed)
      return () => clearTimeout(timer)
    } else {
      setPhase('complete')
    }
  }, [phase, displayedAiText, scenario])

  // Auto-advance to next scenario
  useEffect(() => {
    if (phase !== 'complete') return

    const timer = setTimeout(() => {
      setCurrentScenario((prev) => (prev + 1) % demoScenarios.length)
    }, 4000)
    return () => clearTimeout(timer)
  }, [phase])

  // Start animation when scenario changes
  useEffect(() => {
    startAnimation()
  }, [currentScenario, startAnimation])

  const handleScenarioClick = (index) => {
    if (index !== currentScenario) {
      setCurrentScenario(index)
    }
  }

  return (
    <div className="mt-20 relative animate-fade-in">
      <div className="bg-gradient-to-b from-[#1a1a1a] to-[#0f0f0f] rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
        {/* Window Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/30">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-400 transition-colors cursor-pointer"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-400 transition-colors cursor-pointer"></div>
            <div className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-400 transition-colors cursor-pointer"></div>
          </div>
          <div className="text-xs text-gray-500">NexusAI Demo</div>
          <div className="w-16"></div>
        </div>

        {/* Chat Content */}
        <div className="p-6 sm:p-8 min-h-[320px]">
          <div className="space-y-6">
            {/* User message */}
            <div className="flex justify-end">
              <div className="bg-[#2f2f2f] rounded-2xl px-4 py-3 max-w-md transform transition-all duration-300">
                <p className="text-white">
                  {displayedUserText}
                  {phase === 'typing-user' && (
                    <span className="inline-block w-0.5 h-5 bg-white ml-0.5 animate-pulse"></span>
                  )}
                </p>
              </div>
            </div>

            {/* AI response */}
            {(phase === 'loading' || phase === 'typing-ai' || phase === 'complete') && (
              <div className="flex items-start gap-3 animate-fade-in">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  scenario.type === 'image'
                    ? 'bg-gradient-to-br from-purple-500 to-pink-500'
                    : 'bg-gradient-to-br from-[#10a37f] to-[#1a7f64]'
                }`}>
                  {scenario.type === 'image' ? (
                    <Icons.Image className="w-4 h-4 text-white" />
                  ) : (
                    <Icons.Sparkles className="w-4 h-4 text-white" />
                  )}
                </div>
                <div className="flex-1">
                  {/* Loading state */}
                  {phase === 'loading' && (
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                      </div>
                      <span className="text-gray-500 text-sm">
                        {scenario.type === 'image' ? 'Generating image...' : 'Thinking...'}
                      </span>
                    </div>
                  )}

                  {/* AI Text Response */}
                  {(phase === 'typing-ai' || phase === 'complete') && (
                    <div>
                      <p className="text-gray-300 mb-3">
                        {displayedAiText}
                        {phase === 'typing-ai' && (
                          <span className="inline-block w-0.5 h-4 bg-gray-400 ml-0.5 animate-pulse"></span>
                        )}
                      </p>

                      {/* Image placeholder for image type */}
                      {scenario.type === 'image' && phase === 'complete' && (
                        <div className={`w-full sm:w-80 h-48 bg-gradient-to-br ${scenario.gradient} rounded-xl border border-white/10 flex items-center justify-center transform transition-all duration-500 animate-fade-in overflow-hidden relative`}>
                          {/* Shimmer overlay */}
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer"></div>
                          <span className="text-gray-400 text-sm z-10">AI Generated Image</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Image loading state */}
                  {isImageLoading && (
                    <div className="w-full sm:w-80 h-48 bg-[#2f2f2f] rounded-xl border border-white/10 flex items-center justify-center overflow-hidden relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-[#2f2f2f] via-[#3f3f3f] to-[#2f2f2f] animate-shimmer"></div>
                      <div className="flex items-center gap-2 z-10">
                        <svg className="w-5 h-5 text-purple-400 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                        </svg>
                        <span className="text-gray-400 text-sm">Creating your image...</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Scenario Selector */}
        <div className="px-4 pb-4 flex items-center justify-center gap-2">
          {demoScenarios.map((_, index) => (
            <button
              key={index}
              onClick={() => handleScenarioClick(index)}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                index === currentScenario
                  ? 'w-6 bg-[#10a37f]'
                  : 'bg-gray-600 hover:bg-gray-500'
              }`}
              aria-label={`Demo scenario ${index + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Glow effect */}
      <div className="absolute -inset-4 bg-gradient-to-r from-[#10a37f]/20 to-purple-500/20 rounded-3xl blur-xl -z-10"></div>
    </div>
  )
}

export default function LandingPage() {
  const { user } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [openFaq, setOpenFaq] = useState(null)

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#10a37f] to-[#1a7f64] flex items-center justify-center">
                <Icons.Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">NexusAI</span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-gray-400 hover:text-white transition-colors">Features</a>
              <a href="#pricing" className="text-gray-400 hover:text-white transition-colors">Pricing</a>
              <a href="#faq" className="text-gray-400 hover:text-white transition-colors">FAQ</a>
            </div>

            {/* Auth Buttons */}
            <div className="hidden md:flex items-center gap-4">
              {user ? (
                <Link
                  href="/dashboard"
                  className="px-4 py-2 bg-gradient-to-r from-[#10a37f] to-[#1a7f64] text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
                >
                  Go to Dashboard
                </Link>
              ) : (
                <>
                  <Link href="/auth/login" className="text-gray-400 hover:text-white transition-colors">
                    Sign In
                  </Link>
                  <Link
                    href="/auth/signup"
                    className="px-4 py-2 bg-gradient-to-r from-[#10a37f] to-[#1a7f64] text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2 text-gray-400 hover:text-white"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <Icons.Close /> : <Icons.Menu />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#0a0a0a] border-t border-white/5 animate-fade-in">
            <div className="px-4 py-4 space-y-4">
              <a href="#features" className="block text-gray-400 hover:text-white transition-colors" onClick={() => setMobileMenuOpen(false)}>Features</a>
              <a href="#pricing" className="block text-gray-400 hover:text-white transition-colors" onClick={() => setMobileMenuOpen(false)}>Pricing</a>
              <a href="#faq" className="block text-gray-400 hover:text-white transition-colors" onClick={() => setMobileMenuOpen(false)}>FAQ</a>
              <div className="pt-4 border-t border-white/10 space-y-3">
                {user ? (
                  <Link
                    href="/dashboard"
                    className="block w-full px-4 py-2 bg-gradient-to-r from-[#10a37f] to-[#1a7f64] text-white rounded-lg font-medium text-center"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Go to Dashboard
                  </Link>
                ) : (
                  <>
                    <Link href="/auth/login" className="block text-gray-400 hover:text-white transition-colors" onClick={() => setMobileMenuOpen(false)}>
                      Sign In
                    </Link>
                    <Link
                      href="/auth/signup"
                      className="block w-full px-4 py-2 bg-gradient-to-r from-[#10a37f] to-[#1a7f64] text-white rounded-lg font-medium text-center"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Get Started
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#10a37f]/20 rounded-full blur-3xl"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
        </div>

        <div className="max-w-7xl mx-auto relative">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-8 animate-fade-in">
              <span className="w-2 h-2 bg-[#10a37f] rounded-full animate-pulse"></span>
              <span className="text-sm text-gray-400">Powered by cutting-edge AI</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold text-white mb-6 animate-fade-in leading-tight">
              Your AI-Powered
              <span className="block bg-gradient-to-r from-[#10a37f] via-emerald-400 to-teal-300 bg-clip-text text-transparent">
                Creative Assistant
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg sm:text-xl text-gray-400 mb-10 max-w-2xl mx-auto animate-fade-in">
              Chat, create images, write code, and accomplish more with the most advanced AI assistant.
              Pay only for what you use.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in">
              <Link
                href={user ? "/dashboard" : "/auth/signup"}
                className="group w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-[#10a37f] to-[#1a7f64] text-white rounded-xl font-semibold text-lg hover:opacity-90 transition-all flex items-center justify-center gap-2"
              >
                {user ? "Go to Dashboard" : "Start Free Today"}
                <Icons.ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <a
                href="#pricing"
                className="w-full sm:w-auto px-8 py-4 bg-white/5 border border-white/10 text-white rounded-xl font-semibold text-lg hover:bg-white/10 transition-colors text-center"
              >
                View Pricing
              </a>
            </div>

            {/* Social Proof */}
            <div className="mt-16 flex flex-col sm:flex-row items-center justify-center gap-8 text-gray-500 animate-fade-in">
              <div className="flex items-center gap-2">
                <Icons.Users className="w-5 h-5" />
                <span>10,000+ users</span>
              </div>
              <div className="flex items-center gap-2">
                <Icons.Chat className="w-5 h-5" />
                <span>1M+ conversations</span>
              </div>
              <div className="flex items-center gap-2">
                <Icons.TrendingUp className="w-5 h-5" />
                <span>99.9% uptime</span>
              </div>
            </div>
          </div>

          {/* Interactive Demo */}
          <InteractiveDemo />
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-[#0f0f0f]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Everything you need to create
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Powerful AI tools designed to boost your productivity and creativity
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group p-6 bg-[#1a1a1a] rounded-2xl border border-white/5 hover:border-[#10a37f]/50 transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#10a37f]/20 to-[#10a37f]/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <feature.icon className="w-6 h-6 text-[#10a37f]" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-gray-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Start free, scale as you grow. Only pay for what you use beyond your plan limits.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {pricingPlans.map((plan, index) => (
              <div
                key={index}
                className={`relative p-8 rounded-2xl border transition-all duration-300 ${
                  plan.highlight
                    ? 'bg-gradient-to-b from-[#10a37f]/10 to-transparent border-[#10a37f]/50 scale-105 lg:scale-110 shadow-xl shadow-[#10a37f]/10'
                    : 'bg-[#1a1a1a] border-white/5 hover:border-white/20'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-[#10a37f] to-emerald-400 rounded-full text-sm font-medium text-white">
                    Most Popular
                  </div>
                )}

                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                  <p className="text-gray-400 text-sm mb-6">{plan.description}</p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-5xl font-bold text-white">{plan.priceLabel}</span>
                    {plan.period && <span className="text-gray-400">{plan.period}</span>}
                  </div>
                </div>

                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start gap-3">
                      <Icons.Check className="w-5 h-5 text-[#10a37f] flex-shrink-0 mt-0.5" />
                      <span className="text-gray-300">{feature}</span>
                    </li>
                  ))}
                  {plan.usageRates && (
                    <li className="pl-8 space-y-2">
                      {plan.usageRates.map((rate, rateIndex) => (
                        <div key={rateIndex} className="flex justify-between text-sm">
                          <span className="text-gray-500">{rate.label}</span>
                          <span className="text-[#10a37f] font-mono">{rate.rate}</span>
                        </div>
                      ))}
                    </li>
                  )}
                </ul>

              </div>
            ))}
          </div>

          {/* Usage Note */}
          <div className="mt-12 text-center">
            <p className="text-gray-500 text-sm">
              All plans include a 14-day free trial. No credit card required to start.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 px-4 sm:px-6 lg:px-8 bg-[#0f0f0f]">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Frequently asked questions
            </h2>
            <p className="text-gray-400 text-lg">
              Everything you need to know about NexusAI
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="border border-white/5 rounded-xl overflow-hidden"
              >
                <button
                  className="w-full px-6 py-4 flex items-center justify-between text-left bg-[#1a1a1a] hover:bg-[#1f1f1f] transition-colors"
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                >
                  <span className="font-medium text-white">{faq.question}</span>
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${openFaq === index ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {openFaq === index && (
                  <div className="px-6 py-4 bg-[#151515] text-gray-400 animate-fade-in">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="p-12 rounded-3xl bg-gradient-to-br from-[#10a37f]/20 via-[#1a1a1a] to-purple-500/10 border border-white/10 relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>
            <div className="relative">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Ready to supercharge your workflow?
              </h2>
              <p className="text-gray-400 text-lg mb-8 max-w-2xl mx-auto">
                Join thousands of professionals using NexusAI to create, code, and communicate better.
              </p>
              <Link
                href={user ? "/dashboard" : "/auth/signup"}
                className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-[#10a37f] to-emerald-400 text-white rounded-xl font-semibold text-lg hover:opacity-90 transition-opacity"
              >
                {user ? "Go to Dashboard" : "Get Started Free"}
                <Icons.ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#10a37f] to-[#1a7f64] flex items-center justify-center">
                <Icons.Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-white">NexusAI</span>
            </div>
            <div className="flex items-center gap-8 text-gray-500 text-sm">
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
              <a href="#" className="hover:text-white transition-colors">Terms</a>
              <a href="#" className="hover:text-white transition-colors">Contact</a>
            </div>
            <p className="text-gray-500 text-sm">
              &copy; {new Date().getFullYear()} NexusAI. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
