'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'

// Icons
const Icons = {
  Sparkles: ({ className = "w-6 h-6" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  ),
  Check: ({ className = "w-5 h-5" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  ArrowLeft: ({ className = "w-5 h-5" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
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
  Zap: ({ className = "w-6 h-6" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  Users: ({ className = "w-6 h-6" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
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
    icon: Icons.Zap,
    color: 'gray',
    features: [
      { text: '100 chat messages / month', included: true },
      { text: '10 image generations / month', included: true },
      { text: 'Basic AI models (Llama 3)', included: true },
      { text: 'Email support', included: true },
      { text: 'Community access', included: true },
      { text: 'API access', included: false },
      { text: 'Priority support', included: false },
      { text: 'Team collaboration', included: false },
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
    icon: Icons.Sparkles,
    color: 'emerald',
    features: [
      { text: '2,000 chat messages / month', included: true },
      { text: '200 image generations / month', included: true },
      { text: 'Advanced AI models (GPT-4, Claude)', included: true },
      { text: 'Priority support (24h response)', included: true },
      { text: 'API access', included: true },
      { text: 'Export conversation history', included: true },
      { text: 'Custom AI personas', included: true },
      { text: 'Team collaboration', included: false },
    ],
    usageRates: [
      { label: 'Extra chat messages', rate: '$0.002', unit: '/message' },
      { label: 'Extra image generations', rate: '$0.02', unit: '/image' },
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
    icon: Icons.Users,
    color: 'purple',
    features: [
      { text: '10,000 chat messages / month', included: true },
      { text: '1,000 image generations / month', included: true },
      { text: 'All AI models + early access', included: true },
      { text: 'Dedicated account manager', included: true },
      { text: 'Team collaboration (up to 10)', included: true },
      { text: 'Admin dashboard & analytics', included: true },
      { text: 'Custom integrations', included: true },
      { text: 'SLA guarantee (99.9%)', included: true },
    ],
    usageRates: [
      { label: 'Extra chat messages', rate: '$0.001', unit: '/message' },
      { label: 'Extra image generations', rate: '$0.015', unit: '/image' },
    ],
    limits: {
      chatMessages: 10000,
      imageGenerations: 1000,
    },
    cta: 'Contact Sales',
    ctaLink: '/auth/signup?plan=team',
  },
]

const comparisonFeatures = [
  { name: 'Chat Messages', starter: '100/mo', pro: '2,000/mo', team: '10,000/mo' },
  { name: 'Image Generations', starter: '10/mo', pro: '200/mo', team: '1,000/mo' },
  { name: 'AI Models', starter: 'Basic', pro: 'Advanced', team: 'All + Early Access' },
  { name: 'Response Time', starter: '24-48h', pro: '24h', team: '4h' },
  { name: 'API Access', starter: false, pro: true, team: true },
  { name: 'Team Members', starter: '1', pro: '1', team: 'Up to 10' },
  { name: 'Custom Personas', starter: false, pro: true, team: true },
  { name: 'Analytics Dashboard', starter: false, pro: false, team: true },
  { name: 'SLA Guarantee', starter: false, pro: false, team: '99.9%' },
]

const faqs = [
  {
    question: 'How does usage-based pricing work?',
    answer: 'Each plan includes a base amount of messages and image generations. If you exceed your limits, you only pay for what you use beyond the included amount. This is billed at the end of each month based on your actual usage.',
  },
  {
    question: 'Can I upgrade or downgrade anytime?',
    answer: 'Yes! You can change your plan at any time. When upgrading, you get immediate access to new features and your new limits apply right away. When downgrading, the change takes effect at the end of your billing cycle.',
  },
  {
    question: 'What happens if I exceed my limits?',
    answer: 'Your service continues uninterrupted. We simply charge the per-use rate for anything beyond your included limits. You can set spending caps in your dashboard to control costs.',
  },
  {
    question: 'Is there a free trial for paid plans?',
    answer: 'Yes! Pro and Team plans come with a 14-day free trial. No credit card required to start - you only enter payment info when you decide to continue after the trial.',
  },
  {
    question: 'What payment methods do you accept?',
    answer: 'We accept all major credit cards (Visa, Mastercard, American Express) and can arrange invoicing for Team plans. Billing is handled securely through UnitPay.',
  },
  {
    question: 'Do you offer enterprise or custom plans?',
    answer: 'Yes! For organizations with specific needs, we offer custom enterprise plans with dedicated infrastructure, custom SLAs, volume pricing, and specialized support. Contact our sales team to discuss.',
  },
]

export default function PricingPage() {
  const { user } = useAuth()
  const [billingPeriod, setBillingPeriod] = useState('monthly')
  const [openFaq, setOpenFaq] = useState(null)

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#10a37f] to-[#1a7f64] flex items-center justify-center">
                <Icons.Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">NexusAI</span>
            </Link>

            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
                <Icons.ArrowLeft className="w-4 h-4" />
                <span>Back to Home</span>
              </Link>
              {user ? (
                <Link
                  href="/dashboard"
                  className="px-4 py-2 bg-gradient-to-r from-[#10a37f] to-[#1a7f64] text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
                >
                  Dashboard
                </Link>
              ) : (
                <Link
                  href="/auth/signup"
                  className="px-4 py-2 bg-gradient-to-r from-[#10a37f] to-[#1a7f64] text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
                >
                  Get Started
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Simple, transparent pricing
          </h1>
          <p className="text-xl text-gray-400 mb-8">
            Start free, scale as you grow. Only pay for what you use beyond your plan limits.
          </p>

          {/* Billing Toggle */}
          <div className="inline-flex items-center gap-4 p-1.5 bg-[#1a1a1a] rounded-xl border border-white/5">
            <button
              onClick={() => setBillingPeriod('monthly')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                billingPeriod === 'monthly'
                  ? 'bg-[#10a37f] text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingPeriod('annual')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                billingPeriod === 'annual'
                  ? 'bg-[#10a37f] text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Annual
              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-xs">Save 20%</span>
            </button>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {pricingPlans.map((plan, index) => {
              const displayPrice = billingPeriod === 'annual' && plan.price > 0
                ? Math.round(plan.price * 0.8)
                : plan.price

              return (
                <div
                  key={index}
                  className={`relative p-8 rounded-2xl border transition-all duration-300 ${
                    plan.highlight
                      ? 'bg-gradient-to-b from-[#10a37f]/10 to-transparent border-[#10a37f]/50 scale-105 shadow-xl shadow-[#10a37f]/10'
                      : 'bg-[#1a1a1a] border-white/5 hover:border-white/20'
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-[#10a37f] to-emerald-400 rounded-full text-sm font-medium text-white">
                      Most Popular
                    </div>
                  )}

                  {/* Plan Header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      plan.highlight ? 'bg-[#10a37f]/20' : 'bg-white/5'
                    }`}>
                      <plan.icon className={`w-5 h-5 ${plan.highlight ? 'text-[#10a37f]' : 'text-gray-400'}`} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                      <p className="text-sm text-gray-400">{plan.description}</p>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-5xl font-bold text-white">
                        {displayPrice === 0 ? 'Free' : `$${displayPrice}`}
                      </span>
                      {displayPrice > 0 && (
                        <span className="text-gray-400">/month</span>
                      )}
                    </div>
                    {billingPeriod === 'annual' && plan.price > 0 && (
                      <p className="text-sm text-emerald-400 mt-1">
                        Billed ${displayPrice * 12}/year (save ${plan.price * 12 - displayPrice * 12})
                      </p>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-start gap-3">
                        {feature.included ? (
                          <Icons.Check className="w-5 h-5 text-[#10a37f] flex-shrink-0 mt-0.5" />
                        ) : (
                          <span className="w-5 h-5 flex items-center justify-center text-gray-600 flex-shrink-0">—</span>
                        )}
                        <span className={feature.included ? 'text-gray-300' : 'text-gray-600'}>{feature.text}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Usage Rates */}
                  {plan.usageRates && (
                    <div className="mb-8 p-4 bg-black/20 rounded-xl border border-white/5">
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Overage Pricing</p>
                      <div className="space-y-2">
                        {plan.usageRates.map((rate, rateIndex) => (
                          <div key={rateIndex} className="flex justify-between text-sm">
                            <span className="text-gray-400">{rate.label}</span>
                            <span className="text-[#10a37f] font-mono">{rate.rate}<span className="text-gray-600">{rate.unit}</span></span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Feature Comparison Table */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-[#0f0f0f]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-12">
            Compare plans
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-4 px-4 text-gray-400 font-medium">Feature</th>
                  <th className="text-center py-4 px-4 text-white font-semibold">Starter</th>
                  <th className="text-center py-4 px-4 text-[#10a37f] font-semibold">Pro</th>
                  <th className="text-center py-4 px-4 text-white font-semibold">Team</th>
                </tr>
              </thead>
              <tbody>
                {comparisonFeatures.map((feature, index) => (
                  <tr key={index} className="border-b border-white/5">
                    <td className="py-4 px-4 text-gray-300">{feature.name}</td>
                    <td className="py-4 px-4 text-center">
                      {typeof feature.starter === 'boolean' ? (
                        feature.starter ? (
                          <Icons.Check className="w-5 h-5 text-[#10a37f] mx-auto" />
                        ) : (
                          <span className="text-gray-600">—</span>
                        )
                      ) : (
                        <span className="text-gray-400">{feature.starter}</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-center bg-[#10a37f]/5">
                      {typeof feature.pro === 'boolean' ? (
                        feature.pro ? (
                          <Icons.Check className="w-5 h-5 text-[#10a37f] mx-auto" />
                        ) : (
                          <span className="text-gray-600">—</span>
                        )
                      ) : (
                        <span className="text-[#10a37f]">{feature.pro}</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-center">
                      {typeof feature.team === 'boolean' ? (
                        feature.team ? (
                          <Icons.Check className="w-5 h-5 text-[#10a37f] mx-auto" />
                        ) : (
                          <span className="text-gray-600">—</span>
                        )
                      ) : (
                        <span className="text-gray-400">{feature.team}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-12">
            Frequently asked questions
          </h2>

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
          <div className="p-12 rounded-3xl bg-gradient-to-br from-[#10a37f]/20 via-[#1a1a1a] to-purple-500/10 border border-white/10">
            <h2 className="text-3xl font-bold text-white mb-4">
              Still have questions?
            </h2>
            <p className="text-gray-400 mb-8 max-w-xl mx-auto">
              Our team is here to help. Contact us for custom enterprise solutions or any questions about our plans.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/auth/signup"
                className="px-8 py-3 bg-gradient-to-r from-[#10a37f] to-emerald-400 text-white rounded-xl font-semibold hover:opacity-90 transition-opacity"
              >
                Start Free Trial
              </Link>
              <a
                href="mailto:sales@nexusai.com"
                className="px-8 py-3 bg-white/5 border border-white/10 text-white rounded-xl font-semibold hover:bg-white/10 transition-colors"
              >
                Contact Sales
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 sm:px-6 lg:px-8 border-t border-white/5">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-gray-500 text-sm">
            &copy; {new Date().getFullYear()} NexusAI. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
