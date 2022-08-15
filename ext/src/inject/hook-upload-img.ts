import { installHook } from "./hook-template";

export default () => installHook('imageUploadPreview.html', (el) => {
  console.log(el)
})
