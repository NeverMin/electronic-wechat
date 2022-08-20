import { exec } from 'child_process'
import { defineServices, getAngularObj } from "./angular-utils";
import { patch } from "./patch";
import { registerServicesHook } from "./hook-points/services";
import { getUploader } from './uploader';
declare const WebUploader: any
export default () => {
  registerServicesHook('screenShotFactory', {
    f: (screenShotFactory: any) => {
      console.log(screenShotFactory)
      const sf = Object.create(screenShotFactory)
      Object.assign(sf,
        {
          isClipBoardImage() { return true },
          isSupport() { return true },
          capture({ ok }: { ok: () => void }) {
            exec("flameshot gui", (err) => {
              if (err == null) {
                ok()
              }
            })
          },
          upload() {
            console.log('uploader', getUploader())

            navigator.clipboard.read()
              .then(items => {
                const t = items[0].types[0]
                const data = items[0].getType(t)
                return data
              })
              .then((data) => {
                const file = new WebUploader.Lib.File(
                  WebUploader.guid(), data
                )
                file.onSuccess = () => { }
                getUploader()?.addFile(file)
                // console.log(data)
                // const dt = new DataTransfer()
                // const evt = new ClipboardEvent('paste', {
                //   clipboardData: dt
                // })
                // evt.clipboardData?.setData(type, data)
                // document.querySelector('#editArea')?.dispatchEvent(evt)
              })

          }
        }
      )
      return sf
    }
  })
}
