<script lang="ts">
type Props = { target?: string }
let { target = '首页' }: Props = $props()
</script>

<main class="single-panel">
  <div class="panel-header">
    <span class="eyebrow">404</span>
    <h1>页面不存在</h1>
    <p>请求的页面不存在，返回{target}继续操作。</p>
    <a class="text-link" href="/">返回{target}</a>
  </div>
</main>
