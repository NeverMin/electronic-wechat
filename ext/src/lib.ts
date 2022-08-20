import { init } from './inject/init'
import { initTemplateHook } from './inject/hook-points/templates'
import { initHookServices } from './inject/hook-points/services'

export {
  init,
  initHookServices,
  initTemplateHook
}
