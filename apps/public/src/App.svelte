<script lang="ts">
import { Router, route } from '@mateothegreat/svelte5-router'
import { clientLinks } from '@fbls/shared'
import { routes, routerConfig } from './routes'
import { flash } from './lib/state.svelte'
import { publicApi } from './lib/api'

let sponsorOpen = $state(false)

const closeSponsor = () => {
  sponsorOpen = false
  document.body.classList.remove('modal-open')
}

const openSponsor = () => {
  sponsorOpen = true
  document.body.classList.add('modal-open')
}

const onKey = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && sponsorOpen) closeSponsor()
}
</script>

<svelte:head>
  <title>福瑞联合净网行动</title>
</svelte:head>

<svelte:window on:keydown={onKey} />

<div class="page-shell">
  <header class="site-nav">
    <a class="site-brand" href="/" use:route>福瑞净网行动</a>
    <nav class="site-links" aria-label="外部链接">
      <a class="nav-tab" href={clientLinks.team} target="_blank" rel="noopener noreferrer">
        开发团队
      </a>
      <a class="nav-tab" href={clientLinks.org} target="_blank" rel="noopener noreferrer">
        附属组织
      </a>
      <a class="nav-tab" href={clientLinks.docs} target="_blank" rel="noopener noreferrer">
        开发文档
      </a>
      <button class="nav-tab nav-button" type="button" onclick={openSponsor}>赞助</button>
    </nav>
  </header>

  <section class="compliance-banner" role="alert" aria-live="polite">
    <strong>严禁上传反动敏感内容，一经发现，移交警方处理</strong>
  </section>

  {#if sponsorOpen}
    <div class="sponsor-modal">
      <button class="sponsor-backdrop" type="button" aria-label="关闭赞助弹窗" onclick={closeSponsor}></button>
      <div class="sponsor-panel" role="dialog" aria-modal="true" aria-labelledby="sponsor-title">
        <button class="sponsor-close" type="button" aria-label="关闭赞助弹窗" onclick={closeSponsor}>
          ×
        </button>
        <span class="eyebrow">Support</span>
        <h2 id="sponsor-title">赞赏码</h2>
        <img class="sponsor-image" src={publicApi.imageUrl()} alt="赞赏码" />
      </div>
    </div>
  {/if}

  {#if flash.item}
    <div class="flash-stack">
      <div class={`flash flash-${flash.item.kind}`}>
        {flash.item.message}
      </div>
    </div>
  {/if}

  <Router {routes} {...routerConfig} />
</div>
