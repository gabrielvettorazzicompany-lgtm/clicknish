import { useState } from 'react'
import { ArrowRight, Check, User, ShoppingCart, Eye, Lock, Unlock } from 'lucide-react'
import { useI18n } from '@/i18n'
import Header from '@/components/Header'
import { Link } from 'react-router-dom'

export default function CustomerFlowDemo() {
  const { t } = useI18n()
  const [currentStep, setCurrentStep] = useState(1)
  const [demoUser, setDemoUser] = useState({
    email: 'cliente@exemplo.com',
    hasPurchased: false,
    productAccess: false
  })

  const steps = [
    {
      id: 1,
      title: 'Customer makes a purchase',
      description: 'Customer buys a product through your sales platform (Hotmart, Kiwify, etc.)',
      icon: ShoppingCart,
      color: 'bg-green-500'
    },
    {
      id: 2,
      title: 'Receives access link',
      description: 'Customer receives a direct link to access the purchased product',
      icon: ArrowRight,
      color: 'bg-blue-500/100'
    },
    {
      id: 3,
      title: 'Login/Register',
      description: 'Customer clicks the link and logs in or registers on the access page',
      icon: User,
      color: 'bg-blue-500'
    },
    {
      id: 4,
      title: 'Accesses the content',
      description: 'System validates the purchase and grants access to the product layout',
      icon: Unlock,
      color: 'bg-orange-500'
    }
  ]

  const simulatePurchase = () => {
    setDemoUser({ ...demoUser, hasPurchased: true })
    setCurrentStep(2)
  }

  const simulateAccess = () => {
    setDemoUser({ ...demoUser, productAccess: true })
    setCurrentStep(4)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-[#252941]/30">
      <Header />

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-4 mb-4">
            <Link
              to="/dashboard"
              className="text-gray-600 hover:text-gray-100 font-medium"
            >
              ← Dashboard
            </Link>
          </div>

          <h1 className="text-4xl font-bold text-gray-100 mb-4">
            {t('customer_flow.title')}
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Interactive demonstration of the complete flow from purchase to product access
          </p>
        </div>

        {/* Flow Steps */}
        <div className="grid md:grid-cols-4 gap-6 mb-12">
          {steps.map((step, index) => {
            const Icon = step.icon
            const isActive = currentStep >= step.id
            const isCurrent = currentStep === step.id

            return (
              <div key={step.id} className="text-center">
                <div className="relative mb-4">
                  {index < steps.length - 1 && (
                    <div className={`absolute top-6 left-1/2 w-full h-0.5 ${currentStep > step.id ? 'bg-green-500' : 'bg-gray-200'
                      } hidden md:block`} style={{ transform: 'translateX(50%)' }} />
                  )}
                  <div className={`relative z-10 w-12 h-12 mx-auto rounded-full flex items-center justify-center ${isActive ? step.color : 'bg-gray-200'
                    } ${isCurrent ? 'ring-4 ring-blue-200 scale-110' : ''} transition-all duration-300`}>
                    <Icon className={`w-6 h-6 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                  </div>
                </div>
                <h3 className={`font-bold mb-2 ${isActive ? 'text-gray-100' : 'text-gray-400'}`}>
                  {step.title}
                </h3>
                <p className={`text-sm ${isActive ? 'text-gray-600' : 'text-gray-400'}`}>
                  {step.description}
                </p>
              </div>
            )
          })}
        </div>

        {/* Demo Area */}
        <div className="bg-[#1a1d2e] rounded-2xl shadow-xl p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-100 mb-6">{t('customer_flow.demo_title')}</h2>

          {/* Current Step Display */}
          <div className="bg-[#0f1117] rounded-xl p-6 mb-6">
            <div className="flex items-center gap-4 mb-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${steps[currentStep - 1]?.color}`}>
                <span className="text-white font-bold text-sm">{currentStep}</span>
              </div>
              <h3 className="text-xl font-bold text-gray-100">
                {steps[currentStep - 1]?.title}
              </h3>
            </div>
            <p className="text-gray-600 mb-4">
              {steps[currentStep - 1]?.description}
            </p>

            {/* Step-specific content */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="bg-[#1a1d2e] rounded-lg p-4 border-2 border-dashed border-[#1e2139]">
                  <h4 className="font-medium mb-2">Sales Platform Simulation</h4>
                  <div className="flex items-center justify-between mb-3">
                    <span>AI Millionaire Course</span>
                    <span className="font-bold text-green-600">R$ 497,00</span>
                  </div>
                  <button
                    onClick={simulatePurchase}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
                  >
                    Simulate Purchase
                  </button>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Check className="w-5 h-5 text-green-600" />
                    <span className="font-medium text-green-800">Purchase completed successfully!</span>
                  </div>
                  <p className="text-green-700 text-sm mb-3">
                    Customer received an email with the access link:
                  </p>
                  <div className="bg-[#1a1d2e] border border-green-300 rounded p-3">
                    <code className="text-sm text-blue-400">
                      https://seuapp.com/access/curso-ia-milionaria/modulo-completo
                    </code>
                  </div>
                  <button
                    onClick={() => setCurrentStep(3)}
                    className="mt-3 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg font-medium transition-colors"
                  >
                    Customer Clicks the Link
                  </button>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-4">
                <div className="bg-[#1a1d2e] border border-[#1e2139] rounded-lg p-4">
                  <h4 className="font-medium mb-4">Customer Access Page</h4>
                  <div className="grid md:grid-cols-3 gap-4 mb-4">
                    <div className="text-center p-3 border border-[#1e2139] rounded-lg">
                      <User className="w-8 h-8 mx-auto mb-2 text-blue-400" />
                      <h5 className="font-medium text-sm">Email + Password</h5>
                      <p className="text-xs text-gray-600">Complete login</p>
                    </div>
                    <div className="text-center p-3 border border-[#1e2139] rounded-lg">
                      <User className="w-8 h-8 mx-auto mb-2 text-green-600" />
                      <h5 className="font-medium text-sm">Email Only</h5>
                      <p className="text-xs text-gray-600">Quick access</p>
                    </div>
                    <div className="text-center p-3 border border-[#1e2139] rounded-lg">
                      <Lock className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                      <h5 className="font-medium text-sm">Purchase Code</h5>
                      <p className="text-xs text-gray-600">Via unique code</p>
                    </div>
                  </div>
                  <button
                    onClick={simulateAccess}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
                  >
                    Simulate Login
                  </button>
                </div>
              </div>
            )}

            {currentStep === 4 && (
              <div className="space-y-4">
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Unlock className="w-5 h-5 text-orange-600" />
                    <span className="font-medium text-orange-800">Access granted!</span>
                  </div>
                  <p className="text-orange-700 text-sm mb-3">
                    Customer now has access to the product layout with:
                  </p>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="bg-[#1a1d2e] p-3 rounded border border-orange-200">
                      <h6 className="font-medium text-sm mb-1">✅ Product modules</h6>
                      <p className="text-xs text-gray-600">Organized and progressive content</p>
                    </div>
                    <div className="bg-[#1a1d2e] p-3 rounded border border-orange-200">
                      <h6 className="font-medium text-sm mb-1">✅ Exclusive community</h6>
                      <p className="text-xs text-gray-600">Interaction with other clients</p>
                    </div>
                    <div className="bg-[#1a1d2e] p-3 rounded border border-orange-200">
                      <h6 className="font-medium text-sm mb-1">✅ Official feed</h6>
                      <p className="text-xs text-gray-600">Updates and news</p>
                    </div>
                    <div className="bg-[#1a1d2e] p-3 rounded border border-orange-200">
                      <h6 className="font-medium text-sm mb-1">✅ Notifications</h6>
                      <p className="text-xs text-gray-600">Reminders and new content</p>
                    </div>
                  </div>
                  <Link
                    to="/app/demo/product/1"
                    className="inline-block mt-3 bg-orange-600 hover:bg-orange-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
                  >
                    <Eye className="w-4 h-4 inline mr-2" />
                    View Product Layout
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Reset Demo */}
          {currentStep === 4 && (
            <div className="text-center">
              <button
                onClick={() => {
                  setCurrentStep(1)
                  setDemoUser({
                    email: 'client@example.com',
                    hasPurchased: false,
                    productAccess: false
                  })
                }}
                className="bg-gray-600 hover:bg-gray-700 text-white py-2 px-6 rounded-lg font-medium transition-colors"
              >
                Reset Demo
              </button>
            </div>
          )}
        </div>

        {/* Technical Details */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl p-8">
          <h2 className="text-2xl font-bold mb-6">{t('customer_flow.steps')}</h2>

          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-semibold mb-4 text-blue-400">1. Platform Integration</h3>
              <ul className="space-y-2 text-gray-300">
                <li>• Hotmart/Kiwify webhook after purchase</li>
                <li>• Automatic client account creation</li>
                <li>• Personalized link generation</li>
                <li>• Credential email sending</li>
              </ul>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-4 text-green-400">2. Authentication System</h3>
              <ul className="space-y-2 text-gray-300">
                <li>• Email and password validation</li>
                <li>• JWT token system</li>
                <li>• Active purchase verification</li>
                <li>• Route protection by product</li>
              </ul>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-4 text-blue-400">3. Product Layout</h3>
              <ul className="space-y-2 text-gray-300">
                <li>• Modules organized by product</li>
                <li>• Completion progress</li>
                <li>• Responsive mobile-first design</li>
                <li>• Personalized experience</li>
              </ul>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-4 text-orange-400">4. Extra Features</h3>
              <ul className="space-y-2 text-gray-300">
                <li>• Community per product</li>
                <li>• Updates feed</li>
                <li>• Notification system</li>
                <li>• Engagement analytics</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}