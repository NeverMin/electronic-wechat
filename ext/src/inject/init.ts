import mention from './mention'
import hookUploadImg from './upload-img'
import hookScreenshot from './screenshot'
import chatHistory from './chat-history'


const exts = [
  chatHistory,
  hookUploadImg, hookScreenshot, mention]

export function init() {
  while (exts.length) {
    exts.pop()!();
  }
}
