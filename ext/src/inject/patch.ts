const patched = Symbol("patched")


export function patch<T extends Record<string, any>,
  K extends keyof T
>(obj: T, key: K, fn: (param: {
  args: Parameters<T[K]>,
  context: any
  original: T[K]
}) => ReturnType<T[K]>) {
  let original = obj[key]
  if ((fn as any)[patched]) {
    return
  }
  Object.defineProperty(
    obj, key, {
    get: (() => {
      const f = function(...args: any[]) {
        return fn({
          args: (args as any),
          //@ts-ignore
          context: this,
          original: original
        })
      };
      (f as any)[patched] = true
      return f
    }),
    set: (v) => {
      console.log("!!!!!", v)
      original = v
    }
  });
}
