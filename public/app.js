const VIEW_TITLES = {
  dashboard: "我的资讯工作台",
  leader: "领导简报视图",
  employee: "员工资讯视图",
  regulation: "监管与交易所",
  peer: "同行动态与可借鉴经验",
  finance: "境内外金融要闻",
  variety: "品种异动",
  brief: "简报中心",
  status: "系统状态"
};

let state = {
  view: "dashboard",
  query: "",
  dashboard: null
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

async function loadDashboard() {
  const candidates = ["api/today", "data/live.json", "data/seed.json"];
  for (const url of candidates) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (response.ok) {
        const data = await response.json();
        return normalizeDashboard(data);
      }
    } catch {
      // Try the next source.
    }
  }
  return normalizeDashboard({ items: [] });
}

function normalizeDashboard(data) {
  if (data.metrics && data.briefs) return data;
  const items = data.items || [];
  const highItems = items.filter((item) => item.rank?.importance === "高");
  return {
    generatedAt: data.generatedAt || new Date().toISOString(),
    items,
    metrics: {
      high: highItems.length,
      peer: items.filter((item) => item.category?.id === "peer").length,
      finance: items.filter((item) => item.category?.id === "finance").length,
      variety: items.filter((item) => item.category?.id === "variety").length,
      official: items.filter((item) => item.source?.tier === "权威官方").length
    },
    briefs: {
      leader: items.filter((item) => item.rank?.importance !== "一般").slice(0, 8),
      employee: items.slice(0, 18),
      mustRead: highItems.slice(0, 10)
    },
    health: data.health || {
      status: "正常",
      successRate: "试运行",
      failedSources: 0,
      note: "当前使用示例数据；部署 Worker 后自动抓取公开来源。"
    }
  };
}

function filteredItems(categoryId) {
  const query = state.query.trim().toLowerCase();
  return state.dashboard.items.filter((item) => {
    const inCategory = !categoryId || item.category?.id === categoryId;
    const text = [item.title, item.summary, item.sourceName, item.why, ...(item.businessLines || []), ...(item.varieties || [])]
      .join(" ")
      .toLowerCase();
    return inCategory && (!query || text.includes(query));
  });
}

function renderMetrics() {
  const metrics = state.dashboard.metrics;
  const cards = [
    ["必须关注", metrics.high, "red"],
    ["同行可借鉴", metrics.peer, "green"],
    ["金融风险", metrics.finance, "orange"],
    ["品种异动", metrics.variety, "blue"],
    ["权威官方源", metrics.official, "gray"]
  ];

  $("#metrics").innerHTML = cards
    .map(([label, value, color]) => `<div class="metric-card"><span>${label}</span><strong class="${color}">${value}</strong></div>`)
    .join("");
}

function renderItem(item) {
  const template = $("#item-template").content.cloneNode(true);
  const card = template.querySelector(".news-card");
  const importanceClass = item.rank?.importance === "高" ? "red" : item.rank?.importance === "中" ? "orange" : "gray";
  template.querySelector(".card-meta").innerHTML = `
    <span class="pill ${importanceClass}">重要性：${item.rank?.importance || "一般"}</span>
    <span class="pill blue">${item.source?.tier || "公开来源"}</span>
    <span>${item.sourceName || "公开来源"}</span>
    <span>${formatTime(item.publishedAt)}</span>
  `;
  template.querySelector("h3").textContent = item.title;
  template.querySelector(".summary").textContent = item.summary || "暂无摘要，建议查看原文。";
  template.querySelector(".why").textContent = item.why || "系统已纳入日常资讯监控。";
  template.querySelector(".tags").innerHTML = [
    item.category?.label,
    ...(item.businessLines || []),
    ...(item.varieties || [])
  ]
    .filter(Boolean)
    .map((tag) => `<span class="pill gray">${tag}</span>`)
    .join("");
  const link = template.querySelector("a");
  link.href = item.url || "#";
  if (!item.url) link.style.display = "none";
  template.querySelector(".action").textContent = item.rank?.action || "一般参考";
  return card.outerHTML;
}

