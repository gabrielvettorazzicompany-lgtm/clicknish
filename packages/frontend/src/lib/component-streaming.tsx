/**
 * 🚀 PROGRESSIVE COMPONENT STREAMING SYSTEM
 * 
 * Sistema de streaming progressivo para checkout ultrafast
 * - Renderização progressiva de componentes
 * - Skeleton to content transitions
 * - Priority-based loading
 * - Non-blocking rendering
 */

import React, { useState, useEffect, useRef, ReactNode, ComponentType } from 'react'

interface StreamingConfig {
    priority: 'critical' | 'high' | 'medium' | 'low'
    delay?: number
    dependencies?: string[]
    skeleton?: ReactNode
    fallback?: ReactNode
    timeout?: number
}

interface StreamedComponent {
    id: string
    component: ComponentType<any>
    props: any
    config: StreamingConfig
    status: 'pending' | 'loading' | 'loaded' | 'error'
    error?: Error
}

class ComponentStreamManager {
    private components = new Map<string, StreamedComponent>()
    private loadedDependencies = new Set<string>()
    private listeners = new Set<(components: Map<string, StreamedComponent>) => void>()

    // ✅ REGISTER: Registrar componente para streaming
    registerComponent(
        id: string,
        component: ComponentType<any>,
        props: any = {},
        config: StreamingConfig = { priority: 'medium' }
    ) {
        const streamedComponent: StreamedComponent = {
            id,
            component,
            props,
            config,
            status: 'pending'
        }

        this.components.set(id, streamedComponent)
        this.notifyListeners()

        console.log(`[Streaming] 📝 Registered component: ${id} (priority: ${config.priority})`)
    }

    // ✅ START STREAMING: Iniciar carregamento progressivo
    async startStreaming() {
        console.log('[Streaming] 🚀 Starting progressive component streaming')

        const componentsByPriority = this.groupComponentsByPriority()

        // Carregar por ordem de prioridade
        for (const [priority, components] of componentsByPriority) {
            console.log(`[Streaming] ⚡ Loading ${components.length} ${priority} priority components`)

            await this.loadPriorityGroup(components)

            // Delay entre prioridades para evitar blocking
            if (priority === 'critical') {
                await this.wait(0) // Críticos imediatos
            } else if (priority === 'high') {
                await this.wait(50)
            } else if (priority === 'medium') {
                await this.wait(100)
            } else {
                await this.wait(200) // Low priority com delay maior
            }
        }

        console.log('[Streaming] ✅ Progressive streaming complete')
    }

    // ✅ LOAD PRIORITY GROUP: Carregar grupo por prioridade
    private async loadPriorityGroup(components: StreamedComponent[]) {
        // Separar por dependências
        const independentComponents = components.filter(c => !c.config.dependencies?.length)
        const dependentComponents = components.filter(c => c.config.dependencies?.length)

        // Carregar independentes primeiro
        await Promise.allSettled(
            independentComponents.map(component => this.loadComponent(component))
        )

        // Carregar dependentes após dependencies
        for (const component of dependentComponents) {
            await this.loadComponentWithDependencies(component)
        }
    }

    // ✅ LOAD COMPONENT: Carregar componente individual
    private async loadComponent(streamedComponent: StreamedComponent): Promise<void> {
        const { id, config } = streamedComponent

        try {
            // Marcar como carregando
            streamedComponent.status = 'loading'
            this.notifyListeners()

            // Apply delay if specified
            if (config.delay) {
                await this.wait(config.delay)
            }

            // Simular carregamento se necessário
            await this.wait(10) // Mínimo delay para smooth transition

            // Marcar como carregado
            streamedComponent.status = 'loaded'
            this.loadedDependencies.add(id)
            this.notifyListeners()

            console.log(`[Streaming] ✅ Loaded component: ${id}`)

        } catch (error) {
            console.error(`[Streaming] ❌ Failed to load component: ${id}`, error)
            streamedComponent.status = 'error'
            streamedComponent.error = error as Error
            this.notifyListeners()
        }
    }

    // ✅ LOAD WITH DEPENDENCIES: Aguardar dependências
    private async loadComponentWithDependencies(streamedComponent: StreamedComponent): Promise<void> {
        const { dependencies, timeout = 10000 } = streamedComponent.config

        if (!dependencies?.length) {
            return this.loadComponent(streamedComponent)
        }

        // Aguardar dependencies com timeout
        const startTime = Date.now()

        while (true) {
            const allLoaded = dependencies.every(dep => this.loadedDependencies.has(dep))

            if (allLoaded) {
                return this.loadComponent(streamedComponent)
            }

            if (Date.now() - startTime > timeout) {
                console.warn(`[Streaming] ⏱️ Dependency timeout for: ${streamedComponent.id}`)
                return this.loadComponent(streamedComponent) // Load anyway
            }

            await this.wait(50) // Check every 50ms
        }
    }

