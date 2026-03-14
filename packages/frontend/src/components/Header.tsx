import { memo } from 'react'
import { Menu } from 'lucide-react'
import UserProfileDropdown from '@/components/UserProfileDropdown'
import ThemeToggle from '@/components/ThemeToggle'
import { useI18n } from '@/i18n'
import { useAuthStore } from '@/stores/authStore'

interface HeaderProps {
  onMenuClick: () => void
}

const Header = memo(function Header({ onMenuClick }: HeaderProps) {
  const { language, setLanguage } = useI18n()
  const { user } = useAuthStore()

  const handleLanguageChange = (lang: 'pt' | 'es' | 'en' | 'fr' | 'de' | 'nl') => {
    setLanguage(lang)
    if (user?.id) {
      try { localStorage.setItem(`huskyapp_language_${user.id}`, lang) } catch { /* ignore */ }
    }
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-[70] h-12 bg-white dark:bg-[#080b14]/80 dark:backdrop-blur-xl border-b border-gray-200 dark:border-white/10 flex items-center justify-between pr-3 lg:pr-4 pointer-events-none transition-colors duration-200">
      {/* Left Section */}
      <div className="flex items-center flex-1 pl-2">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-[#1a1d2e] rounded-lg text-gray-600 dark:text-gray-400 pointer-events-auto transition-colors duration-200"
        >
          <Menu size={20} />
        </button>
      </div>

      {/* Logo Centralizada */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center mt-2">
        <img
          src="/logoo.png"
          alt="Logo"
          className="h-16 sm:h-22 md:h-28 w-auto object-contain brightness-0 dark:brightness-100 transition-all duration-200"
        />
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-1.5 sm:gap-3 flex-1 justify-end pointer-events-auto">
        <ThemeToggle />
        <select
          value={language}
          onChange={(e) => handleLanguageChange(e.target.value as 'pt' | 'es' | 'en' | 'fr' | 'de' | 'nl')}
          className="h-8 px-2 sm:px-2.5 bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/10 focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer transition-colors appearance-none"
          title="Idioma"
        >
          <option value="pt">PT</option>
          <option value="es">ES</option>
          <option value="en">EN</option>
          <option value="fr">FR</option>
          <option value="de">DE</option>
          <option value="nl">NL</option>
        </select>
        <UserProfileDropdown />
      </div>
    </header>
  )
})

export default Header
