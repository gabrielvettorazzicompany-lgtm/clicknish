/**
 * migrate-base64-images.mjs
 *
 * Migra imagens base64 salvas no banco para o Supabase Storage.
 * Campos tratados por checkout:
 *   - checkouts.banner_image         (string direta)
 *   - custom_fields.imageBlocks[].url (array de blocos de imagem)
 *   - custom_fields.testimonials[].photo (array de depoimentos)
 *
 * Uso:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_KEY=eyJ... \
 *   node scripts/migrate-base64-images.mjs
 *
 * O SERVICE_KEY (service_role) é necessário para bypassar RLS.
 * Encontre em: Supabase Dashboard → Project Settings → API → service_role key
 */

import { createClient } from '@supabase/supabase-js'

// ── Configuração ──────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const BUCKET = 'checkout-banners'
const DRY_RUN = process.env.DRY_RUN === '1' // DRY_RUN=1 só mostra o que faria

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Defina SUPABASE_URL e SUPABASE_SERVICE_KEY')
    console.error('   Exemplo:')
    console.error('   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_KEY=eyJ... node scripts/migrate-base64-images.mjs')
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ── Helpers ───────────────────────────────────────────────────────────────────

function isBase64(str) {
    return typeof str === 'string' && str.startsWith('data:')
}

function base64ToBuffer(dataUrl) {
    // dataUrl = "data:image/png;base64,iVBORw0KGgo..."
    const [header, data] = dataUrl.split(',')
    const mimeMatch = header.match(/data:([^;]+)/)
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg'
    const ext = mime.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg'
    const buffer = Buffer.from(data, 'base64')
    return { buffer, mime, ext }
}

