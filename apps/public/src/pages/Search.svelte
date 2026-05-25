<script lang="ts">
import { route } from '@mateothegreat/svelte5-router'
import { platforms, type SearchPayload } from '@fbls/shared'
import { publicApi, messageOf } from '../lib/api'
import { setFlash } from '../lib/state.svelte'

let platform = $state('')
let accountId = $state('')
let result = $state<SearchPayload | null>(null)
let loading = $state(false)

const submit = async (event: SubmitEvent) => {
  event.preventDefault()
  loading = true
  result = null
  setFlash(null)
  try {
    result = await publicApi.search(platform, accountId)
  } catch (error) {
    setFlash(messageOf('error', error instanceof Error ? error.message : '查询失败。'))
  } finally {
    loading = false
  }
}
</script>

<svelte:head>
  <title>查询 - 福瑞联合净网行动</title>
</svelte:head>

<main class="single-panel">
  <div class="panel-header">
    <span class="eyebrow">Archive Lookup</span>
    <h1>黑名单查询</h1>
    <p>
      输入平台和账号名，页面会调用公开 API 检索已通过审核的记录。你也可以在外部程序中直接请求同一个接口。
    </p>
  </div>

  <form class="form-panel compact" novalidate onsubmit={submit}>
    <label>平台
      <select bind:value={platform} required>
        <option value="">请选择平台</option>
        {#each platforms as item}
          <option value={item}>{item}</option>
        {/each}
      </select>
    </label>

    <label>账号名 / 账号 ID
      <input bind:value={accountId} type="text" placeholder="例如：user_12345" required />
    </label>

    <button class="primary-button" type="submit">
      {loading ? '查询中' : '开始查询'}
    </button>
  </form>

  {#if loading}
    <section class="result-panel api-result-panel">
      <h2>查询中</h2>
      <p>正在请求公开 API，请稍候。</p>
    </section>
  {:else if result?.found && result.entry}
    <section class="result-panel api-result-panel danger">
      <h2>查询结果：命中黑名单</h2>
      <dl>
        <div><dt>平台</dt><dd>{result.entry.platform}</dd></div>
        <div><dt>账号 ID</dt><dd>{result.entry.account_id}</dd></div>
        <div><dt>威胁程度</dt><dd>{result.entry.threat_level}</dd></div>
        <div><dt>描述</dt><dd>{result.entry.description}</dd></div>
        <div><dt>录入时间</dt><dd>{result.entry.created_at}</dd></div>
        <div><dt>最后更新</dt><dd>{result.entry.updated_at}</dd></div>
      </dl>
      {#if result.entry.images.length}
        <div class="evidence-gallery">
          {#each result.entry.images as image}
            <a class="evidence-thumb" href={image.url} target="_blank" rel="noopener noreferrer">
              <span>{image.filename}</span>
            </a>
          {/each}
        </div>
      {/if}
    </section>
  {:else if result}
    <section class="result-panel api-result-panel safe">
      <h2>查询结果：未命中</h2>
      <p>
        当前黑名单中没有找到 <strong>{result.query.platform}</strong> 平台下账号
        <strong>{result.query.account_id}</strong> 的审核通过记录。
      </p>
    </section>
  {/if}
</main>
