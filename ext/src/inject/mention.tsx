import { render } from 'solid-js/web';
import { Mention } from '../mention'
import { css } from '@emotion/css'
import { getOrCreateMountPoint } from '../utils/dom';

declare const angular: any
export default () => {
  window.addEventListener('load', () => {
    const scope = angular.element(document.body)
      .scope()
    scope.mentionMenu = (event: { originalEvent: KeyboardEvent }) => {
      const editArea = angular.element('#editArea')
      const chatScope = angular.element('#chatArea').scope()
      if (event.originalEvent.key === '@') {
        // Mention component will preempt focus, therefore the @ will be send to Mention's input
        // Let mount it after this event
        const target = event.originalEvent.target as HTMLInputElement
        setTimeout(() => {
          const users: Array<{ UserName: string, DisplayName: string, NickName: string }> = chatScope.currentContact.MemberList
          const index = document.getSelection()?.getRangeAt(0)?.startOffset ?? editArea.text().length - 1
          console.log("index:", index)
          if (users.length > 0) {
            const umount = render(() => <Mention
              class={css`
                    position: absolute;
                    background-color: white;
                    width: min(500px, 80vw);
                    top: 50px;
                    left: 50%;
                    transform: translateX(-50%);
            `}
              users={users}
              onSelect={(user) => {
                umount()
                const msg: string = editArea.text()
                const a = msg.substring(0, index)
                const b = msg.substring(index)
                const uc = chatScope.getUserContact(user.UserName)
                editArea.html('')
                // 腾讯的前端有处理@，实际并没啥卵用
                editArea.scope().insertToEditArea(`${a}<input un=${user.UserName} value=${uc.NickName} >${b}`)
              }}
              onCancel={() => {
                umount()
                target.focus()
                const content = editArea.html()
                editArea.html('')
                editArea.scope().insertToEditArea(
                  content
                )
              }}
            />,
              getOrCreateMountPoint('#mention-container')
            )
          }
        })
      }
    }
  })
}
