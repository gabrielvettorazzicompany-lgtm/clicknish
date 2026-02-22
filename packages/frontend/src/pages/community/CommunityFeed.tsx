import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/services/supabase'
import { useI18n } from '@/i18n'
import { ArrowLeft, MessageCircle, Heart, Send, MoreHorizontal, Edit2, Trash2, Image, X, Check, Plus } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'

interface Post {
  id: string
  content: string
  image_url: string | null
  created_at: string
  likes_count: number
  comments_count: number
  user_id: string
  user_name: string
  user_avatar: string | null
  liked_by_me: boolean
}

interface Comment {
  id: string
  content: string
  created_at: string
  user_id: string
  user_name: string
  user_avatar: string | null
}

export default function CommunityFeed({ embedded = false }: { embedded?: boolean }) {
  const { appId } = useParams()
  const navigate = useNavigate()
  const { t } = useI18n()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [showComments, setShowComments] = useState<string | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [loadingComments, setLoadingComments] = useState(false)
  const [submittingComment, setSubmittingComment] = useState(false)
  const [showPostMenu, setShowPostMenu] = useState<string | null>(null)
  const [editingPost, setEditingPost] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newPostContent, setNewPostContent] = useState('')
  const [newPostImage, setNewPostImage] = useState<File | null>(null)
  const [newPostImagePreview, setNewPostImagePreview] = useState<string | null>(null)
  const [creatingPost, setCreatingPost] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (appId) {
      fetchPosts()
    }
  }, [appId])

  const fetchPosts = async () => {
    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      const userId = session?.user?.id

      const { data, error } = await supabase
        .from('community_posts')
        .select(`
          id,
          content,
          image_url,
          created_at,
          likes_count,
          comments_count,
          author_name,
          author_avatar
        `)
        .eq('application_id', appId)
        .order('created_at', { ascending: false })

      if (error) throw error

      let likedPosts: string[] = []
      if (userId) {
        const { data: likes } = await supabase
          .from('community_likes')
          .select('post_id')
          .eq('user_id', userId)

        likedPosts = likes?.map((l: any) => l.post_id) || []
      }

      const formattedPosts: Post[] = (data || []).map((post: any) => ({
        id: post.id,
        content: post.content,
        image_url: post.image_url,
        created_at: post.created_at,
        likes_count: post.likes_count || 0,
        comments_count: post.comments_count || 0,
        user_id: '',
        user_name: post.author_name || 'User',
        user_avatar: post.author_avatar,
        liked_by_me: likedPosts.includes(post.id)
      }))

      setPosts(formattedPosts)
    } catch (error) {
      console.error('Error fetching posts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLike = async (postId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      const post = posts.find(p => p.id === postId)
      if (!post) return

      if (post.liked_by_me) {
        await supabase
          .from('community_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', session.user.id)

        await supabase
          .from('community_posts')
          .update({ likes_count: post.likes_count - 1 })
          .eq('id', postId)

        setPosts(posts.map(p =>
          p.id === postId
            ? { ...p, likes_count: p.likes_count - 1, liked_by_me: false }
            : p
        ))
      } else {
        await supabase
          .from('community_likes')
          .insert({ post_id: postId, user_id: session.user.id })

        await supabase
          .from('community_posts')
          .update({ likes_count: post.likes_count + 1 })
          .eq('id', postId)

        setPosts(posts.map(p =>
          p.id === postId
            ? { ...p, likes_count: p.likes_count + 1, liked_by_me: true }
            : p
        ))
      }
    } catch (error) {
      console.error('Error toggling like:', error)
    }
  }

  const fetchComments = async (postId: string) => {
    try {
      setLoadingComments(true)
      const { data, error } = await supabase
        .from('community_comments')
        .select(`
          id,
          content,
          created_at,
          user_id
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: true })

      if (error) throw error

      // Fetch profiles for each unique user_id
      const userIds = [...new Set((data || []).map((c: any) => c.user_id))]
      const { data: profiles } = await supabase
        .from('admin_profiles')
        .select('user_id, full_name, avatar_path')
        .in('user_id', userIds)

      const profileMap: Record<string, { full_name: string; avatar_path: string | null }> = {}
      profiles?.forEach((p: any) => {
        profileMap[p.user_id] = { full_name: p.full_name, avatar_path: p.avatar_path }
      })

      const formattedComments: Comment[] = await Promise.all((data || []).map(async (comment: any) => {
        const profile = profileMap[comment.user_id]
        let avatarUrl = null

        if (profile?.avatar_path && !profile.avatar_path.startsWith('http')) {
          const { data: urlData } = supabase.storage
            .from('avatars')
            .getPublicUrl(profile.avatar_path)
          avatarUrl = urlData?.publicUrl || null
        } else if (profile?.avatar_path) {
          avatarUrl = profile.avatar_path
        }

        return {
          id: comment.id,
          content: comment.content,
          created_at: comment.created_at,
          user_id: comment.user_id,
          user_name: profile?.full_name || 'User',
          user_avatar: avatarUrl
        }
      }))

      setComments(formattedComments)
    } catch (error) {
      console.error('Error fetching comments:', error)
    } finally {
      setLoadingComments(false)
    }
  }

  const handleShowComments = (postId: string) => {
    if (showComments === postId) {
      setShowComments(null)
      setComments([])
    } else {
      setShowComments(postId)
      fetchComments(postId)
    }
  }

  const handleSubmitComment = async (postId: string) => {
    if (!newComment.trim()) return

    try {
      setSubmittingComment(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      const { error } = await supabase
        .from('community_comments')
        .insert({
          post_id: postId,
          user_id: session.user.id,
          content: newComment.trim()
        })

      if (error) throw error

      await supabase
        .from('community_posts')
        .update({ comments_count: posts.find(p => p.id === postId)!.comments_count + 1 })
        .eq('id', postId)

      setPosts(posts.map(p =>
        p.id === postId
          ? { ...p, comments_count: p.comments_count + 1 }
          : p
      ))

      setNewComment('')
      fetchComments(postId)
    } catch (error) {
      console.error('Error submitting comment:', error)
    } finally {
      setSubmittingComment(false)
    }
  }

  const handleDeletePost = async (postId: string) => {
    if (!confirm(t('community.confirm_delete_post'))) return

    try {
      const { error } = await supabase
        .from('community_posts')
        .delete()
        .eq('id', postId)

      if (error) throw error

      setPosts(posts.filter(p => p.id !== postId))
      setShowPostMenu(null)
    } catch (error) {
      console.error('Error deleting post:', error)
    }
  }

  const handleEditPost = async (postId: string) => {
    if (!editContent.trim()) return

    try {
      const { error } = await supabase
        .from('community_posts')
        .update({ content: editContent.trim() })
        .eq('id', postId)

      if (error) throw error

      setPosts(posts.map(p =>
        p.id === postId
          ? { ...p, content: editContent.trim() }
          : p
      ))
      setEditingPost(null)
      setEditContent('')
    } catch (error) {
      console.error('Error editing post:', error)
    }
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setNewPostImage(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setNewPostImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleCreatePost = async () => {
    if (!newPostContent.trim()) return

    try {
      setCreatingPost(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      let imageUrl = null
      if (newPostImage) {
        const fileExt = newPostImage.name.split('.').pop()
        const fileName = `${Date.now()}.${fileExt}`
        const filePath = `community/${appId}/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('community-images')
          .upload(filePath, newPostImage)

        if (uploadError) throw uploadError

        const { data: urlData } = supabase.storage
          .from('community-images')
          .getPublicUrl(filePath)

        imageUrl = urlData.publicUrl
      }

      // Get admin profile for author info
      const { data: profile } = await supabase
        .from('admin_profiles')
        .select('full_name, avatar_path')
        .eq('user_id', session.user.id)
        .single()

      // Convert avatar_path to public URL if needed
      let authorAvatar = null
      if (profile?.avatar_path) {
        if (profile.avatar_path.startsWith('http')) {
          authorAvatar = profile.avatar_path
        } else {
          const { data: urlData } = supabase.storage
            .from('avatars')
            .getPublicUrl(profile.avatar_path)
          authorAvatar = urlData?.publicUrl || null
        }
      }

      const { error } = await supabase
        .from('community_posts')
        .insert({
          application_id: appId,
          author_name: profile?.full_name || session.user.email?.split('@')[0] || 'Admin',
          author_email: session.user.email,
          author_avatar: authorAvatar,
          content: newPostContent.trim(),
          image_url: imageUrl
        })

      if (error) throw error

      setShowCreateModal(false)
      setNewPostContent('')
      setNewPostImage(null)
      setNewPostImagePreview(null)
      fetchPosts()
    } catch (error) {
      console.error('Error creating post:', error)
    } finally {
      setCreatingPost(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  return (
    <div className={embedded ? "flex-1 flex flex-col" : "min-h-screen bg-gray-50 dark:bg-[#0f1117] flex transition-colors duration-200"}>
      {!embedded && <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />}

      <div className="flex-1 flex flex-col min-w-0">
        {!embedded && <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />}

        {/* Navbar Tabs */}
        {!embedded && (
          <div className="bg-[#0f1117] border-b border-[#1e2139] mt-12 sticky top-12 z-[60]">
            <div className="flex items-center justify-between px-6">
              <button
                onClick={() => navigate('/products')}
                className="py-2 text-xs font-medium border-b-2 border-blue-400 text-blue-400 flex items-center gap-2"
              >
                <ArrowLeft size={14} />
                {t('community.feed')}
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                {t('community.new_post')}
              </button>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 py-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : posts.length === 0 ? (
              <div className="text-center py-12">
                <MessageCircle className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">{t('community.no_posts')}</p>
                <p className="text-gray-500 text-xs mt-1">{t('community.be_first')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {posts.map(post => (
                  <div key={post.id} className="bg-[#1a1d2e] rounded-lg border border-gray-700/50 overflow-hidden">
                    {/* Post Header */}
                    <div className="flex items-center justify-between p-3 pb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-medium">
                          {post.user_avatar ? (
                            <img src={post.user_avatar} alt="" className="w-full h-full rounded-full object-cover" />
                          ) : (
                            post.user_name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <p className="text-white text-xs font-medium">{post.user_name}</p>
                          <p className="text-gray-500 text-[10px]">{formatDate(post.created_at)}</p>
                        </div>
                      </div>
                      <div className="relative">
                        <button
                          onClick={() => setShowPostMenu(showPostMenu === post.id ? null : post.id)}
                          className="p-1 rounded hover:bg-white/10 transition-colors"
                        >
                          <MoreHorizontal className="w-4 h-4 text-gray-400" />
                        </button>
                        {showPostMenu === post.id && (
                          <div className="absolute right-0 top-full mt-1 bg-[#252836] border border-gray-700 rounded-lg shadow-xl z-10 py-1 min-w-[100px]">
                            <button
                              onClick={() => {
                                setEditingPost(post.id)
                                setEditContent(post.content)
                                setShowPostMenu(null)
                              }}
                              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-gray-300 hover:bg-white/10"
                            >
                              <Edit2 className="w-3 h-3" />
                              {t('common.edit')}
                            </button>
                            <button
                              onClick={() => handleDeletePost(post.id)}
                              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-red-400 hover:bg-white/10"
                            >
                              <Trash2 className="w-3 h-3" />
                              {t('common.delete')}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Post Content */}
                    <div className="px-3 pb-2">
                      {editingPost === post.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="w-full bg-[#0f1117] border border-gray-700 rounded-lg p-2 text-white text-xs resize-none"
                            rows={3}
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditPost(post.id)}
                              className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs rounded"
                            >
                              <Check className="w-3 h-3" />
                              {t('common.save')}
                            </button>
                            <button
                              onClick={() => {
                                setEditingPost(null)
                                setEditContent('')
                              }}
                              className="flex items-center gap-1 px-2 py-1 bg-gray-700 text-white text-xs rounded"
                            >
                              <X className="w-3 h-3" />
                              {t('common.cancel')}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-gray-300 text-xs whitespace-pre-wrap">{post.content}</p>
                      )}
                    </div>

                    {/* Post Image */}
                    {post.image_url && (
                      <div className="px-3 pb-2">
                        <img
                          src={post.image_url}
                          alt=""
                          className="w-full rounded-lg object-cover max-h-80"
                        />
                      </div>
                    )}

                    {/* Post Actions */}
                    <div className="flex items-center gap-4 px-3 py-2 border-t border-gray-700/50">
                      <button
                        onClick={() => handleLike(post.id)}
                        className={`flex items-center gap-1 text-xs ${post.liked_by_me ? 'text-red-500' : 'text-gray-400 hover:text-red-500'} transition-colors`}
                      >
                        <Heart className={`w-4 h-4 ${post.liked_by_me ? 'fill-current' : ''}`} />
                        {post.likes_count}
                      </button>
                      <button
                        onClick={() => handleShowComments(post.id)}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-400 transition-colors"
                      >
                        <MessageCircle className="w-4 h-4" />
                        {post.comments_count}
                      </button>
                    </div>

                    {/* Comments Section */}
                    {showComments === post.id && (
                      <div className="border-t border-gray-700/50 p-3">
                        {loadingComments ? (
                          <div className="flex justify-center py-3">
                            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                          </div>
                        ) : (
                          <>
                            <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
                              {comments.length === 0 ? (
                                <p className="text-gray-500 text-xs text-center py-2">{t('community.no_posts')}</p>
                              ) : (
                                comments.map(comment => (
                                  <div key={comment.id} className="flex gap-2">
                                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-medium flex-shrink-0">
                                      {comment.user_avatar ? (
                                        <img src={comment.user_avatar} alt="" className="w-full h-full rounded-full object-cover" />
                                      ) : (
                                        comment.user_name.charAt(0).toUpperCase()
                                      )}
                                    </div>
                                    <div className="flex-1 bg-[#0f1117] rounded-lg p-2">
                                      <div className="flex items-center gap-2 mb-0.5">
                                        <span className="text-white text-[10px] font-medium">{comment.user_name}</span>
                                        <span className="text-gray-500 text-[10px]">{formatDate(comment.created_at)}</span>
                                      </div>
                                      <p className="text-gray-300 text-xs">{comment.content}</p>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                placeholder={t('community.write_something')}
                                className="flex-1 bg-[#0f1117] border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs placeholder-gray-500"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault()
                                    handleSubmitComment(post.id)
                                  }
                                }}
                              />
                              <button
                                onClick={() => handleSubmitComment(post.id)}
                                disabled={submittingComment || !newComment.trim()}
                                className="p-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors"
                              >
                                <Send className="w-3.5 h-3.5 text-white" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Create Post Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-b from-[#1a1d2e] to-[#0f1117] rounded-xl border border-gray-700/50 w-full max-w-md">
            <div className="flex items-center justify-between p-3 border-b border-gray-700/50">
              <h3 className="text-sm font-medium text-white">{t('community.create_post')}</h3>
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setNewPostContent('')
                  setNewPostImage(null)
                  setNewPostImagePreview(null)
                }}
                className="p-1 rounded hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="p-3 space-y-3">
              <textarea
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                placeholder={t('community.write_something')}
                className="w-full bg-[#0f1117] border border-gray-700/50 rounded-lg p-2 text-white text-xs placeholder-gray-500 resize-none focus:outline-none focus:border-gray-600"
                rows={4}
              />
              {newPostImagePreview && (
                <div className="relative">
                  <img
                    src={newPostImagePreview}
                    alt="Preview"
                    className="w-full rounded-lg object-cover max-h-40"
                  />
                  <button
                    onClick={() => {
                      setNewPostImage(null)
                      setNewPostImagePreview(null)
                    }}
                    className="absolute top-2 right-2 p-1 bg-black/50 rounded-full hover:bg-black/70 transition-colors"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              )}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 px-2 py-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer transition-colors">
                  <Image className="w-4 h-4" />
                  <span className="text-xs">{t('community.post_image')}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
                <button
                  onClick={handleCreatePost}
                  disabled={creatingPost || !newPostContent.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  {creatingPost ? (
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  {t('community.publish')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
