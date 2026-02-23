/**
 * Script Generator for Funnel Pages
 * Generates simple accept/reject button scripts for external page integration
 * Clicknish
 */

export interface ScriptConfig {
  funnelId: string
  pageId: string
  pageType: 'upsell' | 'downsell' | 'thankyou'
  nextPageUrl?: string
  acceptNextUrl?: string
  productId?: string
  offerId?: string
  oneClickPurchase?: boolean
  checkoutUrl?: string
}

export interface ScriptOutput {
  headScript: string
  bodyHtml: string
}

export const generateFunnelPageScript = (config: ScriptConfig): ScriptOutput => {
  const frontendUrl = (import.meta.env as any).VITE_APP_URL || 'https://app.clicknich.com'
  const supabaseUrl = (import.meta.env as any).VITE_SUPABASE_URL || ''
  const supabaseAnonKey = (import.meta.env as any).VITE_SUPABASE_ANON_KEY || ''

  const rejectUrl = config.nextPageUrl || '#'
  const acceptNextUrl = config.acceptNextUrl || config.nextPageUrl || '#'
  const acceptUrl = config.checkoutUrl
    ? `${frontendUrl}${config.checkoutUrl}?nobumps=1${acceptNextUrl !== '#' ? '&redirect=' + encodeURIComponent(acceptNextUrl) : ''}`
    : '#'

  const headScript = `<script src="${frontendUrl}/clicknish-offer.js"></script>`

  // One-click mode: charge automatically via API
  if (config.oneClickPurchase && config.offerId) {
    const acceptNextUrl = config.acceptNextUrl || config.nextPageUrl || '#'

    const bodyHtml = `<div id="clicknish_offer"></div>
<script>
initClicknishOffer({
  oneClick: true,
  apiUrl: "${supabaseUrl}/functions/v1/process-upsell",
  anonKey: "${supabaseAnonKey}",
  offerId: "${config.offerId}",
  successUrl: "${acceptNextUrl}",
  linkText: "YES, I WANT THIS OFFER",
  styles: {
    backgroundColor: "#000000",
    hoverBackgroundColor: "#333333",
    fontSize: "17px",
    borderRadius: "10px"
  },
  refusalLinkUrl: "${rejectUrl}",
  refusalLinkText: "No thanks, I don't want this offer",
  refusalLinkColor: "#999999"
});
</script>`

    return { headScript, bodyHtml }
  }

  // Standard mode: redirect to checkout
  const bodyHtml = `<div id="clicknish_offer"></div>
<script>
initClicknishOffer({
  linkUrl: "${acceptUrl}",
  linkText: "YES, I WANT THIS OFFER",
  styles: {
    backgroundColor: "#000000",
    hoverBackgroundColor: "#333333",
    fontSize: "17px",
    borderRadius: "10px"
  },
  refusalLinkUrl: "${rejectUrl}",
  refusalLinkText: "No thanks, I don't want this offer",
  refusalLinkColor: "#999999"
});
</script>`

  return { headScript, bodyHtml }
}
