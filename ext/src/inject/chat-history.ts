import { registerServicesHook } from './hook-points/services'
import { patch } from './patch'
import * as db from '../utils/chat-storage'
import { registerControllerHook } from './hook-points/controller'

export default () => {
  registerServicesHook('chatFactory', {
    f: (chatFactory: any, [
      _$rootScope,
      _$timeout,
      _$http,
      _$q,
      _contactFactory,
      _accountFactory,
      _emojiFactory,
      confFactory,
      _notificationFactory,
      _utilFactory,
      _reportService,
      _mmHttp,
      _titleRemind
    ]) => {
      patch(chatFactory, 'initChatList', ({ context, original, args }) => {
        original.apply(context, args)
        const [userNames] = args as [string]
        userNames.split(",")
          .forEach(userName => {
            db.getMessages(userName, 300)
              ?.then(
                msgs => {
                  for (const msg of msgs) {
                    chatFactory.addChatMessage(msg, true)
                  }
                }
              )
          })
      })
      patch(chatFactory, 'addChatMessage', ({ original, context, args }) => {
        original.apply(context, args)
        const [msg, notSave] = args
        if (!notSave) {
          const m = { ...(msg as any) }
          m.MMStatus = confFactory.MSG_SEND_STATUS_SUCC
          db.insertMessage(m)
        }
      })
      return chatFactory
    }
  })
  registerControllerHook('contentChatController', {
    f: (_, [
      $scope, 
      _$timeout,
      _$state, 
      _$log, 
      _$doc, 
      _$com, 
      _chatFactory
    ]) => {
      $scope.$on('root:cleanMsg', (_: any, un: string) => {
        db.removeByUserName(un)
      })
    }
  })
}
