import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Bell, ExternalLink, Clock, ArrowLeft } from 'lucide-react'

interface UserNotification {
  id: string
  app_id: string
  title: string
  message: string
  redirect_url?: string
  received_at: string
  is_read: boolean
}

export default function NotificationsFeed() {
  const { appId } = useParams()
  const [notifications, setNotifications] = useState<UserNotification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUserNotifications()
  }, [appId])

  const fetchUserNotifications = async () => {
    try {
      setLoading(true)

      // TODO: Implement real API call to fetch notifications
      // For now, show empty state
      setNotifications([])
    } catch (error) {
      console.error('Error fetching user notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (notificationId: string) => {
    setNotifications(prev => prev.map(notification =>
      notification.id === notificationId
        ? { ...notification, is_read: true }
        : notification
    ))

    // Aqui você faria a chamada para a API
    // await markNotificationAsRead(notificationId)
  }

  const handleNotificationClick = (notification: UserNotification) => {
    if (!notification.is_read) {
      markAsRead(notification.id)
    }

    if (notification.redirect_url) {
      // Redirecionar para a URL especificada
      window.location.href = notification.redirect_url
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffHours / 24)

    if (diffDays === 0) {
      if (diffHours === 0) return 'Now'
      return `${diffHours}h ago`
    } else if (diffDays === 1) {
      return 'Yesterday'
    } else if (diffDays < 7) {
      return `${diffDays}d ago`
    } else {
      return date.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short'
      })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading notifications...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0f1117]">
      {/* Header */}
      <div className="bg-[#1a1d2e] sticky top-0 z-10 border-b border-[#1e2139]">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => window.history.back()}
                className="p-2 hover:bg-[#252941] rounded-full transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="font-bold text-gray-100">Notifications</h1>
                <p className="text-sm text-gray-500">
                  {notifications.filter(n => !n.is_read).length} unread
                </p>
              </div>
            </div>
            <div className="w-8 h-8 bg-[#252941] rounded-full flex items-center justify-center">
              <Bell className="w-4 h-4 text-gray-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="max-w-2xl mx-auto pb-20">
        {notifications.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-[#252941] rounded-full flex items-center justify-center mx-auto mb-4">
              <Bell className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500">No notifications yet.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {notifications.map(notification => (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`bg-[#1a1d2e] border-b border-gray-100 p-4 cursor-pointer hover:bg-[#0f1117] transition-colors ${!notification.is_read ? 'bg-blue-500/10/30 border-l-4 border-l-blue-500' : ''
                  }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${!notification.is_read
                      ? 'bg-blue-500 text-white'
                      : 'bg-[#252941] text-gray-600'
                    }`}>
                    <Bell className="w-5 h-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-1">
                      <h3 className={`font-semibold text-sm ${!notification.is_read ? 'text-gray-100' : 'text-gray-300'
                        }`}>
                        {notification.title}
                        {!notification.is_read && (
                          <span className="ml-2 w-2 h-2 bg-blue-500 rounded-full inline-block"></span>
                        )}
                      </h3>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        {formatDate(notification.received_at)}
                      </div>
                    </div>

                    <p className={`text-sm leading-relaxed mb-2 ${!notification.is_read ? 'text-gray-200' : 'text-gray-600'
                      }`}>
                      {notification.message}
                    </p>

                    {notification.redirect_url && (
                      <div className="flex items-center gap-1 text-blue-400 text-xs">
                        <ExternalLink className="w-3 h-3" />
                        <span>Toque para abrir</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Mark All as Read */}
        {notifications.some(n => !n.is_read) && (
          <div className="p-4 text-center">
            <button
              onClick={() => {
                setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
              }}
              className="text-blue-400 hover:text-blue-700 font-medium text-sm"
            >
              Mark all as read
            </button>
          </div>
        )}
      </div>
    </div>
  )
}