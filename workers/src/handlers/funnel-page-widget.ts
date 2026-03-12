// @ts-nocheck
/**
 * Handler: Funnel Page Widget
 * Widget JavaScript para páginas de upsell/downsell em funis
 */

import { createClient } from '../lib/supabase'
import type { Env } from '../index'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

export async function handleFunnelPageWidget(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  try {
    const url = new URL(request.url)
    const funnelId = url.searchParams.get('funnel_id')
    const pageId = url.searchParams.get('page_id')
    const pageType = url.searchParams.get('type') || 'upsell'
    const purchaseId = url.searchParams.get('purchase_id')
    const purchaseToken = url.searchParams.get('token')

    if (!funnelId || !pageId) {
      return new Response('Missing required parameters: funnel_id, page_id', {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/javascript' }
      })
    }

    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

    // Fetch offer for this specific funnel page
    const { data: offers, error } = await supabase
      .from('checkout_offers')
      .select('id, offer_type, product_id, product_type, application_id, original_price, offer_price, discount_percentage, currency, title, description, button_text, one_click_purchase')
      .eq('funnel_id', funnelId)
      .eq('page_id', pageId)
      .eq('offer_type', pageType)
      .eq('is_active', true)
      .order('offer_position', { ascending: true })
      .limit(1)

    if (error) {
      return new Response(`console.error('Error loading offers: ${error.message}');`, {
        headers: { ...corsHeaders, 'Content-Type': 'application/javascript' }
      })
    }

    if (!offers || offers.length === 0) {
      return new Response(`console.log('[Clicknish] No active offers configured for this page');`, {
        headers: { ...corsHeaders, 'Content-Type': 'application/javascript' }
      })
    }

    const offer = offers[0]

    // Fetch product info
    let product: any = null
    let isApplication = false
    let isAppProduct = false
    let parentAppId: string | null = offer.application_id || null

    if (offer.product_id) {
      if (offer.product_type === 'app_product') {
        const { data: appProd } = await supabase
          .from('products')
          .select('id, name, description, application_id')
          .eq('id', offer.product_id)
          .single()

        if (appProd) {
          product = appProd
          isAppProduct = true
          parentAppId = appProd.application_id
        }
      } else {
        const { data: memberArea } = await supabase
          .from('member_areas')
          .select('id, name, description')
          .eq('id', offer.product_id)
          .single()

        if (memberArea) {
          product = memberArea
        } else {
          const { data: app } = await supabase
            .from('applications')
            .select('id, name, description')
            .eq('id', offer.product_id)
            .single()

          if (app) {
            product = app
            isApplication = true
          }
        }
      }
    }

    // Fetch checkout URL for the product
    let checkoutShortUrl: string | null = null
    if (offer.product_id && !offer.one_click_purchase) {
      const checkoutQuery = supabase
        .from('checkouts')
        .select('id')
        .eq('is_default', true)

      if (isAppProduct && parentAppId) {
        checkoutQuery.eq('application_id', parentAppId)
      } else if (isApplication) {
        checkoutQuery.eq('application_id', offer.product_id)
      } else {
        checkoutQuery.eq('member_area_id', offer.product_id)
      }

      const { data: checkout } = await checkoutQuery.single()

      if (checkout) {
        const { data: existingUrl } = await supabase
          .from('checkout_urls')
          .select('id')
          .eq('checkout_id', checkout.id)
          .maybeSingle()

        if (existingUrl) {
          checkoutShortUrl = existingUrl.id
        } else {
          const urlInsert: any = { checkout_id: checkout.id }
          if (isAppProduct && parentAppId) {
            urlInsert.application_id = parentAppId
          } else if (isApplication) {
            urlInsert.application_id = offer.product_id
          } else {
            urlInsert.member_area_id = offer.product_id
          }

          const { data: newUrl } = await supabase
            .from('checkout_urls')
            .insert(urlInsert)
            .select('id')
            .single()

          if (newUrl) {
            checkoutShortUrl = newUrl.id
          }
        }
      }
    }

    // Buscar redirect URLs das settings da página (accept/reject)
    let acceptRedirectUrl: string | null = null
    let rejectRedirectUrl: string | null = null

    const { data: pageData } = await supabase
      .from('funnel_pages')
      .select('settings')
      .eq('id', pageId)
      .maybeSingle()

    if (pageData?.settings) {
      const s = pageData.settings as any

      const resolveFunnelPageUrl = async (targetPageId: string): Promise<string | null> => {
        const { data: targetPage } = await supabase
          .from('funnel_pages')
          .select('external_url, page_type')
          .eq('id', targetPageId)
          .maybeSingle()
        if (!targetPage) return null
        if (targetPage.external_url) return targetPage.external_url
        // Páginas thankyou internas não têm external_url — gera URL interna
        if (targetPage.page_type === 'thankyou') {
          const frontendUrl = env.FRONTEND_URL || 'https://app.clicknich.com'
          return `${frontendUrl}/thankyou/${targetPageId}`
        }
        return null
      }

      if (s.accept_page_id) {
        acceptRedirectUrl = await resolveFunnelPageUrl(s.accept_page_id)
      } else if (s.accept_redirect_url) {
        acceptRedirectUrl = s.accept_redirect_url
      }

      if (s.reject_page_id) {
        rejectRedirectUrl = await resolveFunnelPageUrl(s.reject_page_id)
      } else if (s.reject_redirect_url) {
        rejectRedirectUrl = s.reject_redirect_url
      }
    }

    // Generate widget JavaScript
    const widgetScript = generateWidgetScript(offer, product, pageType, purchaseId, purchaseToken, funnelId, pageId, checkoutShortUrl, acceptRedirectUrl, rejectRedirectUrl, env)

    return new Response(widgetScript, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/javascript',
        'Cache-Control': 'public, max-age=300'
      }
    })

  } catch (error: any) {
    return new Response(`console.error('[Clicknish] Widget error: ${error.message}');`, {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/javascript' }
    })
  }
}

