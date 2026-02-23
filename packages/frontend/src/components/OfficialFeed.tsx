import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Heart, MessageCircle, Share, Clock, Bell } from 'lucide-react'

interface FeedPost {
  id: string
  app_id: string
  content: string
  image_url?: string
  published_at: string
  likes_count: number
  comments_count: number
  user_liked?: boolean
  is_official: boolean
}

export default function OfficialFeed() {
  const { appId } = useParams()
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchOfficialPosts()
  }, [appId])

  const fetchOfficialPosts = async () => {
    try {
      setLoading(true)



      // Buscar posts do backend
      const response = await fetch(`https://app.clicknich.com/api/applications/${appId}/feed/posts`)



      if (response.ok) {
        const data = await response.json()

        const formattedPosts = data
          .filter((post: any) => post.status === 'published')
          .map((post: any) => ({
            id: post.id,
            application_id: post.application_id,
            content: post.content,
            image_url: post.image_url,
            published_at: post.published_at || post.created_at,
            likes_count: 0,
            comments_count: 0,
            user_liked: false,
            is_official: true
          }))

        setPosts(formattedPosts)
      } else {
        console.error('Failed to fetch feed posts')
        setPosts([])
      }
    } catch (error) {
      console.error('Error fetching official posts:', error)
      setPosts([])
    } finally {
      setLoading(false)
    }
  }

  const toggleLike = async (postId: string) => {
    setPosts(prev => prev.map(post => {
      if (post.id === postId) {
        const newLiked = !post.user_liked
        return {
          ...post,
          user_liked: newLiked,
          likes_count: newLiked ? post.likes_count + 1 : post.likes_count - 1
        }
      }
      return post
    }))
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
          <p className="text-gray-600">Loading updates...</p>
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
            <div>
              <h1 className="font-bold text-gray-100">Official Feed</h1>
              <p className="text-sm text-gray-500">Important news and updates</p>
            </div>
            <button className="w-8 h-8 bg-[#252941] rounded-full flex items-center justify-center">
              <Bell className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Posts Feed */}
      <div className="max-w-2xl mx-auto pb-20">
        {posts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No updates yet.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {posts.map(post => (
              <div key={post.id} className="bg-[#1a1d2e] border-b border-gray-100">
                {/* Post Header */}
                <div className="flex items-center gap-3 p-4 pb-3">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-700 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-lg">📢</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-gray-100 text-sm">
                        Official Team
                      </h4>
                      <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                        Official
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(post.published_at)}
                    </p>
                  </div>
                </div>

                {/* Post Content */}
                <div className="px-4 pb-3">
                  <div
                    className="text-gray-100 text-sm leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: post.content }}
                  />

                  {post.image_url && (
                    <div className="mt-4 -mx-4">
                      <img
                        src={post.image_url}
                        alt="Post content"
                        className="w-full object-cover max-h-80"
                        loading="lazy"
                      />
                    </div>
                  )}
                </div>

                {/* Post Actions */}
                <div className="px-4 py-3 border-t border-gray-50 bg-[#0f1117]/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <button
                        onClick={() => toggleLike(post.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-full transition-colors ${post.user_liked
                          ? 'bg-red-50 text-red-600 hover:bg-red-100'
                          : 'bg-[#252941] text-gray-600 hover:bg-[#252941]'
                          }`}
                      >
                        <Heart
                          className={`w-4 h-4 ${post.user_liked ? 'fill-current' : ''}`}
                        />
                        <span className="text-sm font-medium">
                          {post.likes_count}
                        </span>
                      </button>

                      <button className="flex items-center gap-2 px-3 py-2 bg-[#252941] text-gray-600 rounded-full hover:bg-[#252941] transition-colors">
                        <MessageCircle className="w-4 h-4" />
                        <span className="text-sm font-medium">
                          {post.comments_count}
                        </span>
                      </button>

                      <button className="flex items-center gap-2 px-3 py-2 bg-[#252941] text-gray-600 rounded-full hover:bg-[#252941] transition-colors">
                        <Share className="w-4 h-4" />
                        <span className="text-sm font-medium">
                          Share
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Load More Button */}
        {posts.length > 0 && (
          <div className="p-4 text-center">
            <button className="text-blue-400 hover:text-blue-700 font-medium text-sm">
              Load more posts
            </button>
          </div>
        )}
      </div>
    </div>
  )
}