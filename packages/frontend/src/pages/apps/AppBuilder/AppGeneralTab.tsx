import { Plus, X } from 'lucide-react'
import ImageUploader from '@/components/ImageUploader'
import { useI18n } from '@/i18n'
import type { AppData } from './types'

interface Props {
    appData: AppData
    setAppData: React.Dispatch<React.SetStateAction<AppData>>
    loading: boolean
    onSave: () => void
    onRemoveBanner: (id: number) => void
    onUpdateBanner: (id: number, field: 'link' | 'image', value: string) => void
}

// ─── Banner Crop Modal ────────────────────────────────────────────────────────

function openBannerCropModal(imageData: string, onConfirm: (croppedImage: string) => void) {
    const cropModal = document.createElement('div')
    cropModal.style.cssText =
        'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:1000;display:flex;align-items:center;justify-content:center;'

    const cropContent = document.createElement('div')
    cropContent.style.cssText =
        'background:white;padding:24px;border-radius:12px;max-width:600px;width:90%;max-height:80vh;overflow:auto;'

    cropContent.innerHTML = `
    <div style="text-align:center;margin-bottom:20px;">
      <h3 style="font-size:18px;font-weight:600;color:#1f2937;margin:0 0 8px 0;">Crop Banner</h3>
      <p style="font-size:14px;color:#6b7280;margin:0;">Drag to select the banner area</p>
    </div>
    <div style="position:relative;display:flex;justify-content:center;margin-bottom:20px;">
      <canvas id="cropCanvas" style="border:2px solid #e5e7eb;border-radius:8px;max-width:100%;cursor:crosshair;"></canvas>
    </div>
    <div style="text-align:center;margin-bottom:20px;">
      <p style="font-size:12px;color:#6b7280;margin:0;">🖱️ Click and drag to select the desired area</p>
    </div>
    <div style="display:flex;gap:12px;justify-content:flex-end;">
      <button id="cancelCrop" style="padding:10px 20px;background:#6b7280;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:500;">Cancel</button>
      <button id="confirmCrop" style="padding:10px 20px;background:#3b82f6;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:500;">Confirm Crop</button>
    </div>
  `

    cropModal.appendChild(cropContent)
    document.body.appendChild(cropModal)

    const canvas = cropContent.querySelector('#cropCanvas') as HTMLCanvasElement
    const ctx = canvas.getContext('2d')!

    const img = new Image()
    let isDrawing = false
    let startX = 0, startY = 0, endX = 0, endY = 0
    let scale = 1

    img.onload = () => {
        const maxWidth = 500
        const maxHeight = 400
        if (img.width > maxWidth || img.height > maxHeight) {
            scale = Math.min(maxWidth / img.width, maxHeight / img.height)
        }
        canvas.width = img.width * scale
        canvas.height = img.height * scale
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

        const defaultWidth = canvas.width
        let defaultHeight = defaultWidth / (16 / 9)
        if (defaultHeight > canvas.height) {
            defaultHeight = canvas.height
            const w = defaultHeight * (16 / 9)
            startX = (canvas.width - w) / 2
            endX = startX + w
        } else {
            startX = 0
            endX = canvas.width
        }
        startY = (canvas.height - defaultHeight) / 2
        endY = startY + defaultHeight
        drawSelection()
    }

    img.src = imageData

    function drawSelection() {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        ctx.fillStyle = 'rgba(0,0,0,0.5)'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        const x = Math.min(startX, endX)
        const y = Math.min(startY, endY)
        const w = Math.abs(endX - startX)
        const h = Math.abs(endY - startY)
        ctx.clearRect(x, y, w, h)
        ctx.drawImage(img, x / scale, y / scale, w / scale, h / scale, x, y, w, h)
        ctx.strokeStyle = '#3b82f6'
        ctx.lineWidth = 2
        ctx.setLineDash([5, 5])
        ctx.strokeRect(x, y, w, h)
        ctx.setLineDash([])
    }

    canvas.addEventListener('mousedown', e => {
        isDrawing = true
        const rect = canvas.getBoundingClientRect()
        startX = e.clientX - rect.left
        startY = e.clientY - rect.top
    })
    canvas.addEventListener('mousemove', e => {
        if (!isDrawing) return
        const rect = canvas.getBoundingClientRect()
        endX = e.clientX - rect.left
        endY = e.clientY - rect.top
        drawSelection()
    })
    canvas.addEventListener('mouseup', () => { isDrawing = false })

    const cancelBtn = cropContent.querySelector('#cancelCrop') as HTMLButtonElement
    const confirmBtn = cropContent.querySelector('#confirmCrop') as HTMLButtonElement

    cancelBtn.onclick = () => document.body.removeChild(cropModal)
    confirmBtn.onclick = () => {
        const cropCanvas = document.createElement('canvas')
        const cropCtx = cropCanvas.getContext('2d')!
        const x = Math.min(startX, endX) / scale
        const y = Math.min(startY, endY) / scale
        const w = Math.abs(endX - startX) / scale
        const h = Math.abs(endY - startY) / scale
        cropCanvas.width = w
        cropCanvas.height = h
        cropCtx.drawImage(img, x, y, w, h, 0, 0, w, h)
        onConfirm(cropCanvas.toDataURL('image/jpeg', 0.9))
        document.body.removeChild(cropModal)
    }
}

