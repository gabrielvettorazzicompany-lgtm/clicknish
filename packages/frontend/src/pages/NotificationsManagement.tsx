import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Bell, Send, X } from 'lucide-react'
import { useI18n } from '@/i18n'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'

const EDGE_FUNCTION_URL = 'https://api.clicknich.com/api'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZXF0b2RiaXNnd3Zoa2FhaGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTk1MDIsImV4cCI6MjA4NDY5NTUwMn0.Ov6_rRlThZUBIoL4oT6BGozEhvTUdFsWB6KylDXpFoY'

interface Notification {
  id: string
  application_id: string
  title: string
  message: string
  sent_at: string
  created_at: string
}

interface App {
  id: string
  name: string
}

export default function NotificationsManagement({ embedded = false }: { embedded?: boolean }) {
  const { t } = useI18n()
  const { appId } = useParams()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [app, setApp] = useState<App | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)

  // Form state
  const [notificationForm, setNotificationForm] = useState({
    title: '',
    message: ''
  })

  useEffect(() => {
    if (appId) {
      fetchApp()
      fetchNotifications()
    }
  }, [appId])

  const fetchApp = async () => {
    try {
      const response = await fetch(`${EDGE_FUNCTION_URL}/applications/${appId}`, {
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setApp(data)
      }
    } catch (error) {
      console.error('Error fetching app:', error)
    }
  }

  const fetchNotifications = async () => {
    try {
      const response = await fetch(`${EDGE_FUNCTION_URL}/applications/${appId}/notifications?admin=true`, {
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setNotifications(data)
      } else {
        setNotifications([])
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
      setNotifications([])
    }
  }

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch(`${EDGE_FUNCTION_URL}/applications/${appId}/notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          title: notificationForm.title,
          message: notificationForm.message
        }),
      })

      if (response.ok) {
        const result = await response.json()
        setNotificationForm({ title: '', message: '' })
        setShowModal(false)
        alert(`Notification sent successfully!`)
        fetchNotifications()
      } else {
        const error = await response.json()
        alert(`Error sending notification: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error sending notification:', error)
      alert('Error sending notification')
    } finally {
      setLoading(false)
    }
  }

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className={embedded ? "flex-1 flex flex-col" : "min-h-screen bg-[#0f1117] flex"}>
      {!embedded && <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />}

      <div className="flex-1 flex flex-col min-w-0">
        {!embedded && <Header onMenuClick={() => setSidebarOpen(true)} />}

        {/* Navbar Tabs - Fixo abaixo do header */}
        {!embedded && (
          <div className="bg-[#0f1117] border-b border-[#1e2139] mt-12 sticky top-12 z-[60]">
            <div className="flex items-center gap-6 px-6">
              <button
                onClick={() => navigate(-1)}
                className="py-2 text-xs font-medium border-b-2 border-blue-400 text-blue-400 flex items-center gap-2"
              >
                <ArrowLeft size={14} />
                {t('notifications_management.title')}
              </button>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 lg:px-6 py-6">
            {/* Page Actions */}
            <div className="flex justify-end mb-4">
              <button
                onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                {t('notifications_management.create')}
              </button>
            </div>

            {/* Main Content */}
            {notifications.length === 0 ? (
              /* Empty State */
              <div className="bg-[#1a1d2e] rounded-lg border border-[#1e2139] px-8 py-10 text-center">
                <h2 className="text-sm font-semibold text-gray-100 mb-1">
                  {t('notifications_management.no_notifications')}
                </h2>
                <p className="text-xs text-gray-500 mb-5">
                  Envie uma notificação push para todos os usuários do seu app.
                </p>

                <button
                  onClick={() => setShowModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-gray-200 rounded-lg text-xs font-medium transition-all"
                >
                  <Send className="w-3 h-3" />
                  {t('notifications_management.create')}
                </button>
              </div>
            ) : (
              /* Notifications List */
              <div className="bg-[#1a1d2e] rounded-lg shadow-lg shadow-black/10 border border-[#1e2139] overflow-hidden">
                <div className="p-4 border-b border-[#1e2139]">
                  <h2 className="text-sm font-semibold text-gray-100">
                    Notification History ({notifications.length})
                  </h2>
                  <p className="text-xs text-gray-600 mt-0.5">
                    Notifications sent to {app?.name} app users
                  </p>
                </div>

                <div className="divide-y divide-[#1e2139]">
                  {notifications.map(notification => (
                    <div key={notification.id} className="p-4 hover:bg-[#0f1117]/50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1.5">
                            <h3 className="font-medium text-sm text-gray-100">{notification.title}</h3>
                            <span className="bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded text-[10px] font-medium">
                              {t('notifications_management.sent')}
                            </span>
                          </div>

                          <p className="text-gray-300 text-xs mb-2">{notification.message}</p>

                          <div className="flex items-center gap-3 text-[10px] text-gray-500">
                            <span>📅 {formatDateTime(notification.sent_at)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Modal Nova Notificação */}
          {showModal && (
            <div className="fixed inset-0 bg-black/70 z-[70] flex items-center justify-center p-4">
              <div className="bg-gradient-to-b from-[#1a2035] to-[#151825] border border-[#2a4060] rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-[#2a4060]">
                  <h2 className="text-sm font-semibold text-gray-100">{t('notifications_management.create')}</h2>
                  <button
                    onClick={() => setShowModal(false)}
                    className="p-1.5 hover:bg-[#252941] rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4 text-gray-400 hover:text-white" />
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[400px]">
                  {/* Preview Section */}
                  <div className="p-4 bg-[#0f1117] border-r border-[#2a4060]">
                    <h3 className="text-xs font-medium text-gray-300 mb-3">{t('funnel_editor.preview')}:</h3>

                    <div className="bg-[#1a1d2e] rounded-lg shadow-lg border border-[#1e2139] p-3 max-w-sm mx-auto">
                      <div className="flex items-start gap-2">
                        <div className="w-7 h-7 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Bell className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-100 text-xs">
                            {notificationForm.title || t('notifications_management.notification_title')}
                          </h4>
                          <p className="text-gray-500 text-xs mt-0.5">
                            {notificationForm.message || t('notifications_management.message')}
                          </p>
                          <p className="text-[10px] text-gray-500 mt-1.5">Now</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Form Section */}
                  <div className="p-4">
                    <form onSubmit={handleSendNotification} className="space-y-4">
                      {/* Title */}
                      <div>
                        <label className="block text-xs font-medium text-gray-300 mb-1">
                          {t('notifications_management.notification_title')} <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={notificationForm.title}
                          onChange={(e) => setNotificationForm(prev => ({ ...prev, title: e.target.value }))}
                          onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Please fill out this field.')}
                          onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                          placeholder={t('notifications_management.notification_title')}
                          className="w-full px-3 py-2 bg-[#0f1117] text-gray-200 text-sm border border-[#252941] rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400/50 focus:border-blue-500"
                          required
                        />
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          The title will appear highlighted in the notification
                        </p>
                      </div>

                      {/* Message */}
                      <div>
                        <label className="block text-xs font-medium text-gray-300 mb-1">
                          {t('notifications_management.message')} <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          value={notificationForm.message}
                          onChange={(e) => setNotificationForm(prev => ({ ...prev, message: e.target.value }))}
                          onInvalid={(e) => (e.target as HTMLTextAreaElement).setCustomValidity('Please fill out this field.')}
                          onInput={(e) => (e.target as HTMLTextAreaElement).setCustomValidity('')}
                          placeholder={t('notifications_management.message')}
                          rows={3}
                          className="w-full px-3 py-2 bg-[#0f1117] text-gray-200 text-sm border border-[#252941] rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400/50 focus:border-blue-500"
                          required
                        />
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          The message will be displayed below the title
                        </p>
                      </div>

                      <div className="pt-3 border-t border-[#2a4060]">
                        <p className="text-xs text-gray-500 mb-4">
                          This notification will be sent to the devices.
                        </p>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setShowModal(false)}
                            className="flex-1 px-4 py-2 border border-[#3a3f5c] text-gray-300 rounded-lg text-xs font-medium hover:bg-[#252941] transition-colors"
                          >
                            {t('common.cancel')}
                          </button>
                          <button
                            type="submit"
                            disabled={loading || !notificationForm.title || !notificationForm.message}
                            className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                          >
                            <Send className="w-3.5 h-3.5" />
                            {loading ? t('notifications_management.sending') : t('notifications_management.send_now')}
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

    </div >

  )
}