const utils = require('./utils')

window.addEventListener('load', () => {
  let constants = null;
  angular.injector(['ng', 'Services']).invoke(['confFactory', (confFactory) => (constants = confFactory)]);
  const scope = angular.element(document.querySelector('.dropdown_menu'))
    .scope()
  scope.$on("app:contextMenu:show", (_, e) => {
    console.log(constants)
    const path = e.originalEvent.path
    const el = path.find(i => {
      const cm = i.getAttribute('data-cm')
      if (cm != null) {
        return true
      }
    })
    const cm = JSON.parse(el.getAttribute('data-cm'))
    if (cm.type === 'message') {
      switch (+cm.msgType) {
        case constants.MSGTYPE_TEXT: {
          const cp = scope.contextMenuList.find(
            i => i.isCopy
          )
          utils.patch(cp, 'copyCallBack', ({ original, args }) => {
            const text = original(...args)
            navigator.clipboard.writeText(text)
            return text
          })
        }
        case constants.MSGTYPE_IAMGE: {
          scope.contextMenuList.push({
            content: 'Copy',
            callback: () => {
              console.log(e.target)
            }
          })
        }
      }
    }
  })
})