function section(title, items, subtitle = "") {
  return `
    <section class="section-block">
      <div class="section-title">
        <div>
          <h3>${title}</h3>
          ${subtitle ? `<p class="eyebrow">${subtitle}</p>` : ""}
        </div>
        <span class="pill blue">${items.length} 条</span>
      </div>
      <div class="news-list">
        ${items.length ? items.map(renderItem).join("") : `<div class="empty">当前没有匹配内容</div>`}
      </div>
    </section>
  `;
}

function renderDashboardView() {
  const mustRead = state.dashboard.briefs.mustRead;
  const useful = filteredItems().filter((item) => item.category?.id === "peer" || item.businessLines?.includes("管理参考")).slice(0, 6);
  const reportable = filteredItems().filter((item) => item.rank?.importance !== "一般").slice(0, 6);
  return [
    section("必须关注", mustRead, "监管、交易所、重大金融、品种风险和同行重大变化优先进入这里。"),
    section("对我有用", useful, "提炼同行经验、管理启发和业务参考。"),
    section("可汇报 / 可转发", reportable, "适合生成领导简报、晨会材料或员工资讯摘要。")
  ].join("");
}

function renderLeaderView() {
  const items = state.dashboard.briefs.leader;
  const lines = items.slice(0, 4).map((item) => `• ${item.title}：${item.why}`).join("");
  return `
    <section class="section-block">
      <div class="section-title">
        <div>
          <h3>今日结论</h3>
          <p class="eyebrow">面向领导阅读，控制数量，突出影响和建议关注。</p>
        </div>
        <span class="pill orange">可一键复制</span>
      </div>
      <pre class="brief-preview">${buildBriefText(items)}</pre>
    </section>
    ${section("今日重点清单", items)}
  `;
}

function renderEmployeeView() {
  const groups = ["经纪业务", "风控", "合规", "投研", "结算", "客户服务", "管理参考"];
  return groups
    .map((line) => {
      const items = filteredItems().filter((item) => item.businessLines?.includes(line)).slice(0, 5);
      return section(line, items, "展示与该条线直接相关的资讯。");
    })
    .join("");
}

