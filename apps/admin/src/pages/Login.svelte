<script lang="ts">
import { onMount } from 'svelte'
import { adminApi, messageOf } from '../lib/api'
import { isAuthed } from '../lib/auth.svelte'
import { setFlash } from '../lib/state.svelte'

let username = $state('')
let password = $state('')
let loading = $state(false)

onMount(() => {
  if (isAuthed()) window.location.assign('/dashboard')
})

const submit = async (event: SubmitEvent) => {
  event.preventDefault()
  loading = true
  setFlash(null)
  try {
    await adminApi.login(username, password)
    window.location.assign('/dashboard')
  } catch (error) {
    setFlash(messageOf('error', error instanceof Error ? error.message : '登录失败。'))
  } finally {
    loading = false
  }
}
</script>

<svelte:head>
  <title>后台登录 - 黑名单系统</title>
</svelte:head>

<main class="login-layout">
  <section class="login-panel dossier">
    <span class="eyebrow">后台审核端</span>
    <h1>管理员登录</h1>
    <p>登录后可以审核举报、审核申诉，并维护针对极端福瑞/反福瑞行为的在案记录。</p>
    <p class="field-hint">当前设备登录成功后，10 分钟内无需再次输入账号和密码。</p>
    <form class="form-panel compact" onsubmit={submit}>
      <label>账号
        <input bind:value={username} type="text" required />
      </label>
      <label>密码
        <input bind:value={password} type="password" required />
      </label>
      <button class="primary-button" type="submit" disabled={loading}>
        {loading ? '登录中' : '登录后台'}
      </button>
    </form>
  </section>
</main>
