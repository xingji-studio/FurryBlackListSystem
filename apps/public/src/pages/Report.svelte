<script lang="ts">
import { route } from '@mateothegreat/svelte5-router'
import { clientLinks, platforms, threatLevels } from '@fbls/shared'
import { publicApi, messageOf } from '../lib/api'
import { setFlash } from '../lib/state.svelte'

let form = $state({
  account_id: '',
  description: '',
  evidence: '',
  license_agreement: false,
  platform: '',
  threat_level: ''
})
let files = $state<FileList | null>(null)
let submitting = $state(false)

const submit = async (event: SubmitEvent) => {
  event.preventDefault()
  const formElement = event.currentTarget
  if (!(formElement instanceof HTMLFormElement)) return

  submitting = true
  setFlash(null)

  const body = new FormData()
  body.set('platform', form.platform)
  body.set('account_id', form.account_id)
  body.set('threat_level', form.threat_level)
  body.set('description', form.description)
  body.set('evidence', form.evidence)
  body.set('license_agreement', form.license_agreement ? 'yes' : 'no')
  for (const file of files ? [...files] : []) body.append('images', file)

  try {
    setFlash(messageOf('success', await publicApi.report(body)))
    form = {
      account_id: '',
      description: '',
      evidence: '',
      license_agreement: false,
      platform: '',
      threat_level: ''
    }
    files = null
    formElement.reset()
  } catch (error) {
    setFlash(messageOf('error', error instanceof Error ? error.message : '提交失败。'))
  } finally {
    submitting = false
  }
}
</script>

<svelte:head>
  <title>举报 - 福瑞联合净网行动</title>
</svelte:head>

<main class="single-panel">
  <div class="panel-header">
    <span class="eyebrow">Case Intake</span>
    <h1>举报提交</h1>
    <p>
      请围绕极端福瑞/反福瑞行为填写事实经过。审核通过后，平台、账号 ID、威胁程度与描述会被正式记录。
    </p>
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

    <label>账号 ID（如QQ号、UID等，注意不是用户名）
      <input
        bind:value={form.account_id}
        type="text"
        placeholder="例如：user_12345"
        required
      />
    </label>

    <label>威胁程度
      <select bind:value={form.threat_level} required>
        <option value="">请选择</option>
        {#each threatLevels as level}
          <option value={level}>
            {level}
            {#if level === '低'} - 轻微言论攻击/言论骚扰{/if}
            {#if level === '中'} - 较严重言论攻击/照片骚扰{/if}
            {#if level === '高'} - 反复骚扰，或对群聊构成威胁{/if}
            {#if level === '严重'} - 实施过炸群、网暴、开盒等极端行为{/if}
          </option>
        {/each}
      </select>
    </label>

    <label>描述
      <textarea
        bind:value={form.description}
        rows="5"
        placeholder="简述行为经过、时间线、风险点与针对性内容"
        required
      ></textarea>
    </label>

    <label>证据
      <textarea
        bind:value={form.evidence}
        rows="5"
        placeholder="填写截图链接、聊天记录、动态链接或其他证据说明"
        required
      ></textarea>
    </label>

    <label>补充图片证据
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        onchange={(event) => (files = (event.currentTarget as HTMLInputElement).files)}
      />
      <span class="field-hint">
        可上传最多 4 张图片，支持 JPG、PNG、WEBP、GIF，单张不超过 5MB。
      </span>
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
      {submitting ? '提交中' : '提交举报'}
    </button>
  </form>
</main>
