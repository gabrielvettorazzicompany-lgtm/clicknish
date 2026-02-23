import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Upload, Bold, Italic, Underline, Strikethrough, List, ListOrdered, Link as LinkIcon, Hash, Plus } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import { useI18n } from '@/i18n'

interface Post {
  id: string
  app_id: string
  author_name: string
  author_avatar?: string
  content: string
  image_url?: string
  created_at: string
  is_pinned: boolean
  likes_count: number
}

interface App {
  id: string
  name: string
}

export default function CommunityManagement() {
  const { appId } = useParams()
  const navigate = useNavigate()
  const { t } = useI18n()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [app, setApp] = useState<App | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [activeTab, setActiveTab] = useState<'create' | 'list'>('create')
  const [loading, setLoading] = useState(false)

  // Form state for creating posts
  const [postForm, setPostForm] = useState({
    author_name: '',
    author_avatar: null as File | null,
    content: '',
    image: null as File | null
  })

  useEffect(() => {
    if (appId) {
      fetchApp()
      fetchPosts()
    }
  }, [appId])

  const fetchApp = async () => {
    try {
      const response = await fetch(`https://cgeqtodbisgwvhkaahiy.supabase.co/functions/v1/applications/${appId}`, {
        headers: {
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZXF0b2RiaXNnd3Zoa2FhaGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTk1MDIsImV4cCI6MjA4NDY5NTUwMn0.Ov6_rRlThZUBIoL4oT6BGozEhvTUdFsWB6KylDXpFoY`
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

  const fetchPosts = async () => {
    try {
      const userId = localStorage.getItem('user_id') || '1'
      const response = await fetch(`https://cgeqtodbisgwvhkaahiy.supabase.co/functions/v1/applications/${appId}/community/posts`, {
        headers: {
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZXF0b2RiaXNnd3Zoa2FhaGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTk1MDIsImV4cCI6MjA4NDY5NTUwMn0.Ov6_rRlThZUBIoL4oT6BGozEhvTUdFsWB6KylDXpFoY`,
          'x-user-id': userId
        }
      })
      if (response.ok) {
        const data = await response.json()
        setPosts(data)
      }
    } catch (error) {
      console.error('Error fetching posts:', error)
    }
  }

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Pegar o conteúdo do editor HTML
      const contentDiv = document.getElementById('community-content-editor')
      const content = contentDiv?.innerHTML || postForm.content

      if (!content || content.trim() === '') {
        alert(t('community.fill_content'))
        setLoading(false)
        return
      }

      if (!postForm.author_name || postForm.author_name.trim() === '') {
        alert(t('community.fill_author'))
        setLoading(false)
        return
      }

      const postData = {
        author_name: postForm.author_name,
        content: content
      }

      const userId = localStorage.getItem('user_id') || '1'
      const response = await fetch(`https://cgeqtodbisgwvhkaahiy.supabase.co/functions/v1/applications/${appId}/community/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZXF0b2RiaXNnd3Zoa2FhaGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTk1MDIsImV4cCI6MjA4NDY5NTUwMn0.Ov6_rRlThZUBIoL4oT6BGozEhvTUdFsWB6KylDXpFoY`,
          'x-user-id': userId
        },
        body: JSON.stringify(postData)
      })

      if (response.ok) {
        const newPost = await response.json()
        setPosts(prev => [newPost, ...prev])

        // Clear the editor
        if (contentDiv) {
          contentDiv.innerHTML = ''
        }

        setPostForm({
          author_name: '',
          author_avatar: null,
          content: '',
          image: null
        })
        alert(t('common.success'))
        setActiveTab('list')
      } else {
        const errorData = await response.json()
        alert(`${t('common.error')}: ${errorData.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error creating post:', error)
      alert(t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  const formatTextEditor = (command: string) => {
    document.execCommand(command, false)
  }

  const insertList = (ordered: boolean = false) => {
    const command = ordered ? 'insertOrderedList' : 'insertUnorderedList'
    document.execCommand(command, false)
  }

  const deletePost = async (postId: string) => {
    if (!confirm(t('community.confirm_delete_post'))) return

    try {
      const userId = localStorage.getItem('user_id') || '1'
      const response = await fetch(`https://cgeqtodbisgwvhkaahiy.supabase.co/functions/v1/applications/community/posts/${postId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnZXF0b2RiaXNnd3Zoa2FhaGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTk1MDIsImV4cCI6MjA4NDY5NTUwMn0.Ov6_rRlThZUBIoL4oT6BGozEhvTUdFsWB6KylDXpFoY`,
          'x-user-id': userId
        }
      })

      if (response.ok) {
        setPosts(prev => prev.filter(post => post.id !== postId))
        alert(t('common.success'))
      } else {
        alert(t('common.error'))
      }
    } catch (error) {
      console.error('Error deleting post:', error)
      alert(t('common.error'))
    }
  }

  const togglePin = async (postId: string, currentPinned: boolean) => {
    try {
      const response = await fetch(`https://app.clicknich.com/api/community/posts/${postId}/pin`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_pinned: !currentPinned })
      })

      if (response.ok) {
        setPosts(prev => prev.map(post =>
          post.id === postId
            ? { ...post, is_pinned: !currentPinned }
            : post
        ))
      }
    } catch (error) {
      console.error('Error toggling pin:', error)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f1117] flex transition-colors duration-200">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        {/* Navbar Tabs - Fixo abaixo do header */}
        <div className="bg-white dark:bg-[#0f1117] border-b border-gray-200 dark:border-[#1e2139] mt-12 sticky top-12 z-[60] transition-colors duration-200">
          <div className="flex items-center gap-6 px-6">
            <button
              onClick={() => navigate(-1)}
              className="py-2 text-xs font-medium border-b-2 border-blue-400 text-blue-400 flex items-center gap-2"
            >
              <ArrowLeft size={14} />
              {t('community.management')}
            </button>
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 lg:px-6 py-6">

            <p className="text-sm text-gray-500 mb-6">
              Create posts simulating different community users to generate engagement and demonstrate the app's interactivity.
            </p>

            {/* Tabs */}
            <div className="bg-white dark:bg-[#1a1d2e] rounded-xl shadow-xl shadow-black/5 dark:shadow-black/10 border border-gray-200 dark:border-[#1e2139] overflow-hidden">
              <div className="border-b border-gray-200 dark:border-[#1e2139]">
                <div className="flex">
                  <button
                    onClick={() => setActiveTab('create')}
                    className={`flex-1 px-6 py-4 text-center font-medium transition-colors ${activeTab === 'create'
                      ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border-b-2 border-blue-600'
                      : 'text-gray-600 hover:text-gray-800 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-[#0f1117]'
                      }`}
                  >
                    {t('community.create_post')}
                  </button>
                  <button
                    onClick={() => setActiveTab('list')}
                    className={`flex-1 px-6 py-4 text-center font-medium transition-colors ${activeTab === 'list'
                      ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border-b-2 border-blue-600'
                      : 'text-gray-600 hover:text-gray-800 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-[#0f1117]'
                      }`}
                  >
                    {t('community.official_posts')}
                  </button>
                </div>
              </div>

              <div className="p-6">
                {activeTab === 'create' ? (
                  /* Create Post Form */
                  <form onSubmit={handleCreatePost} className="space-y-6">
                    {/* Author Information */}
                    <div className="bg-gray-50 dark:bg-[#0f1117]/50 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('community.author_info')}</h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {t('community.author_name')}
                          </label>
                          <input
                            type="text"
                            value={postForm.author_name}
                            onChange={(e) => setPostForm(prev => ({ ...prev, author_name: e.target.value }))}
                            placeholder={t('community.author_name')}
                            className="w-full px-4 py-3 border border-gray-300 dark:border-[#252941] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 bg-white dark:bg-[#0f1117] text-gray-900 dark:text-gray-100"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Author Avatar
                          </label>
                          <div className="flex items-center gap-4">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => setPostForm(prev => ({
                                ...prev,
                                author_avatar: e.target.files?.[0] || null
                              }))}
                              className="hidden"
                              id="avatar-upload"
                            />
                            <label
                              htmlFor="avatar-upload"
                              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#252941] hover:bg-gray-100 dark:hover:bg-gray-200 border border-gray-300 dark:border-[#252941] rounded-lg cursor-pointer transition-colors text-gray-900 dark:text-gray-100"
                            >
                              <Upload className="w-4 h-4" />
                              {t('community.choose_avatar')}
                            </label>
                            {postForm.author_avatar && (
                              <span className="text-sm text-green-600">
                                ✓ {postForm.author_avatar.name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Content */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        {t('common.content')}
                      </label>

                      {/* Text Editor Toolbar */}
                      <div className="border border-[#252941] rounded-t-lg p-2 bg-[#0f1117]/50 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => formatTextEditor('bold')}
                          className="p-2 hover:bg-gray-200 rounded transition-colors"
                          title="Negrito"
                        >
                          <Bold className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => formatTextEditor('italic')}
                          className="p-2 hover:bg-gray-200 rounded transition-colors"
                          title="Itálico"
                        >
                          <Italic className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => formatTextEditor('underline')}
                          className="p-2 hover:bg-gray-200 rounded transition-colors"
                          title="Underline"
                        >
                          <Underline className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => formatTextEditor('strikeThrough')}
                          className="p-2 hover:bg-gray-200 rounded transition-colors"
                          title="Strikethrough"
                        >
                          <Strikethrough className="w-4 h-4" />
                        </button>
                        <div className="w-px h-6 bg-gray-300 mx-2" />
                        <button
                          type="button"
                          onClick={() => insertList(false)}
                          className="p-2 hover:bg-gray-200 rounded transition-colors"
                          title="List"
                        >
                          <List className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => insertList(true)}
                          className="p-2 hover:bg-gray-200 rounded transition-colors"
                          title="Numbered List"
                        >
                          <ListOrdered className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => formatTextEditor('createLink')}
                          className="p-2 hover:bg-gray-200 rounded transition-colors"
                          title="Link"
                        >
                          <LinkIcon className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => formatTextEditor('formatBlock')}
                          className="p-2 hover:bg-gray-200 rounded transition-colors"
                          title="Code"
                        >
                          <Hash className="w-4 h-4" />
                        </button>
                      </div>

                      <div
                        id="community-content-editor"
                        contentEditable
                        onInput={(e) => setPostForm(prev => ({
                          ...prev,
                          content: (e.target as HTMLElement).innerHTML
                        }))}
                        className="min-h-32 p-4 border border-t-0 border-[#252941] rounded-b-lg focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-500 bg-[#1a1d2e]"
                        style={{ minHeight: '120px' }}
                        suppressContentEditableWarning={true}
                        data-placeholder="Enter the content of your post..."
                      />
                    </div>

                    {/* Post Image */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        {t('community.post_image')} ({t('community.optional')})
                      </label>

                      <div className="border-2 border-dashed border-[#252941] rounded-lg p-8 text-center">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => setPostForm(prev => ({
                            ...prev,
                            image: e.target.files?.[0] || null
                          }))}
                          className="hidden"
                          id="post-image-upload"
                        />
                        <label
                          htmlFor="post-image-upload"
                          className="cursor-pointer flex flex-col items-center gap-2"
                        >
                          <Upload className="w-8 h-8 text-gray-400" />
                          <span className="text-gray-600">{t('community.click_upload_image')}</span>
                          <span className="text-xs text-gray-400">The image will be displayed automatically</span>
                        </label>

                        {postForm.image && (
                          <div className="mt-4 text-green-600">
                            ✓ Selected Image: {postForm.image.name}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Submit Button */}
                    <div className="pt-6">
                      <button
                        type="submit"
                        disabled={loading || !postForm.author_name || !postForm.content}
                        className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 px-6 rounded-lg font-semibold transition-colors"
                      >
                        {loading ? t('community.publishing') : t('community.create_post')}
                      </button>
                    </div>
                  </form>
                ) : (
                  /* Posts List */
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold text-gray-100">
                        {t('community.official_posts')} ({posts.length})
                      </h3>
                      <button
                        onClick={() => setActiveTab('create')}
                        className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        {t('community.new_post')}
                      </button>
                    </div>

                    {posts.length === 0 ? (
                      <div className="text-center py-12">
                        <p className="text-gray-500 mb-4">{t('community.no_posts')}</p>
                        <button
                          onClick={() => setActiveTab('create')}
                          className="text-blue-400 hover:text-blue-700 font-medium"
                        >
                          {t('community.create_post')}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {posts.map(post => (
                          <div
                            key={post.id}
                            className={`bg-[#1a1d2e] border rounded-lg p-4 ${post.is_pinned ? 'border-blue-200 bg-blue-500/10/30' : 'border-[#1e2139]'
                              }`}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3">
                                {post.author_avatar ? (
                                  <img
                                    src={post.author_avatar}
                                    alt={post.author_name}
                                    className="w-10 h-10 rounded-full object-cover"
                                  />
                                ) : (
                                  <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                                    <span className="text-gray-600 font-medium text-sm">
                                      {post.author_name.charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                )}
                                <div>
                                  <h4 className="font-medium text-gray-100">{post.author_name}</h4>
                                  <p className="text-sm text-gray-500">
                                    {new Date(post.created_at).toLocaleDateString('pt-BR')}
                                  </p>
                                </div>
                                {post.is_pinned && (
                                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                                    {t('community.pin_post')}
                                  </span>
                                )}
                              </div>

                              <div className="flex gap-2">
                                <button
                                  onClick={() => togglePin(post.id, post.is_pinned)}
                                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${post.is_pinned
                                    ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                    : 'bg-[#252941] text-gray-300 hover:bg-gray-200'
                                    }`}
                                >
                                  {post.is_pinned ? t('community.unpin_post') : t('community.pin_post')}
                                </button>
                                <button
                                  onClick={() => deletePost(post.id)}
                                  className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm font-medium hover:bg-red-200 transition-colors"
                                >
                                  {t('common.delete')}
                                </button>
                              </div>
                            </div>

                            <div
                              className="prose prose-sm max-w-none mb-3"
                              dangerouslySetInnerHTML={{ __html: post.content }}
                            />

                            {post.image_url && (
                              <img
                                src={post.image_url}
                                alt="Post image"
                                className="w-full max-w-md rounded-lg object-cover"
                              />
                            )}

                            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[#1e2139] text-sm text-gray-500">
                              <span>{post.likes_count} likes</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}