async function uploadToStorage(buffer, mime, folder, label) {
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${mime.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg'}`

    if (DRY_RUN) {
        console.log(`   [DRY RUN] Faria upload: ${path} (${(buffer.length / 1024).toFixed(1)} KB)`)
        return `https://DRY_RUN/${path}`
    }

    const { data, error } = await supabase.storage
        .from(BUCKET)
        .upload(path, buffer, {
            contentType: mime,
            cacheControl: '31536000',
            upsert: false
        })

    if (error) throw new Error(`Upload falhou para ${label}: ${error.message}`)

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(data.path)
    return publicUrl
}

// ── Stats ─────────────────────────────────────────────────────────────────────
const stats = {
    total: 0,
    skipped: 0,
    banners: 0,
    imageBlocks: 0,
    testimonials: 0,
    errors: 0,
}

// ── Migração principal ────────────────────────────────────────────────────────
async function migrateCheckout(checkout) {
    stats.total++
    let dirty = false
    const updates = {}

    // 1. banner_image
    if (isBase64(checkout.banner_image)) {
        console.log(`  📦 banner_image (${(checkout.banner_image.length / 1024).toFixed(0)} KB base64)`)
        try {
            const { buffer, mime } = base64ToBuffer(checkout.banner_image)
            const url = await uploadToStorage(buffer, mime, 'banners', `checkout ${checkout.id}`)
            updates.banner_image = url
            stats.banners++
            dirty = true
            console.log(`  ✅ banner → ${url.slice(0, 80)}...`)
        } catch (err) {
            console.error(`  ❌ Erro banner: ${err.message}`)
            stats.errors++
        }
    }

    // 2. custom_fields.imageBlocks
    const customFields = checkout.custom_fields || {}
    let imageBlocks = customFields.imageBlocks || []
    let imageBlocksDirty = false

    for (let i = 0; i < imageBlocks.length; i++) {
        const block = imageBlocks[i]
        if (isBase64(block.url)) {
            console.log(`  📦 imageBlock[${i}] (${(block.url.length / 1024).toFixed(0)} KB base64)`)
            try {
                const { buffer, mime } = base64ToBuffer(block.url)
                const url = await uploadToStorage(buffer, mime, 'image-blocks', `block ${block.id}`)
                imageBlocks[i] = { ...block, url }
                stats.imageBlocks++
                imageBlocksDirty = true
                dirty = true
                console.log(`  ✅ imageBlock → ${url.slice(0, 80)}...`)
            } catch (err) {
                console.error(`  ❌ Erro imageBlock[${i}]: ${err.message}`)
                stats.errors++
            }
        }
    }

    // 3. custom_fields.testimonials
    let testimonials = customFields.testimonials || []
    let testimonialsDirty = false

    for (let i = 0; i < testimonials.length; i++) {
        const t = testimonials[i]
        if (isBase64(t.photo)) {
            console.log(`  📦 testimonial[${i}].photo (${(t.photo.length / 1024).toFixed(0)} KB base64)`)
            try {
                const { buffer, mime } = base64ToBuffer(t.photo)
                const url = await uploadToStorage(buffer, mime, 'testimonials', `testimonial ${t.id}`)
                testimonials[i] = { ...t, photo: url }
                stats.testimonials++
                testimonialsDirty = true
                dirty = true
                console.log(`  ✅ testimonial → ${url.slice(0, 80)}...`)
            } catch (err) {
                console.error(`  ❌ Erro testimonial[${i}]: ${err.message}`)
                stats.errors++
            }
        }
    }

    if (!dirty) {
        stats.skipped++
        return
    }

    if (imageBlocksDirty || testimonialsDirty) {
        updates.custom_fields = {
            ...customFields,
            ...(imageBlocksDirty ? { imageBlocks } : {}),
            ...(testimonialsDirty ? { testimonials } : {}),
        }
    }

    if (!DRY_RUN) {
        const { error } = await supabase
            .from('checkouts')
            .update(updates)
            .eq('id', checkout.id)

        if (error) {
            console.error(`  ❌ Erro ao salvar checkout ${checkout.id}: ${error.message}`)
            stats.errors++
            return
        }
    }

    console.log(`  💾 Checkout ${checkout.id} atualizado`)
}

async function main() {
    console.log(`🚀 Iniciando migração${DRY_RUN ? ' (DRY RUN — nenhuma alteração real)' : ''}`)
    console.log(`📡 Supabase: ${SUPABASE_URL}`)
    console.log()

    // Busca checkouts páginado para não sobrecarregar memória
    let page = 0
    const PAGE_SIZE = 50

    while (true) {
        const { data, error } = await supabase
            .from('checkouts')
            .select('id, banner_image, custom_fields')
            .or('banner_image.like.data:%,custom_fields->imageBlocks.not.is.null,custom_fields->testimonials.not.is.null')
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

        if (error) {
            console.error('❌ Erro ao buscar checkouts:', error.message)
            process.exit(1)
        }

        if (!data || data.length === 0) break

        console.log(`📄 Página ${page + 1}: ${data.length} checkouts`)

        for (const checkout of data) {
            const hasBase64 =
                isBase64(checkout.banner_image) ||
                (checkout.custom_fields?.imageBlocks || []).some(b => isBase64(b.url)) ||
                (checkout.custom_fields?.testimonials || []).some(t => isBase64(t.photo))

            if (!hasBase64) {
                stats.skipped++
                continue
            }

            console.log(`\n🔍 Checkout ${checkout.id}`)
            await migrateCheckout(checkout)
        }

        if (data.length < PAGE_SIZE) break
        page++
    }

    console.log('\n' + '─'.repeat(50))
    console.log('📊 Resultado:')
    console.log(`   Total processados : ${stats.total}`)
    console.log(`   Sem base64 (skip)  : ${stats.skipped}`)
    console.log(`   Banners migrados   : ${stats.banners}`)
    console.log(`   ImageBlocks migrad.: ${stats.imageBlocks}`)
    console.log(`   Depoimentos migrad.: ${stats.testimonials}`)
    console.log(`   Erros              : ${stats.errors}`)
    console.log('─'.repeat(50))

    if (stats.errors > 0) {
        console.log('⚠️  Concluído com erros. Verifique os logs acima.')
        process.exit(1)
    } else {
        console.log('✅ Migração concluída com sucesso!')
    }
}

main().catch(err => {
    console.error('💥 Erro fatal:', err)
    process.exit(1)
})
