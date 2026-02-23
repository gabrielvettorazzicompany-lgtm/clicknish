import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const funnelId = url.searchParams.get('funnel_id')
    const pageId = url.searchParams.get('page_id')
    const pageType = url.searchParams.get('type') || 'upsell'
    const purchaseId = url.searchParams.get('purchase_id')

    // Validation
    if (!funnelId || !pageId) {
      return new Response('Missing required parameters: funnel_id, page_id', {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/javascript' }
      })
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') as string
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Fetch offer for this specific funnel page (using page_id filter)
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
      console.error('Error fetching offers:', error)
      return new Response(`console.error('Error loading offers: ${error.message}');`, {
        headers: { ...corsHeaders, 'Content-Type': 'application/javascript' }
      })
    }

    // If no offers found, return early
    if (!offers || offers.length === 0) {
      return new Response(`console.log('[Clicknish] No active offers configured for this page');`, {
        headers: { ...corsHeaders, 'Content-Type': 'application/javascript' }
      })
    }

    const offer = offers[0]

    // Fetch product info - check product_type or fallback to member_areas then applications
    let product: any = null
    let isApplication = false
    let isAppProduct = false
    let parentAppId: string | null = offer.application_id || null

    if (offer.product_id) {
      if (offer.product_type === 'app_product') {
        // Individual product inside an app
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

    // Fetch checkout URL for the product (needed for redirect to checkout)
    let checkoutShortUrl: string | null = null
    if (offer.product_id && !offer.one_click_purchase) {
      const checkoutQuery = supabase
        .from('checkouts')
        .select('id')
        .eq('is_default', true)

      if (isAppProduct && parentAppId) {
        // App product uses parent app's checkout
        checkoutQuery.eq('application_id', parentAppId)
      } else if (isApplication) {
        checkoutQuery.eq('application_id', offer.product_id)
      } else {
        checkoutQuery.eq('member_area_id', offer.product_id)
      }

      const { data: checkout } = await checkoutQuery.single()

      if (checkout) {
        // Find or create short URL
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

    // Generate widget JavaScript
    const widgetScript = generateWidgetScript(offer, product, pageType, purchaseId, funnelId, pageId, checkoutShortUrl)

    return new Response(widgetScript, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/javascript',
        'Cache-Control': 'public, max-age=300'
      }
    })

  } catch (error) {
    console.error('Widget error:', error)
    return new Response(`console.error('[Clicknish] Widget error: ${error.message}');`, {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/javascript' }
    })
  }
})

