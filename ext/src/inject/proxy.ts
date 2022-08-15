import { Scope } from "./angular-utils";

function makeProxy(scope: Scope) {
  return new Proxy(scope, {
    get(target, p) {
      console.log("get", p)
      return scope[p as any]
    },
    set(target, p, value) {
      console.log("set", p, value)
      scope[p as any] = value
      return true
    }
  })
}

export function hookScope(scope: Scope) {
  let { $$childHead, $$nextSibling } = scope
  Object.defineProperties(scope, {
    $$childHead: {
      get: () => $$childHead,
      set: (child) => {
        $$childHead = child
        if (child) {
          hookScope(child)
        }
      }
    },
    $$nextSibling: {
      get: () => $$nextSibling,
      set: (value) => {
        $$nextSibling = value
        if (value) {
          hookScope(scope)
        }
      }
    }
  })
}
