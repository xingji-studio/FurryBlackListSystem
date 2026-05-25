<script lang="ts">
import { route } from '@mateothegreat/svelte5-router'
import { clientLinks } from '@fbls/shared'
</script>

<svelte:head>
  <title>极端福瑞/反福瑞档案库 - 福瑞联合净网行动</title>
</svelte:head>

<main class="hero hero-home">
  <section class="hero-copy dossier">
    <div class="hero-label-row">
      <span class="eyebrow">公开登记与检索</span>
    </div>
    <h1>极端福瑞/反福瑞行为档案库</h1>
    <p>
      这里用于收集、核验和公开检索针对福瑞群体的极端骚扰、煽动、网暴与持续性敌意行为。所有举报和申诉都必须经过后台人工复核后才会生效。
    </p>
    <div class="hero-metrics">
      <div>
        <span>流程</span>
        <strong>提交 → 审核 → 入档</strong>
      </div>
      <div>
        <span>原则</span>
        <strong>留痕、克制、可复核</strong>
      </div>
    </div>
  </section>

  <section class="mission-strip">
    <a class="mission-card" href="/report" use:route>
      <span class="mission-index">01</span>
      <h2>举报入口</h2>
      <p>提交平台、账号 ID、威胁程度、经过描述与证据材料，等待管理员审核。</p>
      <span class="text-link">进入举报</span>
    </a>
    <a class="mission-card" href="/search" use:route>
      <span class="mission-index">02</span>
      <h2>公开查询</h2>
      <p>按平台与账号检索，快速判断目标是否已经被审核记录在案。</p>
      <span class="text-link">进入查询</span>
    </a>
    <a class="mission-card" href="/appeal" use:route>
      <span class="mission-index">03</span>
      <h2>申诉复核</h2>
      <p>若存在误收录，可提交申诉与补充证据，经复核后移出黑名单。</p>
      <span class="text-link">进入申诉</span>
    </a>
  </section>

  <section class="home-bottom-grid">
    <article class="note-panel">
      <span class="eyebrow">提交建议</span>
      <h2>尽量提供可核验材料</h2>
      <p>建议提交截图、原链接、聊天记录、时间线整理和账号主页信息。证据越完整，审核越快。</p>
    </article>
    <article class="quote-panel">
      <span class="eyebrow">站点立场</span>
      <p>
        这不是情绪宣泄墙，而是用来记录针对福瑞群体的实际恶意行为的公开档案页。我们坚持用事实说话，保护公众安全。
      </p>
    </article>
  </section>

  <a class="archive-panel" href={clientLinks.apk}>
    <span class="eyebrow">客户端</span>
    <h2>下载手机客户端</h2>
    <p>直接在手机上快速进行举报与筛选。</p>
    <span class="text-link">立刻下载</span>
  </a>
</main>
