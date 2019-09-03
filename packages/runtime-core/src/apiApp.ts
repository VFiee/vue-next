import {
  ComponentOptions,
  Component,
  ComponentRenderProxy,
  Data,
  ComponentInstance,
  currentRenderingInstance,
  currentInstance
} from './component'
import { Directive } from './directives'
import { HostNode, RootRenderFunction } from './createRenderer'
import { InjectionKey } from './apiInject'
import { isFunction, camelize, capitalize } from '@vue/shared'
import { warn } from './warning'
import { createVNode } from './vnode'

export interface App {
  config: AppConfig
  use(plugin: Plugin, options?: any): this
  mixin(mixin: ComponentOptions): this
  component(name: string): Component | undefined
  component(name: string, component: Component): this
  directive(name: string): Directive | undefined
  directive(name: string, directive: Directive): this
  mount(
    rootComponent: Component,
    rootContainer: string | HostNode,
    rootProps?: Data
  ): ComponentRenderProxy
  provide<T>(key: InjectionKey<T> | string, value: T): void
}

export interface AppConfig {
  silent: boolean
  devtools: boolean
  performance: boolean
  errorHandler?: (
    err: Error,
    instance: ComponentRenderProxy | null,
    info: string
  ) => void
  warnHandler?: (
    msg: string,
    instance: ComponentRenderProxy | null,
    trace: string
  ) => void
}

export interface AppContext {
  config: AppConfig
  mixins: ComponentOptions[]
  components: Record<string, Component>
  directives: Record<string, Directive>
  provides: Record<string | symbol, any>
}

type PluginInstallFunction = (app: App) => any

export type Plugin =
  | PluginInstallFunction
  | {
      install: PluginInstallFunction
    }

export function createAppContext(): AppContext {
  return {
    config: {
      silent: false,
      devtools: true,
      performance: false,
      errorHandler: undefined,
      warnHandler: undefined
    },
    mixins: [],
    components: {},
    directives: {},
    provides: {}
  }
}

export function createAppAPI(render: RootRenderFunction): () => App {
  return function createApp(): App {
    const context = createAppContext()

    let isMounted = false

    const app: App = {
      get config() {
        return context.config
      },

      set config(v) {
        if (__DEV__) {
          warn(
            `app.config cannot be replaced. Modify individual options instead.`
          )
        }
      },

      use(plugin: Plugin) {
        if (isFunction(plugin)) {
          plugin(app)
        } else if (isFunction(plugin.install)) {
          plugin.install(app)
        } else if (__DEV__) {
          warn(
            `A plugin must either be a function or an object with an "install" ` +
              `function.`
          )
        }
        return app
      },

      mixin(mixin: ComponentOptions) {
        context.mixins.push(mixin)
        return app
      },

      component(name: string, component?: Component) {
        // TODO component name validation
        if (!component) {
          return context.components[name] as any
        } else {
          context.components[name] = component
          return app
        }
      },

      directive(name: string, directive?: Directive) {
        // TODO directive name validation
        if (!directive) {
          return context.directives[name] as any
        } else {
          context.directives[name] = directive
          return app
        }
      },

      mount(rootComponent, rootContainer, rootProps?: Data): any {
        if (!isMounted) {
          const vnode = createVNode(rootComponent, rootProps)
          // store app context on the root VNode.
          // this will be set on the root instance on initial mount.
          vnode.appContext = context
          render(vnode, rootContainer)
          isMounted = true
          return (vnode.component as ComponentInstance).renderProxy
        } else if (__DEV__) {
          warn(
            `App has already been mounted. Create a new app instance instead.`
          )
        }
      },

      provide(key, value) {
        if (__DEV__ && key in context.provides) {
          warn(
            `App already provides property with key "${key}". ` +
              `It will be overwritten with the new value.`
          )
        }
        context.provides[key as any] = value
      }
    }

    return app
  }
}

export function resolveAsset(type: 'components' | 'directives', name: string) {
  const instance = currentRenderingInstance || currentInstance
  if (instance) {
    let camelized
    let capitalized
    let res
    const local = (instance.type as any)[type]
    if (local) {
      res =
        local[name] ||
        local[(camelized = camelize(name))] ||
        local[(capitalized = capitalize(camelized))]
    }
    if (!res) {
      const global = instance.appContext[type]
      res =
        global[name] ||
        global[camelized || (camelized = camelize(name))] ||
        global[capitalized || capitalize(camelized)]
    }
    if (__DEV__ && !res) {
      warn(`Failed to resolve ${type.slice(0, -1)}: ${name}`)
    }
    return res
  } else if (__DEV__) {
    warn(
      `resolve${capitalize(type.slice(0, -1))} ` +
        `can only be used in render() or setup().`
    )
  }
}