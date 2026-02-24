/**
 * Utility functions for funnel operations
 */

export const CURRENCIES = [
    { value: 'BRL', label: 'Brazilian Real (R$)' },
    { value: 'USD', label: 'US Dollar ($)' },
    { value: 'EUR', label: 'Euro (€)' }
] as const

export type CurrencyType = typeof CURRENCIES[number]['value']

export const getStatusBadge = (status: string) => {
    const badges = {
        active: 'bg-green-500/20 text-green-400 border-green-500/30',
        draft: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
        paused: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    }
    return badges[status as keyof typeof badges] || badges.draft
}

export const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })
}

export const getStatusLabel = (status: string) => {
    switch (status) {
        case 'active': return 'Active'
        case 'draft': return 'Draft'
        case 'paused': return 'Paused'
        default: return status
    }
}

export const generateOfferScript = (type: 'upsell' | 'downsell', checkoutId?: string) => {
    const widgetUrl = `https://api.clicknich.com/api/offer-widget?checkout_id=${checkoutId || 'SEU_CHECKOUT_ID'}&offer_type=${type}`

    return `<!-- ${type.toUpperCase()} Script - Clicknish -->
<script>
  (function() {
    // Detect recent purchase via URL or localStorage
    const urlParams = new URLSearchParams(window.location.search);
    const purchaseId = urlParams.get('purchase_id') || localStorage.getItem('clicknish_last_purchase');
    
    if (purchaseId) {
      var script = document.createElement('script');
      script.src = '${widgetUrl}&purchase_id=' + purchaseId;
      script.async = true;
      document.body.appendChild(script);
    }
  })();
</script>`
}