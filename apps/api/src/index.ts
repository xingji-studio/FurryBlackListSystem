import { createApp } from './lib/http'
import { env } from './lib/env'

export default {
  port: env.publicPort,
  fetch: createApp().fetch
}
