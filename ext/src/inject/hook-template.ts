const templetes: Record<string, (tpl: string) => string> = {}


type TemplateCache = {
  get: (name: string) => string | undefined
  put: (name: string, template: string) => void
}
export function initTemplateHook(cache: TemplateCache) {
  const get = cache.get
  const put = cache.put
  cache.get = (name: string) => {
    const tpl = get(name)
    if (templetes[name] && tpl) {
      return templetes[name](tpl)
    }
    return tpl
  }
}

export function registerTemplate(name: string, templateTransform: (tpl: string) => string) {
  templetes[name] = templateTransform
}

export function installHook(name: string, onRender: (el: HTMLElement) => void) {
  (window as any)[name] = onRender
  registerTemplate(name, (tpl) => {
    const el = document.createElement('template')
    el.innerHTML = tpl
    const root = el.content.querySelector('*')!
    root.setAttribute('data-name', name)
    const boot = document.createElement('script')
    boot.innerHTML = `
      const callback="${name}"
      window[callback](document.querySelector('[data-name="${name}"]'))
    `
    root.append(
      boot
    )
    return el.innerHTML
  })
}
