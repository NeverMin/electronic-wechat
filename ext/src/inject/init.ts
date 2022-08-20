import mention from './mention'
import hookUploadImg from './upload-img'
import hookScreenshot from './screenshot'
const exts = [
  hookUploadImg, hookScreenshot, mention]

export function init() {
  for (const ext of exts) {
    ext()
  }
}
