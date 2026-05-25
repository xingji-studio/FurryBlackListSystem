<script lang="ts">
import { onMount } from 'svelte'
import { adminApi, messageOf } from '../lib/api'
import { isAuthed, setAuth } from '../lib/auth.svelte'
import { setFlash } from '../lib/state.svelte'
import { threatLevels, type DashboardPayload } from '@fbls/shared'

let data = $state<DashboardPayload | null>(null)
let loading = $state(true)

const load = async () => {
  if (!isAuthed()) {
    window.location.assign('/')
    return
  }
  loading = true
  try {
    data = await adminApi.dashboard()
  } catch (error) {
    setFlash(messageOf('error', error instanceof Error ? error.message : '加载失败。'))
    if (!isAuthed()) window.location.assign('/')
  } finally {
    loading = false
  }
}

const run = async (task: Promise<string>) => {
  try {
    setFlash(messageOf('success', await task))
    await load()
  } catch (error) {
    setFlash(messageOf('error', error instanceof Error ? error.message : '操作失败。'))
  }
}

const logout = async () => {
  try {
    await adminApi.logout()
  } finally {
    setAuth(null)
    window.location.assign('/')
  }
}

onMount(() => {
  load()
})
</script>

<svelte:head>
  <title>后台管理 - 黑名单系统</title>
</svelte:head>

