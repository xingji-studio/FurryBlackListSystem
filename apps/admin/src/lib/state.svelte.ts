import type { FlashMessage } from '@fbls/shared'

export const flash = $state<{ item: FlashMessage | null }>({ item: null })

export const setFlash = (item: FlashMessage | null) => {
  flash.item = item
}
