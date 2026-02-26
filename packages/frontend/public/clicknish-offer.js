/**
 * Clicknish Offer Button Script
 * Creates accept/reject buttons for upsell/downsell pages
 * Supports standard (redirect to checkout) and one-click (auto-charge) modes
 */
function initClicknishOffer(config) {
    var container = document.getElementById('clicknish_offer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'clicknish_offer';
        document.body.appendChild(container);
    }

    // Get purchase_id from URL
    var params = new URLSearchParams(window.location.search);
    var purchaseId = params.get('purchase_id') || '';

    // Build reject URL with purchase_id
    var rejectUrl = config.refusalLinkUrl || '#';
    if (purchaseId && rejectUrl !== '#') {
        rejectUrl += (rejectUrl.indexOf('?') > -1 ? '&' : '?') + 'purchase_id=' + purchaseId;
    }

    var styles = config.styles || {};
    var bgColor = styles.backgroundColor || '#000000';
    var hoverBg = styles.hoverBackgroundColor || '#333333';
    var fontSize = styles.fontSize || '17px';
    var borderRadius = styles.borderRadius || '10px';
    var refusalColor = config.refusalLinkColor || '#999999';

    // Determine accept behavior
    var isOneClick = config.oneClick === true;
    var acceptUrl = '#';

    if (!isOneClick) {
        // Standard mode: build accept URL with purchase_id
        acceptUrl = config.linkUrl || '#';
        if (purchaseId && acceptUrl !== '#') {
            acceptUrl += (acceptUrl.indexOf('?') > -1 ? '&' : '?') + 'purchase_id=' + purchaseId;
        }
    }

    var acceptTag = isOneClick ? 'button' : 'a';
    var acceptHref = isOneClick ? '' : ' href="' + acceptUrl + '"';
    var acceptId = 'clicknish_accept_btn';

    container.innerHTML =
        '<div style="text-align:center;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;">' +
        '<' + acceptTag + acceptHref + ' id="' + acceptId + '" style="' +
        'display:inline-block;width:100%;max-width:480px;padding:16px 32px;' +
        'background:' + bgColor + ';color:#fff;text-decoration:none;' +
        'font-size:' + fontSize + ';font-weight:700;border:none;' +
        'border-radius:' + borderRadius + ';' +
        'cursor:pointer;transition:background 0.2s;box-sizing:border-box;">' +
        (config.linkText || 'YES, I WANT THIS OFFER') +
        '</' + acceptTag + '>' +
        '<div style="margin-top:12px;">' +
        '<a href="' + rejectUrl + '" style="' +
        'color:' + refusalColor + ';text-decoration:none;font-size:14px;cursor:pointer;">' +
        (config.refusalLinkText || 'No thanks') +
        '</a>' +
        '</div>' +
        '</div>';

    var btn = document.getElementById(acceptId);

    // Hover effect
    if (btn) {
        btn.onmouseover = function () { this.style.background = hoverBg; };
        btn.onmouseout = function () { this.style.background = bgColor; };
    }

    // One-click purchase handler
    if (isOneClick && btn) {
        btn.onclick = function () {
            if (btn.disabled) return;

            // Show loading state
            var originalText = btn.textContent;
            btn.textContent = 'Processing...';
            btn.disabled = true;
            btn.style.opacity = '0.7';
            btn.style.cursor = 'wait';

            var apiUrl = config.apiUrl;
            var offerId = config.offerId;
            var successUrl = config.successUrl || '#';

            // Append purchase_id to success URL
            if (purchaseId && successUrl !== '#') {
                successUrl += (successUrl.indexOf('?') > -1 ? '&' : '?') + 'purchase_id=' + purchaseId;
            }

            fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + (config.anonKey || ''),
                    'apikey': config.anonKey || ''
                },
                body: JSON.stringify({
                    purchase_id: purchaseId,
                    offer_id: offerId,
                })
            })
                .then(function (res) { return res.json(); })
                .then(function (data) {
                    if (data.success) {
                        // Update purchase_id if a new one was returned
                        var nextPurchaseId = data.purchaseId || purchaseId;
                        if (nextPurchaseId && successUrl !== '#') {
                            // Replace or add purchase_id in the success URL
                            var url = new URL(successUrl, window.location.origin);
                            url.searchParams.set('purchase_id', nextPurchaseId);
                            window.location.href = url.toString();
                        } else {
                            window.location.href = successUrl;
                        }
                    } else {
                        // Payment failed
                        btn.textContent = originalText;
                        btn.disabled = false;
                        btn.style.opacity = '1';
                        btn.style.cursor = 'pointer';

                        if (data.requiresNewPayment) {
                            // Card declined — fallback to checkout redirect
                            alert('Your card was declined. You will be redirected to enter new payment details.');
                            var fallbackUrl = config.linkUrl || '#';
                            if (purchaseId && fallbackUrl !== '#') {
                                fallbackUrl += (fallbackUrl.indexOf('?') > -1 ? '&' : '?') + 'purchase_id=' + purchaseId;
                            }
                            window.location.href = fallbackUrl;
                        } else {
                            alert(data.error || 'An error occurred processing your purchase. Please try again.');
                        }
                    }
                })
                .catch(function (err) {
                    console.error('One-click purchase error:', err);
                    btn.textContent = originalText;
                    btn.disabled = false;
                    btn.style.opacity = '1';
                    btn.style.cursor = 'pointer';
                    alert('Connection error. Please try again.');
                });
        };
    }
}
