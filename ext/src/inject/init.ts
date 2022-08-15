import mention from './mention'
import hookUploadImg from './hook-upload-img'
const exts = [hookUploadImg, mention]

export function init() {
  for (const ext of exts) {
    ext()
  }
}
