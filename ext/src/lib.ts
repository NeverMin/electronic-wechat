import { init } from './inject/init'
import { initTemplateHook } from './inject/hook-points/templates'
import { initHookControllers } from './inject/hook-points/controller'
import { initHookServices } from './inject/hook-points/services'
import './utils/chat-storage'

export {
  init,
  initHookControllers,
  initHookServices,
  initTemplateHook
}
