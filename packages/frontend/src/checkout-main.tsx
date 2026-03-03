
import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Routes, Route } from 'react-router-dom'
import { I18nProvider } from './i18n'
import './index.css'

// ⚡ CheckoutPublic é EAGER — é a única rota crítica, lazy adicionaria waterfall extra
import CheckoutPublic from './pages/checkout/CheckoutPublic'

// As demais rotas são acessadas raramente a partir do checkout → lazy ok
const Success = lazy(() => import('./pages/Success'))
const OfferPage = lazy(() => import('./pages/checkout/OfferPage'))
const PayPalReturn = lazy(() => import('./pages/checkout/PayPalReturn'))

// Mínimo de providers — apenas o necessário para o checkout funcionar
ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <BrowserRouter>
            <I18nProvider>
                <Suspense fallback={null}>
                    <Routes>
                        {/* Short URL (path principal → mais rápido) */}
                        <Route path="/c/:shortId" element={<CheckoutPublic />} />
                        {/* /checkout/:shortId — segmento único, mesmo comportamento do /c/:shortId */}
                        <Route path="/checkout/:shortId" element={<CheckoutPublic />} />
                        {/* URL longa (legacy / upsell) */}
                        <Route path="/checkout/:productId/:checkoutId" element={<CheckoutPublic />} />
                        {/* Pós-compra */}
                        <Route path="/success" element={<Success />} />
                        {/* Offers (upsell/downsell) */}
                        <Route path="/offer/:offerId" element={<OfferPage />} />
                        {/* Retorno PayPal */}
                        <Route path="/paypal-return" element={<PayPalReturn />} />
                        {/* Qualquer rota desconhecida: não redireciona, só renderiza null  */}
                        <Route path="*" element={null} />
                    </Routes>
                </Suspense>
            </I18nProvider>
        </BrowserRouter>
    </React.StrictMode>,
)
