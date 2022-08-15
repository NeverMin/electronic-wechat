const patched = Symbol("patched")


export function patch<T extends Record<string, any>,
  K extends keyof T
>(obj: T, key: K, fn: (param: {
  args: Parameters<T[K]>,
  original: T[K]
}) => ReturnType<T[K]>) {
  const original = obj[key]
  if ((fn as any)[patched]) {
    return
  }
  obj[key] = ((...args: any[]) => {
    return fn({
      args: (args as any),
      original: original
    })
  }) as any
  (obj[key] as any)[patched] = true
}
