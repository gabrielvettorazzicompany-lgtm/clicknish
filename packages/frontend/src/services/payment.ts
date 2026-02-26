import { supabase } from './supabase'

interface PaymentData {
    productId: string
    customerEmail: string
    customerName: string
    customerCpf: string
    customerPhone: string
    paymentMethod: 'credit' | 'pix'
    cardData?: {
        number: string
        holderName: string
        expiryMonth: string
        expiryYear: string
        cvv: string
    }
    installments?: number
}

interface PaymentResponse {
    success: boolean
    transactionId?: string
    pixQrCode?: string
    pixQrCodeBase64?: string
    status: 'approved' | 'pending' | 'rejected'
    message: string
}

export async function processPayment(data: PaymentData): Promise<PaymentResponse> {
    try {
        // 1. Fetch product from database
        const { data: product, error: productError } = await supabase
            .from('marketplace_products')
            .select('*')
            .eq('id', data.productId)
            .single()

        if (productError || !product) {
            throw new Error('Product not found')
        }

        // 2. Create order in database (before processing payment)
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert({
                product_id: product.id,
                customer_email: data.customerEmail,
                customer_name: data.customerName,
                customer_cpf: data.customerCpf,
                customer_phone: data.customerPhone,
                amount: product.price,
                payment_method: data.paymentMethod,
                status: 'pending',
                created_at: new Date().toISOString()
            })
            .select()
            .single()

        if (orderError) {
            throw new Error('Error creating order')
        }

        // 3. Process payment via gateway
        const paymentResult = await processGatewayPayment({
            ...data,
            amount: product.price,
            orderId: order.id
        })

        // 4. Update order status
        await supabase
            .from('orders')
            .update({
                transaction_id: paymentResult.transactionId,
                status: paymentResult.status,
                updated_at: new Date().toISOString()
            })
            .eq('id', order.id)

        // 5. If approved, grant access to product
        if (paymentResult.status === 'approved') {
            await grantProductAccess(order.id, data.customerEmail, product.id)
        }

        return paymentResult

    } catch (error: any) {
        console.error('Error processing payment:', error)
        return {
            success: false,
            status: 'rejected',
            message: error.message || 'Error processing payment'
        }
    }
}

async function processGatewayPayment(data: any): Promise<PaymentResponse> {
    // Here you would integrate with the real gateway
    // Example with Mercado Pago, Stripe, etc.

    // EXAMPLE: API call to the gateway
    const response = await fetch('/api/payment/process', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
    })

    const result = await response.json()

    if (data.paymentMethod === 'pix') {
        return {
            success: true,
            transactionId: result.id,
            pixQrCode: result.qr_code,
            pixQrCodeBase64: result.qr_code_base64,
            status: 'pending',
            message: 'PIX generated successfully. Awaiting payment.'
        }
    }

    return {
        success: result.status === 'approved',
        transactionId: result.id,
        status: result.status,
        message: result.status === 'approved'
            ? 'Payment approved successfully!'
            : 'Payment declined. Try another card.'
    }
}

async function grantProductAccess(orderId: string, email: string, productId: string) {
    // Grant product access to the customer
    await supabase
        .from('product_access')
        .insert({
            order_id: orderId,
            customer_email: email,
            product_id: productId,
            granted_at: new Date().toISOString()
        })

    // Send access email
    // await sendAccessEmail(email, productId)
}
