(function () {
  const form = document.getElementById("search-form");
  const feedback = document.getElementById("search-feedback");

  if (!form || !feedback) {
    return;
  }

  const endpoint = form.dataset.apiEndpoint || "/api/blacklist/search";

  const escapeHtml = (value) =>
    String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[char]));

  const renderNotFound = (query) => {
    feedback.hidden = false;
    feedback.className = "result-panel api-result-panel safe";
    feedback.innerHTML = `
      <h2>查询结果：未命中</h2>
      <p>当前黑名单中没有找到 <strong>${escapeHtml(query.platform)}</strong> 平台下账号 <strong>${escapeHtml(query.account_id)}</strong> 的审核通过记录。</p>
    `;
  };

  const renderFound = (entry) => {
    const images = Array.isArray(entry.images) ? entry.images : [];
    const galleryHtml = images.length
      ? `
        <div class="evidence-gallery">
          ${images.map((image) => `
            <a class="evidence-thumb" href="${escapeHtml(image.url)}" target="_blank" rel="noopener noreferrer">
              <span>${escapeHtml(image.filename)}</span>
            </a>
          `).join("")}
        </div>
      `
      : "";

    feedback.hidden = false;
    feedback.className = "result-panel api-result-panel danger";
    feedback.innerHTML = `
      <h2>查询结果：命中黑名单</h2>
      <dl>
        <div><dt>平台</dt><dd>${escapeHtml(entry.platform)}</dd></div>
        <div><dt>账号 ID</dt><dd>${escapeHtml(entry.account_id)}</dd></div>
        <div><dt>威胁程度</dt><dd>${escapeHtml(entry.threat_level)}</dd></div>
        <div><dt>描述</dt><dd>${escapeHtml(entry.description)}</dd></div>
        <div><dt>录入时间</dt><dd>${escapeHtml(entry.created_at)}</dd></div>
        <div><dt>最后更新</dt><dd>${escapeHtml(entry.updated_at)}</dd></div>
      </dl>
      ${galleryHtml}
    `;
  };

  const renderError = (message) => {
    feedback.hidden = false;
    feedback.className = "result-panel api-result-panel";
    feedback.innerHTML = `
      <h2>查询失败</h2>
      <p>${escapeHtml(message)}</p>
    `;
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const query = {
      platform: String(formData.get("platform") || "").trim(),
      account_id: String(formData.get("account_id") || "").trim(),
    };

    feedback.hidden = false;
    feedback.className = "result-panel api-result-panel";
    feedback.innerHTML = "<h2>查询中</h2><p>正在请求公开 API，请稍候。</p>";

    try {
      const response = await fetch(`${endpoint}?${new URLSearchParams(query).toString()}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        renderError(payload.error || "查询失败。");
        return;
      }
      if (payload.found) {
        renderFound(payload.entry);
        return;
      }
      renderNotFound(payload.query);
    } catch (error) {
      renderError("无法连接查询接口，请稍后重试。");
    }
  });
})();