    // ✅ GROUP BY PRIORITY: Agrupar por prioridade
    private groupComponentsByPriority(): Map<string, StreamedComponent[]> {
        const groups = new Map<string, StreamedComponent[]>()
        const priorities = ['critical', 'high', 'medium', 'low']

        for (const priority of priorities) {
            groups.set(priority, [])
        }

        for (const component of this.components.values()) {
            const group = groups.get(component.config.priority) || []
            group.push(component)
            groups.set(component.config.priority, group)
        }

        return groups
    }

    // ✅ UTILS
    private wait(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms))
    }

    private notifyListeners() {
        this.listeners.forEach(listener => listener(this.components))
    }

    // ✅ SUBSCRIBE: Subscription para updates
    subscribe(listener: (components: Map<string, StreamedComponent>) => void) {
        this.listeners.add(listener)
        return () => this.listeners.delete(listener)
    }

    // ✅ GET STATUS: Status de um componente
    getComponentStatus(id: string): 'pending' | 'loading' | 'loaded' | 'error' | 'not-found' {
        return this.components.get(id)?.status || 'not-found'
    }

    // ✅ CLEAR: Limpar tudo
    clear() {
        this.components.clear()
        this.loadedDependencies.clear()
        this.listeners.clear()
    }
}

// ✅ REACT COMPONENTS

// Hook para usar o streaming manager
export const useComponentStreaming = () => {
    const managerRef = useRef(new ComponentStreamManager())
    const [components, setComponents] = useState<Map<string, StreamedComponent>>(new Map())

    useEffect(() => {
        const manager = managerRef.current
        const unsubscribe = manager.subscribe(setComponents)

        return unsubscribe
    }, [])

    return {
        registerComponent: managerRef.current.registerComponent.bind(managerRef.current),
        startStreaming: managerRef.current.startStreaming.bind(managerRef.current),
        getComponentStatus: managerRef.current.getComponentStatus.bind(managerRef.current),
        components
    }
}

// Componente StreamedComponent
interface StreamedComponentProps {
    id: string
    component: ComponentType<any>
    props?: any
    config?: StreamingConfig
    children?: ReactNode
}

export const StreamedComponent: React.FC<StreamedComponentProps> = ({
    id,
    component: Component,
    props = {},
    config = { priority: 'medium' },
    children
}) => {
    const { registerComponent, getComponentStatus } = useComponentStreaming()
    const [status, setStatus] = useState<'pending' | 'loading' | 'loaded' | 'error'>('pending')

    useEffect(() => {
        registerComponent(id, Component, props, config)
    }, [id, Component, props, config, registerComponent])

    useEffect(() => {
        const checkStatus = () => {
            const currentStatus = getComponentStatus(id)
            if (currentStatus !== 'not-found') {
                setStatus(currentStatus)
            }
        }

        const interval = setInterval(checkStatus, 50)
        return () => clearInterval(interval)
    }, [id, getComponentStatus])

    // Render skeleton during loading
    if (status === 'pending' || status === 'loading') {
        return (
            <div className="streaming-component-skeleton">
                {config.skeleton || (
                    <div className="animate-pulse space-y-4">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    </div>
                )}
            </div>
        )
    }

    // Render error state
    if (status === 'error') {
        return (
            <div className="streaming-component-error p-4 border border-red-200 rounded bg-red-50">
                {config.fallback || (
                    <p className="text-red-600 text-sm">Erro ao carregar componente</p>
                )}
            </div>
        )
    }

    // Render loaded component
    return (
        <div className="streaming-component-loaded">
            <Component {...props}>
                {children}
            </Component>
        </div>
    )
}

// Container para componentes streamados
interface ProgressiveContainerProps {
    children: ReactNode
    autoStart?: boolean
    onLoadingComplete?: () => void
}

export const ProgressiveContainer: React.FC<ProgressiveContainerProps> = ({
    children,
    autoStart = true,
    onLoadingComplete
}) => {
    const { startStreaming } = useComponentStreaming()
    const startedRef = useRef(false)

    useEffect(() => {
        if (autoStart && !startedRef.current) {
            startedRef.current = true

            // Start streaming after a microtask to allow registration
            Promise.resolve().then(() => {
                startStreaming().then(() => {
                    onLoadingComplete?.()
                })
            })
        }
    }, [autoStart, startStreaming, onLoadingComplete])

    return (
        <div className="progressive-container">
            {children}
        </div>
    )
}

// Export singleton
const streamManager = new ComponentStreamManager()
export default streamManager