{#if loading}
  <main class="admin-layout">
    <div class="empty-state">加载中。</div>
  </main>
{:else if data}
  <main class="admin-layout">
    <header class="admin-header dossier">
      <div>
        <span class="eyebrow">审核与档案维护</span>
        <h1>后台管理页</h1>
        <p class="header-copy">
          这里处理举报、申诉与黑名单档案。通过审核后，记录会自动增删，不需要手动同步。
        </p>
      </div>
      <div class="admin-controls">
        <button class="secondary-button" type="button" onclick={() => adminApi.download('database')}>
          导出数据库
        </button>
        <button
          class="secondary-button"
          type="button"
          onclick={() => adminApi.download('report-traces')}
        >
          导出举报溯源文件
        </button>
        <button class="secondary-button" type="button" onclick={logout}>退出登录</button>
      </div>
    </header>

    <section class="admin-section">
      <div class="section-title">
        <h2>待审核举报</h2>
        <span>{data.reports.length} 条</span>
      </div>
      {#if data.reports.length}
        <div class="review-grid">
          {#each data.reports as report}
            <article class="review-card">
              <h3>#{report.id} {report.platform} / {report.account_id}</h3>
              <div class="meta-strip">
                <span class="badge badge-danger">{report.threat_level}</span>
                <span>{report.created_at}</span>
              </div>
              <p><strong>威胁程度：</strong>{report.threat_level}</p>
              <p><strong>描述：</strong>{report.description}</p>
              <p><strong>证据：</strong>{report.evidence}</p>
              {#if report.images.length}
                <div class="evidence-gallery">
                  {#each report.images as image}
                    <a class="evidence-thumb" href={image.url} target="_blank" rel="noopener noreferrer">
                      <img src={image.url} alt={image.filename} />
                      <span>{image.filename}</span>
                    </a>
                  {/each}
                </div>
              {/if}
              <label>
                最终威胁程度
                <select name="threat_level" required form={`approve-report-${report.id}`}>
                  {#each threatLevels as level}
                    <option value={level} selected={level === report.threat_level}>{level}</option>
                  {/each}
                </select>
              </label>
              <div class="action-row">
                <form
                  id={`approve-report-${report.id}`}
                  onsubmit={(event) => {
                    event.preventDefault()
                    const form = new FormData(event.currentTarget as HTMLFormElement)
                    run(
                      adminApi.approveReport(
                        report.id,
                        String(form.get('admin_note') || ''),
                        String(form.get('threat_level') || '')
                      )
                    )
                  }}
                >
                  <textarea name="admin_note" rows="2" placeholder="审核备注（可选）"></textarea>
                  <button class="primary-button" type="submit">通过并加入黑名单</button>
                </form>
                <form
                  onsubmit={(event) => {
                    event.preventDefault()
                    const form = new FormData(event.currentTarget as HTMLFormElement)
                    run(adminApi.rejectReport(report.id, String(form.get('admin_note') || '')))
                  }}
                >
                  <textarea name="admin_note" rows="2" placeholder="驳回原因（可选）"></textarea>
                  <button class="danger-button" type="submit">驳回举报</button>
                </form>
              </div>
            </article>
          {/each}
        </div>
      {:else}
        <div class="empty-state">当前没有待审核举报。</div>
      {/if}
    </section>

    <section class="admin-section">
      <div class="section-title">
        <h2>待审核申诉</h2>
        <span>{data.appeals.length} 条</span>
      </div>
      {#if data.appeals.length}
        <div class="review-grid">
          {#each data.appeals as appeal}
            <article class="review-card">
              <h3>#{appeal.id} {appeal.platform} / {appeal.account_id}</h3>
              <div class="meta-strip">
                <span class="badge">申诉</span>
                <span>{appeal.created_at}</span>
              </div>
              <p><strong>描述：</strong>{appeal.description}</p>
              <p><strong>证据：</strong>{appeal.evidence}</p>
              <div class="action-row">
                <form
                  onsubmit={(event) => {
                    event.preventDefault()
                    const form = new FormData(event.currentTarget as HTMLFormElement)
                    run(adminApi.approveAppeal(appeal.id, String(form.get('admin_note') || '')))
                  }}
                >
                  <textarea name="admin_note" rows="2" placeholder="审核备注（可选）"></textarea>
                  <button class="primary-button" type="submit">通过并移出黑名单</button>
                </form>
                <form
                  onsubmit={(event) => {
                    event.preventDefault()
                    const form = new FormData(event.currentTarget as HTMLFormElement)
                    run(adminApi.rejectAppeal(appeal.id, String(form.get('admin_note') || '')))
                  }}
                >
                  <textarea name="admin_note" rows="2" placeholder="驳回原因（可选）"></textarea>
                  <button class="danger-button" type="submit">驳回申诉</button>
                </form>
              </div>
            </article>
          {/each}
        </div>
      {:else}
        <div class="empty-state">当前没有待审核申诉。</div>
      {/if}
    </section>

    <section class="admin-section">
      <div class="section-title">
        <h2>当前黑名单</h2>
        <span>{data.blacklistEntries.length} 条</span>
      </div>
      {#if data.blacklistEntries.length}
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>平台</th>
                <th>账号 ID</th>
                <th>威胁程度</th>
                <th>描述</th>
                <th>更新时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {#each data.blacklistEntries as entry}
                <tr>
                  <td>{entry.id}</td>
                  <td>{entry.platform}</td>
                  <td>{entry.account_id}</td>
                  <td>{entry.threat_level}</td>
                  <td>
                    <div>{entry.description}</div>
                    {#if entry.images.length}
                      <div class="evidence-gallery evidence-gallery-inline">
                        {#each entry.images as image}
                          <a
                            class="evidence-thumb"
                            href={image.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <img src={image.url} alt={image.filename} />
                            <span>{image.filename}</span>
                          </a>
                        {/each}
                      </div>
                    {/if}
                  </td>
                  <td>{entry.updated_at}</td>
                  <td>
                    <form
                      class="table-action-form"
                      onsubmit={(event) => {
                        event.preventDefault()
                        if (confirm('确认删除这条已过审黑名单记录吗？')) {
                          run(adminApi.removeEntry(entry.id))
                        }
                      }}
                    >
                      <button class="danger-button" type="submit">删除</button>
                    </form>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <div class="empty-state">黑名单当前为空。</div>
      {/if}
    </section>
  </main>
{/if}
