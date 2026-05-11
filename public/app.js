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
  dashboard: null,
  loading: true
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

// ── 数据加载 ──────────────────────────────────────────────────────────────

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
      // 尝试下一个来源
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
      status: "等待数据",
      successRate: "待统计",
      failedSources: 0,
      note: "当前使用示例数据；部署 Worker 后自动抓取公开来源。"
    }
  };
}

// ── 筛选 ──────────────────────────────────────────────────────────────────

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

// ── 渲染组件 ──────────────────────────────────────────────────────────────

function renderMetrics() {
  const m = state.dashboard.metrics;
  const cards = [
    ["必须关注", m.high, "red"],
    ["同行可借鉴", m.peer, "green"],
    ["金融风险", m.finance, "orange"],
    ["品种异动", m.variety, "blue"],
    ["权威官方源", m.official, "gray"]
  ];
  $("#metrics").innerHTML = cards
    .map(([label, value, color]) =>
      `<div class="metric-card"><span>${label}</span><strong class="${color}">${value}</strong></div>`
    )
    .join("");
}

function renderItem(item) {
  const template = $("#item-template").content.cloneNode(true);
  const card = template.querySelector(".news-card");
  const importanceClass = item.rank?.importance === "高" ? "red" : item.rank?.importance === "中" ? "orange" : "gray";

  // 时间展示：若有发布时间则显示，否则显示"时间待确认"
  const timeStr = item.publishedAt ? formatTime(item.publishedAt) : '<span class="no-time">时间待确认</span>';

  template.querySelector(".card-meta").innerHTML = `
    <span class="pill ${importanceClass}">重要性：${item.rank?.importance || "一般"}</span>
    <span class="pill blue">${item.source?.tier || "公开来源"}</span>
    <span>${item.sourceName || "公开来源"}</span>
    <span class="time-badge">${timeStr}</span>
  `;
  template.querySelector("h3").textContent = item.title;

  // 若摘要是通用占位符，给出提示文字
  const rawSummary = item.summary || "";
  const isGenericSummary = rawSummary.includes("发布的最新公告") || rawSummary.includes("页面发现相关链接");
  template.querySelector(".summary").textContent = isGenericSummary ? "（摘要待系统提取，建议点击查看原文）" : rawSummary;
  template.querySelector(".summary").classList.toggle("muted-summary", isGenericSummary);

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
  if (!items.length) {
    return `
      <section class="section-block">
        <div class="section-title">
          <div>
            <h3>${title}</h3>
            ${subtitle ? `<p class="eyebrow">${subtitle}</p>` : ""}
          </div>
          <span class="pill gray">0 条</span>
        </div>
        ${renderEmpty(title)}
      </section>
    `;
  }
  return `
    <section class="section-block">
      <div class="section-title">
        <div>
          <h3>${title}</h3>
          ${subtitle ? `<p class="eyebrow">${subtitle}</p>` : ""}
        </div>
        <span class="pill blue">${items.length} 条</span>
      </div>
      <div class="news-list">${items.map(renderItem).join("")}</div>
    </section>
  `;
}

function renderEmpty(sectionName = "") {
  const hints = {
    "必须关注": "今日暂无高优先级信息，系统将持续监控。",
    "同行动态与可借鉴经验": "同行动态来源正在接入中，下次抓取后将自动填充。",
    "品种异动": "今日暂无显著品种异动。",
    default: "当前没有匹配内容，系统正在自动更新中。"
  };
  return `<div class="empty-state"><p>${hints[sectionName] || hints.default}</p></div>`;
}

// 数据完全为空时的全局提示
function renderGlobalEmpty() {
  return `
    <section class="section-block empty-global">
      <div class="empty-global-icon">📡</div>
      <h3>数据更新中</h3>
      <p>系统正在从证监会、交易所、期货日报等公开来源抓取今日资讯。</p>
      <p class="eyebrow">GitHub Actions 将在下一个整点自动完成更新，也可手动触发 Actions 立即抓取。</p>
      <button class="ghost-button" onclick="location.reload()">刷新页面</button>
    </section>
  `;
}

// ── 视图渲染 ──────────────────────────────────────────────────────────────

function renderDashboardView() {
  if (state.dashboard.items.length === 0) return renderGlobalEmpty();
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
      ${items.length ? `
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>资讯</th><th>品种板块</th><th>风险提示</th><th>来源</th><th>建议动作</th></tr>
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
            `).join("")}
          </tbody>
        </table>
      </div>` : renderEmpty("品种异动")}
    </section>
    ${items.length ? section("品种相关资讯", items) : ""}
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
  const itemCount = state.dashboard.items.length;
  return `
    <section class="section-block">
      <div class="section-title">
        <div>
          <h3>系统自动运行状态</h3>
          <p class="eyebrow">正常情况下不用人工维护，出现异常时用于定位问题。</p>
        </div>
        <span class="pill ${health.status === "正常" ? "green" : "orange"}">${health.status || "正常"}</span>
      </div>
      <div class="table-wrap">
        <table>
          <tbody>
            <tr><th>最近更新</th><td>${formatTime(state.dashboard.generatedAt)}</td></tr>
            <tr><th>当前数据量</th><td>${itemCount} 条</td></tr>
            <tr><th>抓取成功率</th><td>${health.successRate || "待统计"}</td></tr>
            <tr><th>异常来源数</th><td>${health.failedSources ?? 0}</td></tr>
            <tr><th>运行耗时</th><td>${health.durationMs ? health.durationMs + " ms" : "—"}</td></tr>
            <tr><th>运行说明</th><td>${health.note || "系统自动抓取、去重、评分、摘要和归档。"}</td></tr>
            <tr><th>部署方式</th><td>GitHub Pages + GitHub Actions 免费方案，工作日每小时抓取。</td></tr>
            <tr><th>数据源数量</th><td>13 个（监管机构 2 + 交易所 5 + 经济数据 2 + 协会/媒体 2 + 海外 2）</td></tr>
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
  const items = state.dashboard.briefs.mustRead.length
    ? state.dashboard.briefs.mustRead
    : state.dashboard.items.slice(0, 5);
  if (!items.length) {
    $("#decision-list").innerHTML = `<div class="empty-state" style="padding:12px 0"><p>今日暂无重点信息</p></div>`;
    return;
  }
  $("#decision-list").innerHTML = items
    .slice(0, 5)
    .map((item) =>
      `<div class="decision-item">
        <strong>${item.title}</strong>
        <span>${item.rank?.action || "建议关注"} · ${item.category?.label || "综合资讯"}</span>
       </div>`
    )
    .join("");
}