function generateWidgetScript(
  offer: any,
  product: any,
  pageType: string,
  purchaseId: string | null,
  funnelId: string,
  pageId: string,
  checkoutShortUrl: string | null
): string {
  const frontendUrl = Deno.env.get('FRONTEND_URL') || 'https://app.clicknich.com'
  const supabaseUrl = Deno.env.get('SUPABASE_URL')

  return `
(function() {
  'use strict';
  
  console.log('[Clicknish] Widget initialized for ${pageType}');
  
  const OFFER = ${JSON.stringify(offer)};
  const PRODUCT = ${JSON.stringify(product)};
  const PAGE_TYPE = '${pageType}';
  const FUNNEL_ID = '${funnelId}';
  const PAGE_ID = '${pageId}';
  const PURCHASE_ID = '${purchaseId || ''}';
  const ONE_CLICK = ${offer.one_click_purchase ? 'true' : 'false'};
  const CHECKOUT_URL = '${checkoutShortUrl ? `${frontendUrl}/checkout/${checkoutShortUrl}` : ''}';
  
  // Check if already shown
  const storageKey = 'clicknish_offer_' + PAGE_ID;
  if (sessionStorage.getItem(storageKey)) {
    console.log('[Clicknish] Offer already shown in this session');
    return;
  }
  
  // Validate purchase context
  if (!PURCHASE_ID) {
    console.log('[Clicknish] No purchase context - widget will not display');
    return;
  }
  
  // Currency formatter
  function formatPrice(price, currency) {
    const symbols = { BRL: 'R$', USD: '$', EUR: '€' };
    const symbol = symbols[currency] || currency;
    return symbol + ' ' + parseFloat(price).toFixed(2).replace('.', ',');
  }
  
  // Calculate discount percentage if not set
  const discountPercentage = OFFER.discount_percentage || 
    Math.round(((OFFER.original_price - OFFER.offer_price) / OFFER.original_price) * 100);
  
  // Get page type emoji
  const typeEmojis = {
    upsell: '🚀',
    downsell: '💎',
    thankyou: '🎁'
  };
  const typeEmoji = typeEmojis[PAGE_TYPE] || '✨';
  
  // Create modal HTML
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
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(30px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        #huskyapp-offer-content {
          animation: slideUp 0.4s ease-out;
        }
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
        <!-- Close Button -->
        <button id="huskyapp-offer-close" style="
          position: absolute;
          top: 20px;
          right: 20px;
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
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
          transition: all 0.2s;
          font-weight: 300;
          z-index: 10;
        " onmouseover="this.style.background='rgba(255,255,255,0.2)'; this.style.transform='scale(1.1)'" onmouseout="this.style.background='rgba(255,255,255,0.1)'; this.style.transform='scale(1)'">
          ×
        </button>
        
        <div style="padding: 50px 40px 40px;">
          <!-- Badge -->
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="
              display: inline-block;
              background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
              color: white;
              padding: 10px 24px;
              border-radius: 30px;
              font-size: 14px;
              font-weight: 700;
              letter-spacing: 0.5px;
              text-transform: uppercase;
              box-shadow: 0 8px 20px rgba(59, 130, 246, 0.3);
            ">
              ${typeEmoji} Special Offer
            </div>
          </div>
          
          <!-- Title -->
          <h2 style="
            color: #fff;
            font-size: 32px;
            font-weight: 800;
            margin: 0 0 16px 0;
            line-height: 1.2;
            text-align: center;
          ">\${OFFER.title || PRODUCT.name}</h2>
          
          <!-- Description -->
          <p style="
            color: #9ca3af;
            font-size: 17px;
            margin: 0 0 32px 0;
            line-height: 1.6;
            text-align: center;
          ">\${OFFER.description || PRODUCT.description || 'Take advantage of this exclusive limited-time offer'}</p>
          
          <!-- Price Box -->
          <div style="
            background: linear-gradient(135deg, #0f1117 0%, #1a1d2e 100%);
            border: 2px solid rgba(59, 130, 246, 0.3);
            border-radius: 16px;
            padding: 32px;
            margin-bottom: 28px;
            text-align: center;
          ">
            \${OFFER.original_price > OFFER.offer_price ? \`
              <div style="
                color: #6b7280;
                font-size: 16px;
                text-decoration: line-through;
                margin-bottom: 8px;
              ">Was: \${formatPrice(OFFER.original_price, OFFER.currency)}</div>
            \` : ''}
            
            <div style="
              color: #3b82f6;
              font-size: 56px;
              font-weight: 800;
              line-height: 1;
              margin-bottom: 12px;
            ">\${formatPrice(OFFER.offer_price, OFFER.currency)}</div>
            
            \${discountPercentage > 0 ? \`
              <div style="
                display: inline-block;
                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                color: white;
                padding: 8px 20px;
                border-radius: 24px;
                font-size: 15px;
                font-weight: 700;
                letter-spacing: 0.3px;
              ">\${discountPercentage}% OFF</div>
            \` : ''}
          </div>
          
          <!-- Action Buttons -->
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
            transition: all 0.2s;
            margin-bottom: 14px;
            box-shadow: 0 10px 25px rgba(59, 130, 246, 0.4);
            text-transform: uppercase;
            letter-spacing: 0.5px;
          " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 15px 30px rgba(59, 130, 246, 0.5)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 10px 25px rgba(59, 130, 246, 0.4)'">
            \${OFFER.button_text || 'Yes, I Want It!'}
          </button>
          
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
            transition: all 0.2s;
          " onmouseover="this.style.background='rgba(156, 163, 175, 0.1)'; this.style.color='#fff'" onmouseout="this.style.background='transparent'; this.style.color='#9ca3af'">
            No, thanks
          </button>
          
          <!-- Trust Badge -->
          <div style="
            text-align: center;
            margin-top: 24px;
            padding-top: 24px;
            border-top: 1px solid rgba(255,255,255,0.1);
          ">
            <p style="
              color: #6b7280;
              font-size: 13px;
              margin: 0;
            ">🔒 100% Secure Payment | ✓ 7-day Guarantee</p>
          </div>
        </div>
      </div>
    </div>
  \`;
  
  // Insert modal into DOM
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // Get elements
  const modal = document.getElementById('huskyapp-offer-modal');
  const closeBtn = document.getElementById('huskyapp-offer-close');
  const acceptBtn = document.getElementById('huskyapp-offer-accept');
  const declineBtn = document.getElementById('huskyapp-offer-decline');
  
  // Close modal function
  function closeModal() {
    if (modal) {
      modal.style.opacity = '0';
      setTimeout(() => modal.remove(), 300);
      sessionStorage.setItem(storageKey, 'true');
      console.log('[Clicknish] Modal closed');
    }
  }
  
  // Accept offer function
  async function acceptOffer() {
    try {
      console.log('[Clicknish] User accepted offer');
      acceptBtn.textContent = 'Processing...';
      acceptBtn.disabled = true;
      
      // Track acceptance
      fetch('${supabaseUrl}/functions/v1/offer-analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offer_id: OFFER.id,
          event: 'accept',
          purchase_id: PURCHASE_ID
        })
      }).catch(console.error);
      
      if (ONE_CLICK) {
        // One-click purchase: call process-upsell directly
        try {
          const response = await fetch('${supabaseUrl}/functions/v1/process-upsell', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              purchase_id: PURCHASE_ID,
              offer_id: OFFER.id
            })
          });
          
          const result = await response.json();
          
          if (result.success) {
            acceptBtn.textContent = '✓ Purchase completed!';
            acceptBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
            setTimeout(() => closeModal(), 1500);
          } else {
            throw new Error(result.error || 'Payment failed');
          }
        } catch (payError) {
          console.error('[Clicknish] One-click payment failed:', payError);
          acceptBtn.textContent = 'Error - Try again';
          acceptBtn.disabled = false;
          acceptBtn.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
          setTimeout(() => {
            acceptBtn.textContent = OFFER.button_text || 'Yes, I Want It!';
            acceptBtn.style.background = 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)';
          }, 3000);
        }
      } else if (CHECKOUT_URL) {
        // Redirect to checkout page using short URL
        window.location.href = CHECKOUT_URL + 
          '?offer_id=' + OFFER.id + 
          '&purchase_id=' + PURCHASE_ID +
          '&funnel_id=' + FUNNEL_ID;
      } else {
        console.error('[Clicknish] No checkout URL available for this offer');
        acceptBtn.textContent = 'Error - No checkout available';
        acceptBtn.disabled = false;
      }
      
    } catch (error) {
      console.error('[Clicknish] Error accepting offer:', error);
      alert('Error processing offer. Please try again.');
      acceptBtn.textContent = OFFER.button_text || 'Yes, I Want It!';
      acceptBtn.disabled = false;
    }
  }
  
  // Decline offer function
  function declineOffer() {
    console.log('[Clicknish] User declined offer');
    
    // Track decline
    fetch('${supabaseUrl}/functions/v1/offer-analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        offer_id: OFFER.id,
        event: 'decline',
        purchase_id: PURCHASE_ID
      })
    }).catch(console.error);
    
    closeModal();
  }
  
  // Event listeners
  closeBtn.addEventListener('click', closeModal);
  declineBtn.addEventListener('click', declineOffer);
  acceptBtn.addEventListener('click', acceptOffer);
  
  // Close on background click
  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      declineOffer();
    }
  });
  
  // Track view
  fetch('${supabaseUrl}/functions/v1/offer-analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      offer_id: OFFER.id,
      event: 'view',
      purchase_id: PURCHASE_ID
    })
  }).catch(console.error);
  
  console.log('[Clicknish] Widget displayed successfully');
  
})();
`
}
