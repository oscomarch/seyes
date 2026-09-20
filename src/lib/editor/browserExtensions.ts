import { seyesExtensions } from './extensions'
import { slashExtension } from '@/components/SlashMenu'

/** Extensions for the running app. Tests import `seyesExtensions` alone. */
export const browserExtensions = [...seyesExtensions, slashExtension()]
