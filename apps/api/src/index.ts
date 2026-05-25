import { Hono } from 'hono'
import { mountRoutes } from './lib/http'

const app = new Hono()
mountRoutes(app)

export default app
