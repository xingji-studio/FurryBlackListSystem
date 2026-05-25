<script lang="ts">
import { Router } from '@mateothegreat/svelte5-router'
import { routes, routerConfig } from './routes'
import { flash } from './lib/state.svelte'
</script>

<svelte:head>
  <title>后台管理 - 黑名单系统</title>
</svelte:head>

<div class="page-shell">
  {#if flash.item}
    <div class="flash-stack">
      <div class={`flash flash-${flash.item.kind}`}>{flash.item.message}</div>
    </div>
  {/if}
  <Router {routes} {...routerConfig} />
</div>
