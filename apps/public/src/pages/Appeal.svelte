<script lang="ts">
import { route } from '@mateothegreat/svelte5-router'
import { clientLinks, platforms } from '@fbls/shared'
import { publicApi, messageOf } from '../lib/api'
import { setFlash } from '../lib/state.svelte'

let form = $state({
  account_id: '',
  description: '',
  evidence: '',
  license_agreement: false,
  platform: ''
})
let submitting = $state(false)

const submit = async (event: SubmitEvent) => {
  event.preventDefault()
  submitting = true
  setFlash(null)
  try {
    setFlash(
      messageOf(
        'success',
        await publicApi.appeal({
          ...form,
          license_agreement: form.license_agreement ? 'yes' : 'no'
        })
      )
    )
    form = {
      account_id: '',
      description: '',
      evidence: '',
      license_agreement: false,
      platform: ''
    }
  } catch (error) {
    setFlash(messageOf('error', error instanceof Error ? error.message : '提交失败。'))
  } finally {
    submitting = false
  }
}
</script>

<svelte:head>
  <title>申诉 - 福瑞联合净网行动</title>
</svelte:head>

<main class="single-panel">
  <div class="panel-header">
    <span class="eyebrow">Appeal Review</span>
    <h1>申诉提交</h1>
    <p>仅限已被收录进黑名单的账号提交申诉。管理员审核通过后，会自动移除对应黑名单记录。</p>
  </div>

  <form class="form-panel" onsubmit={submit}>
    <label>平台
      <select bind:value={form.platform} required>
        <option value="">请选择平台</option>
        {#each platforms as platform}
          <option value={platform}>{platform}</option>
        {/each}
      </select>
    </label>

    <label>账号 ID
      <input bind:value={form.account_id} type="text" placeholder="例如：user_12345" required />
      <span class="field-hint">
        仅允许 ASCII 字符，且必须与黑名单中的平台和账号 ID 完全对应。
      </span>
    </label>

    <label>描述
      <textarea
        bind:value={form.description}
        rows="5"
        placeholder="说明为什么是误收录，并补充必要上下文"
        required
      ></textarea>
    </label>

    <label>证据
      <textarea
        bind:value={form.evidence}
        rows="5"
        placeholder="填写截图链接、录屏链接或其他证据说明"
        required
      ></textarea>
    </label>

    <label class="consent-check">
      <input bind:checked={form.license_agreement} type="checkbox" required />
      <span>
        我已认真阅读并同意
        <a class="text-link" href={clientLinks.eula} target="_blank" rel="noopener noreferrer">
          《极端福瑞/反福瑞行为档案库许可协议》
        </a>
      </span>
    </label>

    <button class="primary-button" type="submit" disabled={submitting}>
      {submitting ? '提交中' : '提交申诉'}
    </button>
  </form>
</main>
