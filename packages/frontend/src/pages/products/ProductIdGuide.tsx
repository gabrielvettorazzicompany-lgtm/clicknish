import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Header from '@/components/Header'
import { useI18n } from '@/i18n'

function ProductIdGuide() {
  const { t } = useI18n()

  return (
    <div className="min-h-screen bg-[#0f1117]">
      <Header />

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-12">
          <Link to="/dashboard" className="p-2 hover:bg-[#1a1d2e] rounded-lg transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-100">{t('product_pages.id_guide_title')}</h1>
            <p className="text-gray-600 mt-2">
              Complete guide to locate product IDs on different platforms
            </p>
          </div>
        </div>

        {/* Platforms Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Hotmart */}
          <div className="bg-[#1a1d2e] rounded-xl shadow-xl shadow-black/10 shadow-black/5 border border-[#1e2139] overflow-hidden hover:shadow-md transition-shadow">
            <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white p-6">
              <h3 className="text-xl font-bold">Hotmart</h3>
            </div>
            <div className="p-6">
              <ol className="space-y-3 text-gray-300">
                <li className="flex gap-3">
                  <span className="font-bold text-blue-400 min-w-[24px] flex-shrink-0">1.</span>
                  <span>In the left menu, click on "Products" and then "My Products"</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-blue-400 min-w-[24px] flex-shrink-0">2.</span>
                  <span>Select your product</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-blue-400 min-w-[24px] flex-shrink-0">3.</span>
                  <span>The product ID is in the URL, corresponding to all digits after "manager/"</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-blue-400 min-w-[24px] flex-shrink-0">4.</span>
                  <span>Copy this number and use it in Clicknich</span>
                </li>
              </ol>

              <div className="mt-6 bg-blue-500/10 rounded-lg p-4">
                <div className="flex items-center gap-2 text-blue-700 mb-2">
                  <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">!</span>
                  </div>
                  <span className="font-semibold">Tip</span>
                </div>
                <p className="text-blue-700 text-sm">
                  Hotmart ID is always numeric. Copy only the numbers.
                </p>
              </div>
            </div>
          </div>

          {/* Kiwify */}
          <div className="bg-[#1a1d2e] rounded-xl shadow-xl shadow-black/10 shadow-black/5 border border-[#1e2139] overflow-hidden hover:shadow-md transition-shadow">
            <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white p-6">
              <h3 className="text-xl font-bold">Kiwify</h3>
            </div>
            <div className="p-6">
              <ol className="space-y-3 text-gray-300">
                <li className="flex gap-3">
                  <span className="font-bold text-blue-400 min-w-[24px] flex-shrink-0">1.</span>
                  <span>In the left menu, click on "Products"</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-blue-400 min-w-[24px] flex-shrink-0">2.</span>
                  <span>Select your product</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-blue-400 min-w-[24px] flex-shrink-0">3.</span>
                  <span>The product ID is in the URL, corresponding to all digits after "sell/"</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-blue-400 min-w-[24px] flex-shrink-0">4.</span>
                  <span>Copy this code and use it in Clicknish</span>
                </li>
              </ol>

              <div className="mt-6 bg-blue-500/10 rounded-lg p-4">
                <div className="flex items-center gap-2 text-blue-700 mb-2">
                  <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">!</span>
                  </div>
                  <span className="font-semibold">Tip</span>
                </div>
                <p className="text-blue-700 text-sm">
                  Kiwify ID can contain letters and numbers. Copy the code exactly as shown.
                </p>
              </div>
            </div>
          </div>

          {/* Last Link */}
          <div className="bg-[#1a1d2e] rounded-xl shadow-xl shadow-black/10 shadow-black/5 border border-[#1e2139] overflow-hidden hover:shadow-md transition-shadow">
            <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white p-6">
              <h3 className="text-xl font-bold">Last Link</h3>
            </div>
            <div className="p-6">
              <ol className="space-y-3 text-gray-300">
                <li className="flex gap-3">
                  <span className="font-bold text-blue-400 min-w-[24px] flex-shrink-0">1.</span>
                  <span>In the left menu, click on "Products"</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-blue-400 min-w-[24px] flex-shrink-0">2.</span>
                  <span>Click on the desired product</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-blue-400 min-w-[24px] flex-shrink-0">3.</span>
                  <span>Click on "Integration"</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-blue-400 min-w-[24px] flex-shrink-0">4.</span>
                  <span>The ID corresponds to the characters after "settings/" in the URL until the first "?"</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-blue-400 min-w-[24px] flex-shrink-0">5.</span>
                  <span>Copy this code and use it in Clicknish</span>
                </li>
              </ol>

              <div className="mt-6 bg-green-50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-700 mb-2">
                  <div className="w-5 h-5 bg-green-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">📋</span>
                  </div>
                  <span className="font-semibold">Example</span>
                </div>
                <div className="space-y-2">
                  <p className="text-green-700 text-sm">In a URL like:</p>
                  <code className="bg-green-100 text-green-900 px-2 py-1 rounded text-xs block">
                    ...settings/1f900f0b-c3db-4ad4-93b7-6c2b998bda7f/...
                  </code>
                  <p className="text-green-700 text-sm">
                    the ID would be: <strong>1f900f0b-c3db-4ad4-93b7-6c2b998bda7f</strong>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Kirvano */}
          <div className="bg-[#1a1d2e] rounded-xl shadow-xl shadow-black/10 shadow-black/5 border border-[#1e2139] overflow-hidden hover:shadow-md transition-shadow">
            <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white p-6">
              <h3 className="text-xl font-bold">Kirvano</h3>
            </div>
            <div className="p-6">
              <ol className="space-y-3 text-gray-300">
                <li className="flex gap-3">
                  <span className="font-bold text-blue-400 min-w-[24px] flex-shrink-0">1.</span>
                  <span>In the left column on the Kirvano website, click on "Products"</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-blue-400 min-w-[24px] flex-shrink-0">2.</span>
                  <span>Click on "Products"</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-blue-400 min-w-[24px] flex-shrink-0">3.</span>
                  <span>Now click on the product you want to get the ID for</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-blue-400 min-w-[24px] flex-shrink-0">4.</span>
                  <span>The ID is the characters after "products/" until the first "?" in the URL</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-blue-400 min-w-[24px] flex-shrink-0">5.</span>
                  <span>Copy this code and use it in Clicknish</span>
                </li>
              </ol>

              <div className="mt-6 bg-green-50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-700 mb-2">
                  <div className="w-5 h-5 bg-green-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">📋</span>
                  </div>
                  <span className="font-semibold">Example</span>
                </div>
                <div className="space-y-2">
                  <p className="text-green-700 text-sm">In a URL like:</p>
                  <code className="bg-green-100 text-green-900 px-2 py-1 rounded text-xs block">
                    ...products/9f502dd8e-06e1-4dd2-ae24-6f98dd94ff62/...
                  </code>
                  <p className="text-green-700 text-sm">
                    the ID would be: <strong>9f502dd8e-06e1-4dd2-ae24-6f98dd94ff62</strong>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Perfect Pay */}
          <div className="bg-[#1a1d2e] rounded-xl shadow-xl shadow-black/10 shadow-black/5 border border-[#1e2139] overflow-hidden hover:shadow-md transition-shadow">
            <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white p-6">
              <h3 className="text-xl font-bold">Perfect Pay</h3>
            </div>
            <div className="p-6">
              <ol className="space-y-3 text-gray-300">
                <li className="flex gap-3">
                  <span className="font-bold text-blue-400 min-w-[24px] flex-shrink-0">1.</span>
                  <span>In the left menu, click on "Products" and then "My Products"</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-blue-400 min-w-[24px] flex-shrink-0">2.</span>
                  <span>Select your product</span>
                </li>
              </ol>
            </div>
          </div>

          {/* Ticto */}
          <div className="bg-[#1a1d2e] rounded-xl shadow-xl shadow-black/10 shadow-black/5 border border-[#1e2139] overflow-hidden hover:shadow-md transition-shadow">
            <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white p-6">
              <h3 className="text-xl font-bold">Ticto</h3>
            </div>
            <div className="p-6">
              <ol className="space-y-3 text-gray-300">
                <li className="flex gap-3">
                  <span className="font-bold text-blue-400 min-w-[24px] flex-shrink-0">1.</span>
                  <span>In the left column on the Ticto website, click on "My Products"</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-blue-400 min-w-[24px] flex-shrink-0">2.</span>
                  <span>In your product list, you will see the ID right below the product name</span>
                </li>
              </ol>
            </div>
          </div>

        </div>

        {/* Footer Section */}
        <div className="mt-12 bg-[#0f1117] rounded-xl p-6 border border-[#1e2139]">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-white text-sm font-bold">!</span>
            </div>
            <div>
              <h3 className="font-semibold text-gray-100 mb-2">Important</h3>
              <p className="text-gray-300 text-sm leading-relaxed">
                If you cannot find the ID following these instructions, contact the specific platform's support.
                Each platform may have updates to its interface that can change the location of IDs.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProductIdGuide