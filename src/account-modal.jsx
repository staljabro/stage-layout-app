import {createPortal} from 'react-dom'

export function AccountModal({children}) {
  return createPortal(<div className="account-backdrop">{children}</div>,document.body)
}
