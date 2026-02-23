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
    const checkoutId = url.searchParams.get('checkout_id')
    const offerType = url.searchParams.get('offer_type') || 'upsell'
    const purchaseId = url.searchParams.get('purchase_id')
    const rejectUrl = url.searchParams.get('reject_url') || ''

    if (!checkoutId) {
      return new Response('Missing checkout_id', {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/javascript' }
      })
    }

    // Fetch checkout offers
    const supabaseUrl = Deno.env.get('SUPABASE_URL') as string
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data: offers, error } = await supabase
      .from('checkout_offers')
      .select(`
        id,
        offer_type,
        product_id,
        offer_price,
        offer_discount_percentage,
        currency,
        title,
        description,
        button_text
      `)
      .eq('checkout_id', checkoutId)
      .eq('offer_type', offerType)
      .eq('is_active', true)

    if (error) {
      console.error('Error fetching offers:', error)
      return new Response(`console.error('Error loading offers: ${error.message}');`, {
        headers: { ...corsHeaders, 'Content-Type': 'application/javascript' }
      })
    }

    // Generate JavaScript script
    const script = `
(function() {
  'use strict';
  
  const CHECKOUT_ID = '${checkoutId}';
  const OFFER_TYPE = '${offerType}';
  const PURCHASE_ID = '${purchaseId || ''}';
  const REJECT_URL = '${rejectUrl}';
  const OFFERS = ${JSON.stringify(offers || [])};
  
  // Check if the offer has already been shown
  const storageKey = 'huskyapp_offer_shown_' + CHECKOUT_ID + '_' + OFFER_TYPE;
  if (localStorage.getItem(storageKey)) {

    return;
  }
  
  // Check if purchase_id exists in URL (just purchased)
  const urlParams = new URLSearchParams(window.location.search);
  const purchaseIdFromUrl = urlParams.get('purchase_id') || PURCHASE_ID;
  
  if (!purchaseIdFromUrl && OFFER_TYPE === 'upsell') {

    return;
  }
  
  // If there are no offers, show nothing
  if (!OFFERS || OFFERS.length === 0) {

    return;
  }
  
  // Get first offer
  const offer = OFFERS[0];
  
  // Create modal
  const modalHTML = \`
    <div id="huskyapp-offer-modal" style="
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    ">
      <div style="
        background: #1a1d2e;
        border-radius: 16px;
        max-width: 600px;
        width: 90%;
        max-height: 90vh;
        overflow-y: auto;
        position: relative;
        box-shadow: 0 24px 48px rgba(0, 0, 0, 0.5);
      ">
        <button id="huskyapp-offer-close" style="
          position: absolute;
          top: 16px;
          right: 16px;
          background: transparent;
          border: none;
          color: #9ca3af;
          font-size: 28px;
          cursor: pointer;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          transition: all 0.2s;
        " onmouseover="this.style.background='#252941'; this.style.color='#fff'" onmouseout="this.style.background='transparent'; this.style.color='#9ca3af'">
          ×
        </button>
        
        <div style="padding: 48px 32px 32px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <div style="
              display: inline-block;
              background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
              color: white;
              padding: 8px 16px;
              border-radius: 24px;
              font-size: 14px;
              font-weight: 600;
              margin-bottom: 16px;
            ">
              🎁 SPECIAL OFFER
            </div>
            <h2 style="
              color: #fff;
              font-size: 28px;
              font-weight: 700;
              margin: 0 0 12px 0;
              line-height: 1.2;
            ">\${offer.title || 'Exclusive Offer'}</h2>
            <p style="
              color: #9ca3af;
              font-size: 16px;
              margin: 0;
              line-height: 1.5;
            ">\${offer.description || 'Take advantage of this limited-time offer'}</p>
          </div>
          
          <div style="
            background: #0f1117;
            border: 2px solid #252941;
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 24px;
          ">
            <div style="text-align: center;">
              <div style="
                color: #9ca3af;
                font-size: 14px;
                margin-bottom: 8px;
              ">Today only for:</div>
              <div style="
                color: #3b82f6;
                font-size: 48px;
                font-weight: 700;
                line-height: 1;
              ">\${offer.currency} \${offer.offer_price.toFixed(2)}</div>
              \${offer.offer_discount_percentage ? \`
                <div style="
                  color: #10b981;
                  font-size: 14px;
                  font-weight: 600;
                  margin-top: 8px;
                ">${offer.offer_discount_percentage}% OFF</div>
              \` : ''}
            </div>
          </div>
          
          <button id="huskyapp-offer-accept" style="
            width: 100%;
            background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
            color: white;
            border: none;
            padding: 16px 24px;
            border-radius: 12px;
            font-size: 18px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s;
            margin-bottom: 12px;
          " onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
            \${offer.button_text || 'Add to My Purchase'}
          </button>
          
          <button id="huskyapp-offer-decline" style="
            width: 100%;
            background: transparent;
            color: #9ca3af;
            border: 1px solid #252941;
            padding: 12px 24px;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
          " onmouseover="this.style.background='#252941'; this.style.color='#fff'" onmouseout="this.style.background='transparent'; this.style.color='#9ca3af'">
            No, thanks
          </button>
        </div>
      </div>
    </div>
  \`;
  
  // Insert modal into DOM
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // Event listeners
  const modal = document.getElementById('huskyapp-offer-modal');
  const closeBtn = document.getElementById('huskyapp-offer-close');
  const acceptBtn = document.getElementById('huskyapp-offer-accept');
  const declineBtn = document.getElementById('huskyapp-offer-decline');
  
  function closeModal() {
    if (modal) {
      modal.remove();
      localStorage.setItem(storageKey, 'true');
      
      // If there's a redirect URL for rejection, redirect
      if (REJECT_URL) {
        const separator = REJECT_URL.includes('?') ? '&' : '?';
        window.location.href = REJECT_URL + separator + 'purchase_id=' + purchaseIdFromUrl;
      }
    }
  }
  
  async function acceptOffer() {
    try {
      acceptBtn.textContent = 'Processing...';
      acceptBtn.disabled = true;
      
      // Redirect to offer checkout
      const checkoutUrl = '${Deno.env.get('FRONTEND_URL') || 'https://app.clicknich.com'}/checkout/' + CHECKOUT_ID + '?offer_id=' + offer.id + '&purchase_id=' + purchaseIdFromUrl;
      window.location.href = checkoutUrl;
      
    } catch (error) {
      console.error('Error accepting offer:', error);
      alert('Error processing offer. Please try again.');
      acceptBtn.textContent = offer.button_text || 'Add to My Purchase';
      acceptBtn.disabled = false;
    }
  }
  
  closeBtn.addEventListener('click', closeModal);
  declineBtn.addEventListener('click', closeModal);
  acceptBtn.addEventListener('click', acceptOffer);
  
  // Close on outside click
  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      closeModal();
    }
  });
  
  // Track analytics
  if (offer.id) {
    fetch('${Deno.env.get('SUPABASE_URL')}/functions/v1/offer-analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        offer_id: offer.id,
        event: 'view',
        purchase_id: purchaseIdFromUrl
      })
    }).catch(console.error);
  }
  
})();
`;

    return new Response(script, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/javascript',
        'Cache-Control': 'public, max-age=300'
      }
    })

  } catch (error) {
    console.error('Error:', error)
    return new Response(`console.error('Widget error: ${error.message}');`, {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/javascript' }
    })
  }
})
