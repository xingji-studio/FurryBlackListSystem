import { StatusCode } from '@mateothegreat/svelte5-router'
import NotFound from '@fbls/shared/NotFound.svelte'

export const routes = [
  { component: async () => import('./pages/Login.svelte') },
  { path: 'dashboard', component: async () => import('./pages/Dashboard.svelte') }
]

export const routerConfig = {
  statuses: {
    [StatusCode.NotFound]: () => ({
      component: NotFound,
      props: { target: '登录页' }
    })
  }
}
