import { mount } from 'svelte'
import App from './App.svelte'
import '@fbls/shared/styles/site.css'

const app = mount(App, { target: document.body })

export default app
