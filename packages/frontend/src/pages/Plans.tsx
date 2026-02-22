import Header from '@/components/Header'
import { Check, X } from 'lucide-react'
import { useState } from 'react'
import { useI18n } from '@/i18n'

export default function Plans() {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly')
  const { t } = useI18n()

  const plans = [
    {
      name: 'Basic',
      price: { monthly: 97, annual: 970 },
      description: '1 application',
      features: [
        '400 new users per month',
        'Unlimited products',
        'Unlimited content',
        'Unlimited feed posts',
        'Unlimited push notifications',
        'Unlimited community posts',
        'WhatsApp support'
      ],
      extras: '$0.25 per additional user',
      buttonText: 'Select',
      buttonStyle: 'border-2 border-[#252941] text-gray-300 hover:border-gray-400'
    },
    {
      name: 'Starter',
      price: { monthly: 197, annual: 1970 },
      description: '3 applications',
      features: [
        '1000 new users per month',
        'Unlimited products',
        'Unlimited content',
        'Unlimited feed posts',
        'Unlimited push notifications',
        'Unlimited community posts',
        'WhatsApp support'
      ],
      extras: '$0.25 per additional user',
      buttonText: 'Current Plan',
      buttonStyle: 'bg-green-500 text-white',
      recommended: true,
      current: true
    },
    {
      name: 'Professional',
      price: { monthly: 397, annual: 3970 },
      description: '6 applications',
      features: [
        '3000 new users per month',
        'Unlimited products',
        'Unlimited content',
        'Unlimited feed posts',
        'Unlimited push notifications',
        'Unlimited community posts',
        'WhatsApp support'
      ],
      extras: '$0.25 per additional user',
      buttonText: 'Select',
      buttonStyle: 'border-2 border-[#252941] text-gray-300 hover:border-gray-400'
    },
    {
      name: 'Business',
      price: { monthly: 797, annual: 7970 },
      description: '12 applications',
      features: [
        '8000 new users per month',
        'Unlimited products',
        'Unlimited content',
        'Unlimited feed posts',
        'Unlimited push notifications',
        'Unlimited community posts',
        'WhatsApp support',
        'Personalized consulting'
      ],
      extras: '$0.25 per additional user',
      buttonText: 'Select',
      buttonStyle: 'border-2 border-[#252941] text-gray-300 hover:border-gray-400'
    },
  ]

  const getPrice = (plan: any) => {
    return billingPeriod === 'monthly' ? plan.price.monthly : plan.price.annual
  }

  const getPriceText = (plan: any) => {
    const price = getPrice(plan)
    return billingPeriod === 'monthly' ? `$${price}.00` : `$${price}.00`
  }

  const getPeriodText = () => {
    return billingPeriod === 'monthly' ? t('plans.mo') : t('plans.yr')
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f1117] transition-colors duration-200">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Header Section */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-100 mb-4">{t('plans.title')}</h1>
          <p className="text-gray-600 mb-6">{t('plans.current_plan')} <span className="font-semibold">Starter</span></p>

          {/* Progress Bar */}
          <div className="flex items-center justify-center space-x-4 mb-6">
            <div className="text-sm text-gray-600">2/3</div>
            <div className="flex-1 max-w-md bg-gray-200 rounded-full h-2">
              <div className="bg-blue-500/100 h-2 rounded-full" style={{ width: '67%' }}></div>
            </div>
            <div className="text-sm text-gray-600">{t('plans.users')}</div>
            <div className="flex-1 max-w-md bg-gray-200 rounded-full h-2">
              <div className="bg-blue-500/100 h-2 rounded-full" style={{ width: '33%' }}></div>
            </div>
            <div className="text-sm text-gray-600">33/100</div>
          </div>

          <p className="text-sm text-gray-600 mb-4">
            {t('plans.subscribed_as')} <span className="text-blue-400">tudocaki@hotmail.com</span>
          </p>

          {/* Billing Period Toggle */}
          <div className="flex items-center justify-center space-x-4 mb-8">
            <button
              onClick={() => setBillingPeriod('monthly')}
              className={`px-4 py-2 rounded-lg font-medium ${billingPeriod === 'monthly'
                ? 'bg-blue-500/100 text-white'
                : 'bg-gray-200 text-gray-300 hover:bg-gray-300'
                }`}
            >
              {t('plans.monthly')}
            </button>
            <button
              onClick={() => setBillingPeriod('annual')}
              className={`px-4 py-2 rounded-lg font-medium ${billingPeriod === 'annual'
                ? 'bg-blue-500/100 text-white'
                : 'bg-gray-200 text-gray-300 hover:bg-gray-300'
                }`}
            >
              {t('plans.annual')}
            </button>
          </div>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl p-6 shadow-xl shadow-black/10 relative ${plan.current
                ? 'bg-[#1a1d2e] border-2 border-green-500'
                : 'bg-[#1a1d2e] border border-[#1e2139]'
                }`}
            >
              {plan.recommended && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                    {t('plans.most_popular')}
                  </span>
                </div>
              )}

              <div className="text-center">
                <h3 className="text-xl font-bold text-gray-100 mb-2">{plan.name}</h3>
                <div className="mb-4">
                  <span className="text-3xl font-bold text-gray-100">{getPriceText(plan)}</span>
                  <span className="text-gray-600">{getPeriodText()}</span>
                </div>
                <p className="text-sm text-gray-600 mb-6">{plan.description}</p>

                <button
                  className={`w-full py-3 rounded-lg font-semibold transition-colors ${plan.buttonStyle}`}
                  disabled={plan.current}
                >
                  {plan.buttonText}
                </button>
              </div>

              <ul className="mt-6 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm">
                    <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-300">{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-4 pt-4 border-t border-[#1e2139]">
                <p className="text-xs text-gray-500">{plan.extras}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Extra Users Notice */}
        <div className="bg-blue-500/10 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 bg-blue-500/100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-white text-xs font-bold">i</span>
            </div>
            <div>
              <h4 className="font-semibold text-blue-900 mb-1">{t('plans.extra_users')}</h4>
              <p className="text-sm text-blue-700">
                {t('plans.extra_users_desc')}
                <a href="#" className="underline hover:no-underline ml-1">{t('plans.learn_more')}</a>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
