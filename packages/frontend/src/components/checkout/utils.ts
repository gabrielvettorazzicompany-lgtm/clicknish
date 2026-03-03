// Constantes do Supabase
export const SUPABASE_URL = 'https://cgeqtodbisgwvhkaahiy.supabase.co'
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZXF0b2RiaXNnd3Zoa2FhaGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTk1MDIsImV4cCI6MjA4NDY5NTUwMn0.Ov6_rRlThZUBIoL4oT6BGozEhvTUdFsWB6KylDXpFoY'

// Estilos para Stripe Elements
export const stripeElementStyle = {
    base: {
        fontSize: '14px',
        lineHeight: '1.6',
        fontFamily: "'Inter', system-ui, sans-serif",
        fontSmoothing: 'antialiased',
        color: '#1f2937',
        '::placeholder': {
            color: '#9ca3af',
        },
    },
    invalid: {
        color: '#ef4444',
    },
}

// Função para formatar preço com moeda
export const formatPrice = (price: number, currency?: string) => {
    const currencyMap: { [key: string]: string } = {
        'USD': 'en-US',
        'EUR': 'de-DE',
        'CHF': 'de-CH',
        'BRL': 'pt-BR'
    }

    const finalCurrency = currency || 'USD'
    const locale = currencyMap[finalCurrency] || 'en-US'

    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: finalCurrency
    }).format(price)
}

// Função para calcular valor de parcela
export const calculateInstallmentValue = (total: number, installment: number) => {
    return total / installment
}

// Função para formatar tempo do timer
export const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// Função para validar email
export const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
}