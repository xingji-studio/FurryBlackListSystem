<script lang="ts">
import { route } from '@mateothegreat/svelte5-router'

const submissionType =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('type') === 'appeal'
    ? 'appeal'
    : 'report'

const title = submissionType === 'appeal' ? '申诉提交成功' : '举报提交成功'
const detail =
  submissionType === 'appeal'
    ? '你的申诉材料已经提交成功，当前正在等待管理员审核，请留意后续处理结果。'
    : '你的举报材料已经提交成功，当前正在等待管理员审核，请留意后续处理结果。'
</script>

<svelte:head>
  <title>{title} - 福瑞联合净网行动</title>
</svelte:head>

<main class="single-panel">
  <section class="form-panel success-panel">
    <div class="success-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 12.5 9.2 16.7 19 7.5" />
      </svg>
    </div>

    <div class="panel-header">
      <span class="eyebrow">Submission Received</span>
      <h1>{title}</h1>
      <p>{detail}</p>
    </div>

    <div class="success-actions">
      <a class="primary-button" href="/" use:route>返回首页</a>
      <a class="secondary-button" href="/search" use:route>前往查询</a>
    </div>
  </section>
</main>
