import { SearchList } from './search-list'
import pinyin from 'pinyin'

export type User = {
  NickName: string
  DisplayName: string
}

function text(user: UserInternal) {
  return user.user.DisplayName || user.user.NickName || "N/A"
}

type UserInternal = {
  user: User
  keywords: string[]
}

function isMatch(kw: string, user: UserInternal) {
  return user.keywords.some(item => item.toLowerCase().includes(kw.toLowerCase()))
}

function getKeywords(user: User) {
  const kw: string[] = []
  if (user.DisplayName) {
    kw.push(pinyin(user.DisplayName, {
      style: pinyin.STYLE_NORMAL
    })
      .map(i => i[0])
      .join('')
    )
  }
  if (user.NickName) {
    kw.push(pinyin(user.NickName, {
      style: pinyin.STYLE_NORMAL
    })
      .map(i => i[0])
      .join('')
    )

  }
  return kw
}

export function Mention<T extends User>(props: {
  class?: string
  users: T[]
  onSelect: (user: T) => void
  onCancel?: () => void
}) {
  return <SearchList
    class={props.class}
    data={props.users.map(user => ({
      user,
      keywords: getKeywords(user)
    }))}
    onCancel={props.onCancel}
    text={text}
    isMatch={isMatch}
    onSelect={(i) => props.onSelect(i.user)}
  />
}