function generateWidgetScript(
  offer: any,
  product: any,
  pageType: string,
  purchaseId: string | null,
  purchaseToken: string | null,
  funnelId: string,
  pageId: string,
  checkoutShortUrl: string | null,
  acceptRedirectUrl: string | null,
  rejectRedirectUrl: string | null,
  env: Env
): string {
  const frontendUrl = env.FRONTEND_URL || 'https://app.clicknich.com'
  const apiUrl = 'https://api.clicknich.com/api'

  const typeEmojis: Record<string, string> = {
    upsell: '🚀',
    downsell: '💎',
    thankyou: '🎁'
  }
  const typeEmoji = typeEmojis[pageType] || '✨'

  // Escape </script> para não quebrar a tag ao embutir JSON
  const safeJSON = (obj: any): string => JSON.stringify(obj).replace(/<\//g, '<\\/')

  return `
(function() {
  'use strict';
  
  console.log('[Clicknish] Widget initialized for ${pageType}');
  
  const OFFER = ${safeJSON(offer)};
  const PRODUCT = ${safeJSON(product)};

  // Sanitiza strings antes de injetar no HTML (prevenção de XSS)
  function esc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  const PAGE_TYPE = '${pageType}';
  const FUNNEL_ID = '${funnelId}';
  const PAGE_ID = '${pageId}';
  const PURCHASE_ID = '${purchaseId || ''}';
  const PURCHASE_TOKEN = '${purchaseToken || ''}';
  const ONE_CLICK = ${offer.one_click_purchase ? 'true' : 'false'};
  const CHECKOUT_URL = '${checkoutShortUrl ? `${frontendUrl}/checkout/${checkoutShortUrl}` : ''}';
  const ACCEPT_REDIRECT_URL = '${acceptRedirectUrl || ''}';
  const REJECT_REDIRECT_URL = '${rejectRedirectUrl || ''}';
  
  const storageKey = 'clicknish_offer_' + PAGE_ID;
  if (sessionStorage.getItem(storageKey)) {
    console.log('[Clicknish] Offer already shown in this session');
    return;
  }
  
  if (!PURCHASE_ID) {
    console.log('[Clicknish] No purchase context - widget will not display');
    return;
  }
  
  function formatPrice(price, currency) {
    const symbols = { BRL: 'R$', USD: '$', EUR: '€' };
    const symbol = symbols[currency] || currency;
    return symbol + ' ' + parseFloat(price).toFixed(2).replace('.', ',');
  }
  
  const discountPercentage = OFFER.discount_percentage || 
    Math.round(((OFFER.original_price - OFFER.offer_price) / OFFER.original_price) * 100);
  
  const typeEmoji = '${typeEmoji}';
  
  const modalHTML = \`
    <div id="huskyapp-offer-modal" style="
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.85);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      animation: fadeIn 0.3s ease-out;
    ">
      <style>
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        #huskyapp-offer-content { animation: slideUp 0.4s ease-out; }
      </style>
      
      <div id="huskyapp-offer-content" style="
        background: linear-gradient(135deg, #1a1d2e 0%, #252941 100%);
        border-radius: 20px;
        max-width: 650px;
        width: 90%;
        max-height: 90vh;
        overflow-y: auto;
        position: relative;
        box-shadow: 0 25px 50px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255,255,255,0.1);
      ">
        <button id="huskyapp-offer-close" style="
          position: absolute;
          top: 20px;
          right: 20px;
          background: rgba(255, 255, 255, 0.1);
          border: none;
          color: #fff;
          font-size: 24px;
          cursor: pointer;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          z-index: 10;
        ">×</button>
        
        <div style="padding: 50px 40px 40px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="
              display: inline-block;
              background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
              color: white;
              padding: 10px 24px;
              border-radius: 30px;
              font-size: 14px;
              font-weight: 700;
            ">\${typeEmoji} Special Offer</div>
          </div>
          
          <h2 style="color: #fff; font-size: 32px; font-weight: 800; margin: 0 0 16px 0; text-align: center;">
            \${esc(OFFER.title || PRODUCT.name)}
          </h2>
          
          <p style="color: #9ca3af; font-size: 17px; margin: 0 0 32px 0; text-align: center;">
            \${esc(OFFER.description || PRODUCT.description || 'Take advantage of this exclusive limited-time offer')}
          </p>
          
          <div style="
            background: linear-gradient(135deg, #0f1117 0%, #1a1d2e 100%);
            border: 2px solid rgba(59, 130, 246, 0.3);
            border-radius: 16px;
            padding: 32px;
            margin-bottom: 28px;
            text-align: center;
          ">
            \${OFFER.original_price > OFFER.offer_price ? \`<div style="color: #6b7280; font-size: 16px; text-decoration: line-through; margin-bottom: 8px;">Was: \${formatPrice(OFFER.original_price, OFFER.currency)}</div>\` : ''}
            
            <div style="color: #3b82f6; font-size: 56px; font-weight: 800; line-height: 1; margin-bottom: 12px;">
              \${formatPrice(OFFER.offer_price, OFFER.currency)}
            </div>
            
            \${discountPercentage > 0 ? \`<div style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 8px 20px; border-radius: 24px; font-size: 15px; font-weight: 700;">\${discountPercentage}% OFF</div>\` : ''}
          </div>
          
          <button id="huskyapp-offer-accept" style="
            width: 100%;
            background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
            color: white;
            border: none;
            padding: 20px 24px;
            border-radius: 14px;
            font-size: 18px;
            font-weight: 700;
            cursor: pointer;
            margin-bottom: 14px;
          ">\${esc(OFFER.button_text || 'Yes, I Want It!')}</button>
          
          <button id="huskyapp-offer-decline" style="
            width: 100%;
            background: transparent;
            color: #9ca3af;
            border: 2px solid rgba(156, 163, 175, 0.3);
            padding: 14px 24px;
            border-radius: 14px;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
          ">No, thanks</button>
          
          <div style="text-align: center; margin-top: 24px; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.1);">
            <p style="color: #6b7280; font-size: 13px; margin: 0;">🔒 100% Secure Payment | ✓ 7-day Guarantee</p>
          </div>
        </div>
      </div>
    </div>
  \`;
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  const modal = document.getElementById('huskyapp-offer-modal');
  const closeBtn = document.getElementById('huskyapp-offer-close');
  const acceptBtn = document.getElementById('huskyapp-offer-accept');
  const declineBtn = document.getElementById('huskyapp-offer-decline');
  
  function closeModal() {
    if (modal) {
      modal.style.opacity = '0';
      setTimeout(() => modal.remove(), 300);
      sessionStorage.setItem(storageKey, 'true');
    }
  }
  
  async function acceptOffer() {
    acceptBtn.textContent = 'Processing...';
    acceptBtn.disabled = true;
    
    fetch('${apiUrl}/offer-analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offer_id: OFFER.id, event: 'accept', purchase_id: PURCHASE_ID })
    }).catch(console.error);
    
    if (ONE_CLICK) {
      try {
        const response = await fetch('${apiUrl}/process-upsell', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ purchase_id: PURCHASE_ID, token: PURCHASE_TOKEN || undefined, offer_id: OFFER.id })
        });
        
        const result = await response.json();
        
        if (result.success) {
          acceptBtn.textContent = '✓ Purchase completed!';
          acceptBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
          setTimeout(() => {
            if (ACCEPT_REDIRECT_URL) {
              const sep = ACCEPT_REDIRECT_URL.includes('?') ? '&' : '?';
              window.location.href = ACCEPT_REDIRECT_URL + sep + 'purchase_id=' + PURCHASE_ID;
            } else {
              closeModal();
            }
          }, 1500);
        } else {
          throw new Error(result.error || 'Payment failed');
        }
      } catch (payError) {
        acceptBtn.textContent = 'Error - Try again';
        acceptBtn.disabled = false;
      }
    } else if (CHECKOUT_URL) {
      window.location.href = CHECKOUT_URL + '?offer_id=' + OFFER.id + '&purchase_id=' + PURCHASE_ID + '&funnel_id=' + FUNNEL_ID;
    }
  }
  
  function declineOffer() {
    fetch('${apiUrl}/offer-analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offer_id: OFFER.id, event: 'decline', purchase_id: PURCHASE_ID })
    }).catch(console.error);
    if (REJECT_REDIRECT_URL) {
      const sep = REJECT_REDIRECT_URL.includes('?') ? '&' : '?';
      window.location.href = REJECT_REDIRECT_URL + sep + 'purchase_id=' + PURCHASE_ID;
    } else {
      closeModal();
    }
  }
  
  closeBtn.addEventListener('click', closeModal);
  declineBtn.addEventListener('click', declineOffer);
  acceptBtn.addEventListener('click', acceptOffer);
  modal.addEventListener('click', function(e) { if (e.target === modal) declineOffer(); });
  
  fetch('${apiUrl}/offer-analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ offer_id: OFFER.id, event: 'view', purchase_id: PURCHASE_ID })
  }).catch(console.error);
  
})();
`
}
