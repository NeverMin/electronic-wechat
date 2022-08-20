import { getScope } from "./angular-utils";
import { installHook } from "./hook-points/templates";
import { patch } from "./patch";

export default () => installHook('imageUploadPreview.html', {
  onRender: (el: HTMLElement) => {
    const scope = getScope(el)
    patch(scope, 'cancel', ({ original }) => {
      remove()
      original()
    })
    const remove = () => {
      window.removeEventListener('keydown', fn)
    }
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        scope.send()
        remove()
      } else if (e.key === 'Escaple') {
        return remove()
      }
    }
    window.addEventListener('keydown', fn)
  }
})
