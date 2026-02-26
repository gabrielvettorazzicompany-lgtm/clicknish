import { create } from 'zustand'

interface Application {
  id: string
  name: string
  slug: string
  logo?: string
  logo_url?: string
  primaryColor: string
  secondaryColor: string
  created_at: string
  show_names?: boolean
  highlight_community?: boolean
  free_registration?: boolean
  app_type?: string
  language?: string
  theme?: string
}

interface AppStore {
  apps: Application[]
  currentApp: Application | null
  setApps: (apps: Application[]) => void
  setCurrentApp: (app: Application) => void
  addApp: (app: Application) => void
  updateApp: (app: Application) => void
  removeApp: (appId: string) => void
}

export const useAppStore = create<AppStore>((set) => ({
  apps: [],
  currentApp: null,
  setApps: (apps) => set({ apps }),
  setCurrentApp: (currentApp) => set({ currentApp }),
  addApp: (app) =>
    set((state) => ({
      apps: [...state.apps, app],
    })),
  updateApp: (app) =>
    set((state) => ({
      apps: state.apps.map((a) => (a.id === app.id ? app : a)),
      currentApp: state.currentApp?.id === app.id ? app : state.currentApp,
    })),
  removeApp: (appId) =>
    set((state) => ({
      apps: state.apps.filter((a) => a.id !== appId),
      currentApp: state.currentApp?.id === appId ? null : state.currentApp,
    })),
}))
