import { Sun, Moon } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'

export default function ThemeToggle() {
    const { theme, toggleTheme } = useTheme()

    return (
        <button
            onClick={toggleTheme}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            title={`Alternar para modo ${theme === 'dark' ? 'claro' : 'escuro'}`}
        >
            {theme === 'dark' ? (
                <Sun size={18} className="text-yellow-500" />
            ) : (
                <Moon size={18} className="text-blue-600" />
            )}
        </button>
    )
}