import { patch } from "../patch"

export function hookAssign<T>(
  property: string,
  onAssign: (value: T) => T
) {
  try {
    console.log("watch", property)
    let value: any = (window as any)[property]
    Object.defineProperty(
      window,
      property, {
      get() {
        return value
      },
      set(val) {
        value = onAssign(val)
      }
    }
    )
  } catch { }
}