function renderVarietyView() {
  const items = filteredItems("variety");
  return `
    <section class="section-block">
      <div class="section-title">
        <div>
          <h3>重点品种雷达</h3>
          <p class="eyebrow">围绕价格、成交、持仓、库存仓单、外盘联动和事件驱动做统一展示。</p>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>资讯</th>
              <th>品种板块</th>
              <th>风险提示</th>
              <th>来源</th>
              <th>建议动作</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item) => `
              <tr>
                <td>${item.title}</td>
                <td>${(item.varieties || ["综合"]).join("、")}</td>
                <td>${item.why}</td>
                <td>${item.sourceName}</td>
                <td>${item.rank?.action || "一般参考"}</td>
              </tr>
            `).join("") || `<tr><td colspan="5" class="empty">暂无品种异动</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
    ${section("品种相关资讯", items)}
  `;
}

function renderBriefView() {
  const items = state.dashboard.briefs.leader;
  return `
    <section class="section-block">
      <div class="section-title">
        <div>
          <h3>简报预览</h3>
          <p class="eyebrow">适合复制给领导、部门群、晨会或周报素材。</p>
        </div>
        <span class="pill green">自动生成</span>
      </div>
      <pre class="brief-preview">${buildBriefText(items)}</pre>
    </section>
    <section class="section-block">
      <div class="section-title"><h3>简报模板</h3></div>
      <div class="news-list">
        <article class="news-card"><h3>每日早报</h3><p class="summary">突出监管、交易所、金融要闻和品种风险。</p></article>
        <article class="news-card"><h3>收盘简报</h3><p class="summary">突出盘中异动、重点品种和业务提醒。</p></article>
        <article class="news-card"><h3>行业周报</h3><p class="summary">沉淀同行经验、风险案例和管理参考。</p></article>
      </div>
    </section>
  `;
}

function renderStatusView() {
  const health = state.dashboard.health || {};
  return `
    <section class="section-block">
      <div class="section-title">
        <div>
          <h3>系统自动运行状态</h3>
          <p class="eyebrow">正常情况下不用人工维护，出现异常时用于定位问题。</p>
        </div>
        <span class="pill green">${health.status || "正常"}</span>
      </div>
      <div class="table-wrap">
        <table>
          <tbody>
            <tr><th>最近更新</th><td>${formatTime(state.dashboard.generatedAt)}</td></tr>
            <tr><th>抓取成功率</th><td>${health.successRate || "待统计"}</td></tr>
            <tr><th>异常来源</th><td>${health.failedSources ?? 0}</td></tr>
            <tr><th>运行说明</th><td>${health.note || "系统自动抓取、去重、评分、摘要和归档。"}</td></tr>
            <tr><th>部署方式</th><td>Cloudflare Pages / Workers 免费方案，支持 pages.dev 免费地址。</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderCategoryView(categoryId, title, subtitle) {
  return section(title, filteredItems(categoryId), subtitle);
}

function renderDecisionPanel() {
  const items = state.dashboard.briefs.mustRead.length ? state.dashboard.briefs.mustRead : state.dashboard.items.slice(0, 5);
  $("#decision-list").innerHTML = items
    .slice(0, 5)
    .map((item) => `<div class="decision-item"><strong>${item.title}</strong><span>${item.rank?.action || "建议关注"} · ${item.category?.label || "综合资讯"}</span></div>`)
    .join("");
}

function render() {
  $("#view-title").textContent = VIEW_TITLES[state.view];
  $("#freshness").textContent = formatTime(state.dashboard.generatedAt);
  $("#daily-summary").textContent = buildDailySummary();
  renderMetrics();
  renderDecisionPanel();

  const root = $("#view-root");
  if (state.view === "dashboard") root.innerHTML = renderDashboardView();
  if (state.view === "leader") root.innerHTML = renderLeaderView();
  if (state.view === "employee") root.innerHTML = renderEmployeeView();
  if (state.view === "regulation") root.innerHTML = renderCategoryView("regulation", "监管与交易所", "自动关注监管、交易所、保证金、涨跌停、交割、手续费和异常交易。");
  if (state.view === "peer") root.innerHTML = renderCategoryView("peer", "同行动态与可借鉴经验", "提炼先进管理经验、数字化实践、风险案例和重大变动。");
  if (state.view === "finance") root.innerHTML = renderCategoryView("finance", "境内外金融要闻", "关注央行政策、利率汇率、股债市场、海外监管、地缘风险和重要数据。");
  if (state.view === "variety") root.innerHTML = renderVarietyView();
  if (state.view === "brief") root.innerHTML = renderBriefView();
  if (state.view === "status") root.innerHTML = renderStatusView();
}

function buildDailySummary() {
  const metrics = state.dashboard.metrics;
  const high = metrics.high ? `今日有 ${metrics.high} 条必须关注信息` : "今日暂无高优先级信息";
  return `${high}；同行动态 ${metrics.peer} 条，金融要闻 ${metrics.finance} 条，品种异动 ${metrics.variety} 条。系统已按来源权威性、业务影响和时效性自动排序。`;
}

function buildBriefText(items) {
  const date = new Date().toLocaleDateString("zh-CN");
  const lines = items.slice(0, 8).map((item, index) => {
    return `${index + 1}. ${item.title}\n   来源：${item.sourceName}｜重要性：${item.rank?.importance || "一般"}\n   为什么重要：${item.why}`;
  });
  return `期货行业资讯简报（${date}）\n\n今日结论：${buildDailySummary()}\n\n${lines.join("\n\n")}\n\n说明：以上内容由系统基于公开来源自动整理，阅读和转发时以原文为准。`;
}

function formatTime(value) {
  if (!value) return "时间待确认";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function wireEvents() {
  $$(".nav-item").forEach((button) => {
    button.addEventListener("click", () => {
      $$(".nav-item").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      state.view = button.dataset.view;
      render();
    });
  });

  $("#search-input").addEventListener("input", (event) => {
    state.query = event.target.value;
    render();
  });

  $("#copy-brief").addEventListener("click", async () => {
    const text = buildBriefText(state.dashboard.briefs.leader);
    await navigator.clipboard.writeText(text);
    $("#copy-brief").textContent = "已复制";
    setTimeout(() => ($("#copy-brief").textContent = "复制今日简报"), 1400);
  });
}

state.dashboard = await loadDashboard();
wireEvents();
render();
