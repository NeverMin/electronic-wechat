export type Scope = {
  $$childHead: Scope | null
  $$nextSibling: Scope | null
  $id: string
} & Record<string, unknown>

export function findScope(scope: Scope, predict: (s: Scope) => boolean): Scope | null {
  if (scope) {
    if (predict(scope)) {
      return scope
    }
    let p = scope.$$childHead
    while (p) {
      if (predict(p)) {
        return p
      }
      p = p.$$nextSibling
    }
    p = scope.$$childHead
    while (p) {
      const s = findScope(p, predict)
      if (s) {
        return s
      }
      p = p.$$nextSibling
    }
  }
  return null
}
