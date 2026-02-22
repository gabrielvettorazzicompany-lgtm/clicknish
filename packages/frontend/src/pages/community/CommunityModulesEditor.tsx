import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
    Plus,
    Edit,
    Trash2,
    GripVertical,
    Save,
    X,
    Image as ImageIcon,
    Video,
    FileText,
    Users,
    Lock,
    Eye
} from 'lucide-react'
import { useI18n } from '@/i18n'

interface CommunityModule {
    id: string
    title: string
    description?: string
    image_url: string
    module_number: string
    type: 'video' | 'article' | 'group' | 'resource'
    is_locked: boolean
    order: number
    badge?: string
    badge_color?: string
    access_type?: 'email-only' | 'email-password' | 'purchase-code'
    offer_type?: 'main' | 'bonus' | 'order-bump' | 'upsell-downsell'
    release_type?: 'immediate' | 'days-after' | 'fixed-date'
    release_days?: number
    release_date?: string
    platform_ids?: string
}

export default function CommunityModulesEditor() {
    const navigate = useNavigate()
    const { communityId } = useParams<{ communityId: string }>()
    const { t } = useI18n()

    const [modules, setModules] = useState<CommunityModule[]>([
        {
            id: '1',
            title: 'Start Here',
            description: 'Introduction to the method',
            image_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400',
            module_number: '01',
            type: 'video',
            is_locked: false,
            order: 1
        },
        {
            id: '2',
            title: 'Networking Group',
            image_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400',
            module_number: '02',
            type: 'group',
            is_locked: false,
            order: 2,
            badge: '🔥',
            badge_color: 'pink'
        }
    ])

    const [showModal, setShowModal] = useState(false)
    const [editingModule, setEditingModule] = useState<CommunityModule | null>(null)
    const [draggedItem, setDraggedItem] = useState<string | null>(null)

    const [formData, setFormData] = useState<Partial<CommunityModule>>({
        title: '',
        description: '',
        image_url: '',
        module_number: '',
        type: 'video',
        is_locked: false,
        badge: '',
        badge_color: 'pink',
        access_type: 'email-only',
        offer_type: 'main',
        release_type: 'immediate',
        release_days: undefined,
        release_date: '',
        platform_ids: ''
    })

    const handleCreateModule = () => {
        setEditingModule(null)
        setFormData({
            title: '',
            description: '',
            image_url: '',
            module_number: `${String(modules.length + 1).padStart(2, '0')}`,
            type: 'video',
            is_locked: false,
            badge: '',
            badge_color: 'pink',
            access_type: 'email-only',
            offer_type: 'main',
            release_type: 'immediate',
            release_days: undefined,
            release_date: '',
            platform_ids: ''
        })
        setShowModal(true)
    }

    const handleEditModule = (module: CommunityModule) => {
        setEditingModule(module)
        setFormData(module)
        setShowModal(true)
    }

    const handleSaveModule = (e: React.FormEvent) => {
        e.preventDefault()

        if (editingModule) {
            // Atualizar módulo existente
            setModules(modules.map(m =>
                m.id === editingModule.id
                    ? { ...m, ...formData } as CommunityModule
                    : m
            ))
        } else {
            // Criar novo módulo
            const newModule: CommunityModule = {
                id: Date.now().toString(),
                ...formData,
                order: modules.length + 1
            } as CommunityModule

            setModules([...modules, newModule])
        }

        setShowModal(false)
        setEditingModule(null)
    }

    const handleDeleteModule = (id: string) => {
        if (confirm(t('community.confirm_delete_module'))) {
            setModules(modules.filter(m => m.id !== id))
        }
    }

    const handleDragStart = (id: string) => {
        setDraggedItem(id)
    }

    const handleDragOver = (e: React.DragEvent, targetId: string) => {
        e.preventDefault()
        if (!draggedItem || draggedItem === targetId) return

        const draggedIndex = modules.findIndex(m => m.id === draggedItem)
        const targetIndex = modules.findIndex(m => m.id === targetId)

        const newModules = [...modules]
        const [removed] = newModules.splice(draggedIndex, 1)
        newModules.splice(targetIndex, 0, removed)

        // Atualizar order
        newModules.forEach((m, idx) => m.order = idx + 1)
        setModules(newModules)
    }

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'video': return <Video size={16} />
            case 'article': return <FileText size={16} />
            case 'group': return <Users size={16} />
            case 'resource': return <ImageIcon size={16} />
            default: return <FileText size={16} />
        }
    }

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'video': return 'Video'
            case 'article': return 'Article'
            case 'group': return 'Group'
            case 'resource': return 'Resource'
            default: return type
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gradient-to-r dark:from-blue-500 dark:to-blue-600">
            {/* Header */}
            <header className="bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800 px-6 py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                            {t('community.module_editor')}
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 text-sm">
                            {t('community.configure_cards')}
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => navigate(-1)}
                            className="px-4 py-2 bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            onClick={() => alert(t('common.success'))}
                            className="px-6 py-2 bg-gradient-to-r from-pink-600 to-blue-600 text-white rounded-lg hover:from-pink-700 hover:to-blue-700 transition-colors flex items-center gap-2"
                        >
                            <Save size={20} />
                            {t('community.save_changes')}
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto p-6">
                {/* Add Module Button */}
                <div className="mb-6">
                    <button
                        onClick={handleCreateModule}
                        className="bg-gradient-to-r from-pink-600 to-blue-600 text-white px-6 py-3 rounded-lg hover:from-pink-700 hover:to-blue-700 transition-all flex items-center gap-2 shadow-xl shadow-black/10 shadow-pink-500/50"
                    >
                        <Plus size={20} />
                        {t('community.add_module')}
                    </button>
                </div>

                {/* Modules Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {modules.sort((a, b) => a.order - b.order).map((module) => (
                        <div
                            key={module.id}
                            draggable
                            onDragStart={() => handleDragStart(module.id)}
                            onDragOver={(e) => handleDragOver(e, module.id)}
                            className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden hover:border-pink-500 transition-all cursor-move group"
                        >
                            {/* Drag Handle */}
                            <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-2 flex items-center justify-between border-b border-gray-700">
                                <div className="flex items-center gap-3">
                                    <GripVertical size={18} className="text-gray-500" />
                                    <span className="text-gray-400 text-sm font-mono">
                                        MODULE {module.module_number}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {module.is_locked && (
                                        <Lock size={14} className="text-yellow-500" />
                                    )}
                                    <span className="text-xs px-2 py-1 bg-gray-700 text-gray-300 rounded flex items-center gap-1">
                                        {getTypeIcon(module.type)}
                                        {getTypeLabel(module.type)}
                                    </span>
                                </div>
                            </div>

                            {/* Module Image */}
                            <div className="relative h-48 bg-gradient-to-br from-pink-500 to-blue-600">
                                <img
                                    src={module.image_url}
                                    alt={module.title}
                                    className="w-full h-full object-cover"
                                />

                                {/* Badge */}
                                {module.badge && (
                                    <div className={`absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-bold bg-${module.badge_color}-500 text-white`}>
                                        {module.badge}
                                    </div>
                                )}

                                {/* Overlay on Hover */}
                                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 transition-all flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
                                    <button
                                        onClick={() => handleEditModule(module)}
                                        className="p-3 bg-[#1a1d2e] text-gray-100 rounded-lg hover:bg-[#252941] transition-colors"
                                    >
                                        <Edit size={20} />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteModule(module.id)}
                                        className="p-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                            </div>

                            {/* Module Info */}
                            <div className="p-4">
                                <h3 className="text-white font-semibold text-lg mb-2">
                                    {module.title}
                                </h3>
                                {module.description && (
                                    <p className="text-gray-400 text-sm line-clamp-2">
                                        {module.description}
                                    </p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Empty State */}
                {modules.length === 0 && (
                    <div className="text-center py-20">
                        <div className="w-20 h-20 bg-gray-200 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                            <ImageIcon className="text-gray-500" size={40} />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                            {t('community.no_modules')}
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                            {t('community.create_first_module')}
                        </p>
                        <button
                            onClick={handleCreateModule}
                            className="bg-gradient-to-r from-pink-600 to-blue-600 text-white px-6 py-3 rounded-lg hover:from-pink-700 hover:to-blue-700 transition-all"
                        >
                            {t('community.add_module')}
                        </button>
                    </div>
                )}
            </main>

            {/* Modal de Criação/Edição */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700">
                        {/* Modal Header */}
                        <div className="flex justify-between items-center p-6 border-b border-gray-700">
                            <h2 className="text-xl font-semibold text-white">
                                {editingModule ? t('community.edit_module') : t('community.add_module')}
                            </h2>
                            <button
                                onClick={() => setShowModal(false)}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleSaveModule} className="p-6 space-y-5">
                            {/* Module Number & Type */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        {t('community.module_number')}
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.module_number}
                                        onChange={(e) => setFormData({ ...formData, module_number: e.target.value })}
                                        className="w-full p-3 bg-[#0f1117] border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white"
                                        placeholder="01"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        {t('community.content_type')}
                                    </label>
                                    <select
                                        value={formData.type}
                                        onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                                        className="w-full p-3 bg-[#0f1117] border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white"
                                    >
                                        <option value="video">Video</option>
                                        <option value="article">Article</option>
                                        <option value="group">Group</option>
                                        <option value="resource">Resource</option>
                                    </select>
                                </div>
                            </div>

                            {/* Title */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    {t('community.module_title')}
                                </label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full p-3 bg-[#0f1117] border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white"
                                    placeholder="Ex: Start Here"
                                    required
                                />
                            </div>

                            {/* Access Type */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Access Type *
                                </label>
                                <select
                                    value={formData.access_type}
                                    onChange={(e) => setFormData({ ...formData, access_type: e.target.value as any })}
                                    className="w-full p-3 bg-[#0f1117] border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white"
                                >
                                    <option value="email-only">Email Only</option>
                                    <option value="email-password">Email + Password</option>
                                    <option value="purchase-code">Purchase Code</option>
                                </select>
                                <p className="text-xs text-gray-500 mt-1">
                                    How customers will access this product
                                </p>
                            </div>

                            {/* Release Type */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Release Type *
                                </label>
                                <select
                                    value={formData.release_type}
                                    onChange={(e) => setFormData({ ...formData, release_type: e.target.value as any })}
                                    className="w-full p-3 bg-[#0f1117] border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white"
                                >
                                    <option value="immediate">Immediate Release</option>
                                    <option value="days-after">Days after Purchase</option>
                                    <option value="fixed-date">Fixed Date</option>
                                </select>
                            </div>

                            {/* Release Days - Conditional */}
                            {formData.release_type === 'days-after' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Days after Purchase *
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="365"
                                        value={formData.release_days || ''}
                                        onChange={(e) => setFormData({ ...formData, release_days: parseInt(e.target.value) || undefined })}
                                        placeholder="Enter number of days"
                                        className="w-full p-3 bg-[#0f1117] border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Content will be released after this many days from purchase
                                    </p>
                                </div>
                            )}

                            {/* Release Date - Conditional */}
                            {formData.release_type === 'fixed-date' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Release Date *
                                    </label>
                                    <input
                                        type="date"
                                        lang="en-US"
                                        value={formData.release_date || ''}
                                        onChange={(e) => setFormData({ ...formData, release_date: e.target.value })}
                                        min={new Date().toISOString().split('T')[0]}
                                        className="w-full p-3 bg-[#0f1117] border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Content will be released on this specific date
                                    </p>
                                </div>
                            )}

                            {/* Offer Type */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Offer Type *
                                </label>
                                <select
                                    value={formData.offer_type}
                                    onChange={(e) => setFormData({ ...formData, offer_type: e.target.value as any })}
                                    className="w-full p-3 bg-[#0f1117] border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white"
                                >
                                    <option value="main">Main Product</option>
                                    <option value="bonus">Bonus</option>
                                    <option value="order-bump">Order Bump</option>
                                    <option value="upsell-downsell">Upsell/Downsell</option>
                                </select>
                            </div>

                            {/* Platform IDs */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Platform Product IDs (Optional)
                                    <a
                                        href="/product-id-guide"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-400 hover:underline ml-2"
                                    >
                                        How to get the ID?
                                    </a>
                                </label>
                                <input
                                    type="text"
                                    value={formData.platform_ids || ''}
                                    onChange={(e) => setFormData({ ...formData, platform_ids: e.target.value })}
                                    placeholder="Ex: hotmart123, kiwify456"
                                    className="w-full p-3 bg-[#0f1117] border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white"
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    {t('community.description')} ({t('community.optional')})
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    rows={3}
                                    className="w-full p-3 bg-[#0f1117] border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white"
                                    placeholder="Brief description of the module"
                                />
                            </div>

                            {/* Image URL */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    {t('community.thumbnail')}
                                </label>
                                <input
                                    type="url"
                                    value={formData.image_url}
                                    onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                                    className="w-full p-3 bg-[#0f1117] border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white"
                                    placeholder="https://example.com/image.jpg"
                                    required
                                />
                                {formData.image_url && (
                                    <div className="mt-3 rounded-lg overflow-hidden border border-gray-700">
                                        <img
                                            src={formData.image_url}
                                            alt="Preview"
                                            className="w-full h-48 object-cover"
                                            onError={(e) => {
                                                e.currentTarget.src = 'https://via.placeholder.com/400x300?text=Invalid+Image'
                                            }}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Badge & Color */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Badge (Optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.badge}
                                        onChange={(e) => setFormData({ ...formData, badge: e.target.value })}
                                        className="w-full p-3 bg-[#0f1117] border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white"
                                        placeholder="🔥 or MILLIONAIRE"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Badge Color
                                    </label>
                                    <select
                                        value={formData.badge_color}
                                        onChange={(e) => setFormData({ ...formData, badge_color: e.target.value })}
                                        className="w-full p-3 bg-[#0f1117] border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white"
                                    >
                                        <option value="pink">Pink</option>
                                        <option value="purple">Purple</option>
                                        <option value="blue">Blue</option>
                                        <option value="green">Green</option>
                                        <option value="red">Red</option>
                                    </select>
                                </div>
                            </div>

                            {/* Is Locked */}
                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    id="is_locked"
                                    checked={formData.is_locked}
                                    onChange={(e) => setFormData({ ...formData, is_locked: e.target.checked })}
                                    className="w-5 h-5 text-blue-600 border-gray-600 rounded focus:ring-blue-500"
                                />
                                <label htmlFor="is_locked" className="text-gray-300 flex items-center gap-2">
                                    <Lock size={18} />
                                    {t('community.locked_module')}
                                </label>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-6 py-3 border border-[#252941] text-gray-300 rounded-lg hover:bg-[#252941] transition-colors"
                                >
                                    {t('common.cancel')}
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                                >
                                    {editingModule ? t('community.update_module') : t('community.add_module')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
