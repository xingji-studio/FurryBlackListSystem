import { StatusCode } from '@mateothegreat/svelte5-router'
import NotFound from '@fbls/shared/NotFound.svelte'

export const routes = [
  { component: async () => import('./pages/Home.svelte') },
  { path: 'report', component: async () => import('./pages/Report.svelte') },
  { path: 'search', component: async () => import('./pages/Search.svelte') },
  { path: 'appeal', component: async () => import('./pages/Appeal.svelte') }
]

export const routerConfig = {
  statuses: {
    [StatusCode.NotFound]: () => ({
      component: NotFound,
      props: { target: '首页' }
    })
  }
}