function pickImageFile(onFile: (imageData: string) => void) {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = e => {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = event => {
            if (event.target?.result) {
                onFile(event.target.result as string)
            }
        }
        reader.readAsDataURL(file)
    }
    input.click()
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AppGeneralTab({
    appData,
    setAppData,
    loading,
    onSave,
    onRemoveBanner,
    onUpdateBanner,
}: Props) {
    const { t } = useI18n()

    return (
        <>
            {/* App Name */}
            <div className="mb-4">
                <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    {t('apps.builder.app_name')}
                </label>
                <input
                    type="text"
                    value={appData.name}
                    onChange={e => setAppData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder={t('apps.builder.enter_app_name_placeholder')}
                    className="w-full px-2.5 py-2 text-xs text-gray-900 dark:text-gray-100 placeholder-gray-500 border border-gray-300 dark:border-[#252941] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all bg-white dark:bg-[#0f1117]"
                />
            </div>

            {/* Toggles */}
            <div className="mb-4 space-y-1.5">
                {[
                    {
                        key: 'showNames' as const,
                        label: t('apps.builder.show_names'),
                        desc: t('apps.builder.show_names_description'),
                    },
                    {
                        key: 'highlightCommunity' as const,
                        label: t('apps.builder.highlight_community'),
                        desc: t('apps.builder.highlight_community_description'),
                    },
                    {
                        key: 'freeRegistration' as const,
                        label: t('apps.builder.enable_free_registration'),
                        desc: t('apps.builder.free_registration_description'),
                    },
                ].map(({ key, label, desc }) => (
                    <div
                        key={key}
                        className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-[#0f1117] rounded-lg border border-gray-200 dark:border-[#252941]"
                    >
                        <div>
                            <p className="text-[11px] font-medium text-gray-900 dark:text-gray-100">{label}</p>
                            <p className="text-[10px] text-gray-500 mt-0.5">{desc}</p>
                        </div>
                        <button
                            onClick={() => setAppData(prev => ({ ...prev, [key]: !prev[key] }))}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-all ${appData[key] ? 'bg-blue-500 shadow-lg shadow-blue-500/50' : 'bg-[#252941]'
                                }`}
                        >
                            <span
                                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow ${appData[key] ? 'translate-x-4' : 'translate-x-0.5'
                                    }`}
                            />
                        </button>
                    </div>
                ))}
            </div>

            {/* App Type */}
            <div className="mb-4">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    {t('apps.builder.app_type')}
                </label>
                <select
                    value={appData.appType}
                    onChange={e => setAppData(prev => ({ ...prev, appType: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm bg-white dark:bg-[#0f1117] text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-[#252941] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 [&>option]:bg-white [&>option]:dark:bg-[#0f1117] cursor-pointer"
                >
                    <option value="login-complete">{t('apps.builder.login_complete_email')}</option>
                    <option value="login-simple">{t('apps.builder.login_simple_email')}</option>
                </select>
                <p className="text-xs text-gray-500 mt-1.5">{t('apps.builder.select_auth_method')}</p>
            </div>

            {/* Language */}
            <div className="mb-4">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    {t('apps.builder.language')}
                </label>
                <select
                    value={appData.language}
                    onChange={e => setAppData(prev => ({ ...prev, language: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm bg-white dark:bg-[#0f1117] text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-[#252941] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 [&>option]:bg-white [&>option]:dark:bg-[#0f1117] cursor-pointer"
                >
                    <option value="pt-br">Português (Brasil)</option>
                    <option value="en">English</option>
                    <option value="es">Español</option>
                    <option value="fr">Français</option>
                    <option value="de">Deutsch</option>
                    <option value="nl">Nederlands</option>
                </select>
                <p className="text-xs text-gray-500 mt-1.5">
                    {t('apps.builder.language_display_description')}
                </p>
            </div>

            {/* Theme */}
            <div className="mb-4">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('apps.builder.theme')}
                </label>
                <div className="grid grid-cols-2 gap-3">
                    <button
                        type="button"
                        onClick={() => setAppData(prev => ({ ...prev, theme: 'light' }))}
                        className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center ${appData.theme === 'light'
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-[#252941] bg-[#0f1117] hover:border-[#3a4060]'
                            }`}
                    >
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-50 via-blue-50 to-blue-100 rounded-lg border-2 border-blue-200 flex items-center justify-center mb-2">
                            <div className="w-5 h-5 bg-white rounded shadow-sm border border-gray-200" />
                        </div>
                        <span className="text-xs font-medium text-gray-900 dark:text-gray-100">{t('apps.builder.light')}</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setAppData(prev => ({ ...prev, theme: 'dark' }))}
                        className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center ${appData.theme === 'dark'
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-[#252941] bg-[#0f1117] hover:border-[#3a4060]'
                            }`}
                    >
                        <div className="w-10 h-10 bg-gradient-to-br from-[#050608] via-[#0f1520] to-[#1a4a6c] rounded-lg border-2 border-[#2a4060] flex items-center justify-center mb-2">
                            <div className="w-5 h-5 bg-[#151825] rounded border border-[#252941]" />
                        </div>
                        <span className="text-xs font-medium text-gray-900 dark:text-gray-100">{t('apps.builder.dark')}</span>
                    </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                    {t('apps.builder.select_theme_description')}
                </p>
            </div>

            {/* Logo */}
            <div className="mb-4">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    {t('apps.builder.app_logo')}
                </label>
                <ImageUploader
                    onImageSelect={imageData => setAppData(prev => ({ ...prev, logo: imageData }))}
                    currentImage={appData.logo || ''}
                    placeholder={t('apps.builder.click_upload_logo')}
                    aspectRatio="logo"
                />
            </div>

            {/* Banners */}
            <div className="mb-4">
                <div className="flex items-center justify-between mb-3">
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                        {t('apps.builder.app_banners')}
                    </label>
                    <span className="text-sm text-gray-500">{appData.banners.length}/3 banners</span>
                </div>

                <div className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-transparent rounded-lg p-4 mb-4">
                    <div className="grid grid-cols-3 gap-3">
                        {/* Existing banners */}
                        {appData.banners.slice(0, 3).map((banner, index) => (
                            <div key={banner.id} className="relative">
                                <div
                                    onClick={() =>
                                        pickImageFile(imageData =>
                                            openBannerCropModal(imageData, croppedImage =>
                                                onUpdateBanner(banner.id, 'image', croppedImage)
                                            )
                                        )
                                    }
                                    className="cursor-pointer hover:opacity-80 transition-opacity"
                                >
                                    {banner.image ? (
                                        <img
                                            src={banner.image}
                                            alt={`Banner ${index + 1}`}
                                            className="w-full h-20 object-cover rounded-lg"
                                        />
                                    ) : (
                                        <div className="h-20 border-2 border-dashed border-gray-300 dark:border-[#252941] rounded-lg flex items-center justify-center bg-gray-50 dark:bg-[#1a1d2e] hover:border-blue-400 hover:bg-blue-500/10 transition-colors">
                                            <div className="flex flex-col items-center">
                                                <Plus className="w-4 h-4 text-gray-400 mb-1" />
                                                <span className="text-sm text-gray-400">{t('apps.builder.banner_label')} {index + 1}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={() => onRemoveBanner(banner.id)}
                                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 z-10"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        ))}

                        {/* Empty slots */}
                        {Array.from({ length: Math.max(0, 3 - appData.banners.length) }, (_, index) => (
                            <button
                                key={`empty-${index}`}
                                onClick={() =>
                                    pickImageFile(imageData =>
                                        openBannerCropModal(imageData, croppedImage => {
                                            setAppData(prev => ({
                                                ...prev,
                                                banners: [...prev.banners, { id: Date.now(), link: '', image: croppedImage }],
                                            }))
                                        })
                                    )
                                }
                                className="h-20 border-2 border-dashed border-gray-300 dark:border-[#252941] rounded-lg flex items-center justify-center bg-gray-50 dark:bg-[#1a1d2e] hover:border-blue-400 hover:bg-blue-500/10 transition-colors cursor-pointer"
                            >
                                <div className="flex flex-col items-center">
                                    <Plus className="w-4 h-4 text-gray-400 mb-1" />
                                    <span className="text-sm text-gray-400">{t('apps.builder.banner_label')} {appData.banners.length + index + 1}</span>
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* Fallback ImageUploader for banners without image */}
                    {appData.banners.map(
                        (banner, index) =>
                            !banner.image && (
                                <div key={`upload-${banner.id}`} className="mb-4">
                                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        {t('apps.builder.upload_banner')} {index + 1}
                                    </div>
                                    <ImageUploader
                                        onImageSelect={imageData => onUpdateBanner(banner.id, 'image', imageData)}
                                        currentImage={banner.image || ''}
                                        placeholder={`Upload banner ${index + 1}`}
                                        aspectRatio="banner"
                                    />
                                </div>
                            )
                    )}

                    {/* Banner links */}
                    <div className="space-y-3">
                        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('apps.builder.banner_links')}</div>

                        {appData.banners.map((banner, index) => (
                            <div key={banner.id} className="space-y-1">
                                <label className="text-xs text-gray-400">📎 {t('apps.builder.banner_label')} {index + 1} Link</label>
                                <input
                                    type="text"
                                    placeholder={t('apps.builder.add_banner_link_placeholder', { n: index + 1 })}
                                    value={banner.link || ''}
                                    onChange={e => onUpdateBanner(banner.id, 'link', e.target.value)}
                                    className={`w-full px-3 py-2 border rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-[#0f1117] focus:outline-none focus:ring-1 transition-all ${banner.link
                                        ? 'border-blue-500/50 dark:bg-blue-500/10 focus:ring-blue-400/50 focus:border-blue-500'
                                        : 'border-gray-300 dark:border-[#252941]/50 focus:ring-blue-400/50 focus:border-blue-500'
                                        }`}
                                />
                            </div>
                        ))}

                        {/* Extra links */}
                        {appData.extraBannerLinks.map((link, index) => (
                            <div key={`extra-${index}`} className="space-y-1">
                                <label className="text-xs text-gray-400 flex items-center gap-1">
                                    {t('apps.builder.extra_link')} {index + 1}
                                    <span className="text-gray-500">{t('apps.builder.link_only')}</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder={t('apps.builder.add_extra_link_placeholder', { n: index + 1 })}
                                    value={link}
                                    onChange={e => {
                                        const newExtraLinks = [...appData.extraBannerLinks]
                                        newExtraLinks[index] = e.target.value
                                        setAppData(prev => ({ ...prev, extraBannerLinks: newExtraLinks }))
                                    }}
                                    className={`w-full px-3 py-2 border rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-[#0f1117] focus:outline-none focus:ring-1 transition-all ${link
                                        ? 'border-blue-500/50 dark:bg-blue-500/10 focus:ring-blue-400/50 focus:border-blue-500'
                                        : 'border-gray-300 dark:border-[#252941]/50 focus:ring-blue-400/50 focus:border-blue-500'
                                        }`}
                                />
                            </div>
                        ))}

                        {appData.banners.length === 0 && appData.extraBannerLinks.every(l => !l) && (
                            <p className="text-sm text-gray-500 text-center py-4">{t('apps.builder.configure_banner_links')}</p>
                        )}
                    </div>

                    <p className="text-xs text-gray-500 mt-3">{t('apps.builder.banner_recommended_size')}</p>
                </div>

                {/* Support Settings */}
                <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">
                        {t('apps.builder.support_channels')}
                    </h3>

                    {/* Support toggle */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-[#0f1117]/70 rounded-xl border border-gray-200 dark:border-[#1e2139]">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M12 2.25a9.75 9.75 0 11-9.75 9.75A9.75 9.75 0 0112 2.25z"
                                        />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                        {t('apps.builder.support_enabled')}
                                    </p>
                                    <p className="text-xs text-gray-600 mt-1">
                                        {t('apps.builder.support_description')}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setAppData(prev => ({ ...prev, supportEnabled: !prev.supportEnabled }))}
                                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all ${appData.supportEnabled
                                    ? 'bg-gradient-to-r from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20'
                                    : 'bg-gray-300'
                                    }`}
                            >
                                <span
                                    className={`inline-block h-5 w-5 transform rounded-full bg-[#1a1d2e] transition-transform shadow ${appData.supportEnabled ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                />
                            </button>
                        </div>
                    </div>

                    {/* Support fields */}
                    {appData.supportEnabled && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Support Email */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                                        />
                                    </svg>
                                    <span>{t('apps.builder.support_email')}</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type="email"
                                        placeholder="support@example.com"
                                        value={appData.supportEmail}
                                        onChange={e => setAppData(prev => ({ ...prev, supportEmail: e.target.value }))}
                                        className="w-full px-4 py-3 bg-white dark:bg-[#1a1d2e] border border-gray-300 dark:border-[#1e2139] rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-transparent transition-all shadow-sm hover:shadow-md"
                                    />
                                    {appData.supportEmail && (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                            <div className="w-6 h-6 bg-green-50 rounded-full flex items-center justify-center">
                                                <svg className="w-3.5 h-3.5 text-green-600" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path d="M5 13l4 4L19 7" />
                                                </svg>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* WhatsApp */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                    </svg>
                                    <span>{t('apps.builder.whatsapp')}</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type="tel"
                                        placeholder="+1 555 999-9999"
                                        value={appData.whatsappNumber}
                                        onChange={e => setAppData(prev => ({ ...prev, whatsappNumber: e.target.value }))}
                                        className="w-full px-4 py-3 bg-white dark:bg-[#1a1d2e] border border-gray-300 dark:border-[#1e2139] rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-transparent transition-all shadow-sm hover:shadow-md"
                                    />
                                    {appData.whatsappNumber && (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                            <div className="w-6 h-6 bg-green-50 rounded-full flex items-center justify-center">
                                                <svg className="w-3.5 h-3.5 text-green-600" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path d="M5 13l4 4L19 7" />
                                                </svg>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Support disabled state */}
                    {!appData.supportEnabled && (
                        <p className="text-xs text-gray-500 dark:text-gray-600 text-center py-4">
                            {t('apps.builder.enable_support_to_configure')}
                        </p>
                    )}
                </div>

                {/* Save Button */}
                <div className="pt-4 border-t border-gray-200 dark:border-[#1e2139] flex justify-end">
                    <button
                        onClick={onSave}
                        disabled={loading}
                        className="px-5 py-2 text-sm font-medium bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-gray-200 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {loading ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white/60" />
                        ) : null}
                        {t('apps.builder.save_app')}
                    </button>
                </div>
            </div>
        </>
    )
}
