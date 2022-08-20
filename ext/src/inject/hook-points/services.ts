import { patch } from "../patch"
export type Hook = {
  f: (obj: any, injected: any[]) => any
}
const hooks: Record<string, Hook> = {}
export function initHookServices(services: any) {
  /*
angular.module("Services")
  .factory("a",[b,function(b) {}])
*/
  patch(services, 'factory', (param) => {
    const [name, deps] = param.args as any[]
    console.log("DDDD", name)
    if (hooks[name]) {
      console.log(param.args)
      const fn = deps.pop()
      return param.original.apply(param.context, [
        name,
        [
          ...deps,
          (...injected: any[]) => {
            return hooks[name].f(
              fn(...injected),
              injected)
          }
        ]
      ])
    }
    return param.original.apply(param.context, param.args)
  })
}

export function registerServicesHook(name: string, hook: Hook) {
  hooks[name] = hook
}