// ── 主渲染入口 ────────────────────────────────────────────────────────────

function render() {
  if (state.loading) {
    renderSkeleton();
    return;
  }

  $("#view-title").textContent = VIEW_TITLES[state.view];
  $("#freshness").textContent = formatTime(state.dashboard.generatedAt);
  $("#daily-summary").textContent = buildDailySummary();
  renderMetrics();
  renderDecisionPanel();

  const root = $("#view-root");
  if (state.view === "dashboard")  root.innerHTML = renderDashboardView();
  if (state.view === "leader")     root.innerHTML = renderLeaderView();
  if (state.view === "employee")   root.innerHTML = renderEmployeeView();
  if (state.view === "regulation") root.innerHTML = renderCategoryView("regulation", "监管与交易所", "自动关注监管、交易所、保证金、涨跌停、交割、手续费和异常交易。");
  if (state.view === "peer")       root.innerHTML = renderCategoryView("peer", "同行动态与可借鉴经验", "提炼先进管理经验、数字化实践、风险案例和重大变动。");
  if (state.view === "finance")    root.innerHTML = renderCategoryView("finance", "境内外金融要闻", "关注央行政策、利率汇率、股债市场、海外监管、地缘风险和重要数据。");
  if (state.view === "variety")    root.innerHTML = renderVarietyView();
  if (state.view === "brief")      root.innerHTML = renderBriefView();
  if (state.view === "status")     root.innerHTML = renderStatusView();
}

function renderSkeleton() {
  $("#daily-summary").textContent = "正在加载资讯数据...";
  $("#freshness").textContent = "--";
  $("#metrics").innerHTML = Array(5).fill(
    `<div class="metric-card skeleton"><span></span><strong></strong></div>`
  ).join("");
  $("#view-root").innerHTML = Array(3).fill(
    `<section class="section-block skeleton-block">
       <div class="section-title"><div><div class="sk-line sk-title"></div><div class="sk-line sk-sub"></div></div></div>
       <div class="news-list">${Array(2).fill(`<article class="news-card"><div class="sk-line sk-h3"></div><div class="sk-line"></div><div class="sk-line sk-short"></div></article>`).join("")}</div>
     </section>`
  ).join("");
  $("#decision-list").innerHTML = Array(3).fill(
    `<div class="decision-item"><div class="sk-line sk-h3"></div><div class="sk-line sk-short"></div></div>`
  ).join("");
}

// ── 文字构建 ──────────────────────────────────────────────────────────────

function buildDailySummary() {
  const m = state.dashboard.metrics;
  if (!state.dashboard.items.length) return "暂无数据，系统将在下一次定时任务后自动更新。";
  const high = m.high ? `今日有 ${m.high} 条必须关注信息` : "今日暂无高优先级信息";
  return `${high}；同行动态 ${m.peer} 条，金融要闻 ${m.finance} 条，品种异动 ${m.variety} 条。系统已按来源权威性、业务影响和时效性自动排序。`;
}

function buildBriefText(items) {
  const date = new Date().toLocaleDateString("zh-CN");
  if (!items.length) return `期货行业资讯简报（${date}）\n\n今日数据正在更新中，请稍后刷新。`;
  const lines = items.slice(0, 8).map((item, i) =>
    `${i + 1}. ${item.title}\n   来源：${item.sourceName}｜重要性：${item.rank?.importance || "一般"}\n   为什么重要：${item.why}`
  );
  return `期货行业资讯简报（${date}）\n\n今日结论：${buildDailySummary()}\n\n${lines.join("\n\n")}\n\n说明：以上内容由系统基于公开来源自动整理，阅读和转发时以原文为准。`;
}

function formatTime(value) {
  if (!value) return "时间待确认";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// ── 事件绑定 ──────────────────────────────────────────────────────────────

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

  $("#refresh-btn").addEventListener("click", async () => {
    const btn = $("#refresh-btn");
    btn.disabled = true;
    btn.textContent = "更新中...";
    state.loading = true;
    render();
    state.dashboard = await loadDashboard();
    state.loading = false;
    render();
    btn.disabled = false;
    btn.textContent = "刷新数据";
  });
}

// ── 初始化 ────────────────────────────────────────────────────────────────

render(); // 先渲染骨架屏
state.dashboard = await loadDashboard();
state.loading = false;
wireEvents();
render();
