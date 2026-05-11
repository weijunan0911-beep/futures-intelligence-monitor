import { writeFile, readFile } from "node:fs/promises";
import { buildDashboard } from "../src/engine.mjs";

// ── 数据源配置 ─────────────────────────────────────────────────────────────
// Google News RSS：聚合全网新闻，有真实时间+摘要+来源，稳定可靠
// 官方 HTML：证监会/期货业协会/央行等可正常抓取的官方页面
//
// 删除：五大交易所（JS渲染无法抓取）、EIA/CME（国内访问超时）、国家统计局（意义不大）
const SOURCES = [
  // ── Google News RSS：按主题聚合，每个话题独立搜索 ────────────────────
  {
    name: "Google新闻-期货监管",
    url: "https://news.google.com/rss/search?q=%E6%9C%9F%E8%B4%A7+%E8%AF%81%E7%9B%91%E4%BC%9A+%E4%BA%A4%E6%98%93%E6%89%80+%E7%9B%91%E7%AE%A1+%E5%85%AC%E5%91%8A&hl=zh-CN&gl=CN&ceid=CN:zh-Hans",
    type: "google-rss",
    category: "regulation",
    keywords: ["期货", "证监会", "交易所", "监管", "公告", "处罚", "保证金", "涨跌停", "手续费"]
  },
  {
    name: "Google新闻-期货公司",
    url: "https://news.google.com/rss/search?q=%E6%9C%9F%E8%B4%A7%E5%85%AC%E5%8F%B8+%E9%A3%8E%E9%99%A9%E7%AE%A1%E7%90%86+%E5%90%88%E8%A7%84+%E6%9C%9F%E8%B4%A7%E8%A1%8C%E4%B8%9A&hl=zh-CN&gl=CN&ceid=CN:zh-Hans",
    type: "google-rss",
    category: "peer",
    keywords: ["期货公司", "风险管理", "合规", "期货行业", "处罚", "高管", "从业", "协会"]
  },
  {
    name: "Google新闻-品种行情",
    url: "https://news.google.com/rss/search?q=%E6%9C%9F%E8%B4%A7+%E9%BB%84%E9%87%91+%E5%8E%9F%E6%B2%B9+%E9%93%9C+%E8%9E%BA%E7%BA%B9+%E8%B1%86%E7%B2%95+%E5%A4%A7%E6%B6%A8%E5%A4%A7%E8%B7%8C&hl=zh-CN&gl=CN&ceid=CN:zh-Hans",
    type: "google-rss",
    category: "variety",
    keywords: ["期货", "黄金", "原油", "铜", "螺纹", "豆粕", "大涨", "大跌", "涨停", "跌停", "行情"]
  },
  {
    name: "Google新闻-宏观金融",
    url: "https://news.google.com/rss/search?q=%E5%A4%AE%E8%A1%8C+%E7%BE%8E%E8%81%94%E5%82%A8+%E5%88%A9%E7%8E%87+%E6%B1%87%E7%8E%87+%E6%9C%9F%E8%B4%A7&hl=zh-CN&gl=CN&ceid=CN:zh-Hans",
    type: "google-rss",
    category: "finance",
    keywords: ["央行", "美联储", "利率", "汇率", "货币政策", "期货", "宏观", "经济"]
  },
  {
    name: "Google新闻-衍生品",
    url: "https://news.google.com/rss/search?q=%E8%A1%8D%E7%94%9F%E5%93%81+%E6%9C%9F%E8%B4%A7+%E5%9F%BA%E5%B7%AE+%E4%BB%93%E5%8D%95+%E6%8C%81%E4%BB%93+%E5%A4%9A%E7%A9%BA&hl=zh-CN&gl=CN&ceid=CN:zh-Hans",
    type: "google-rss",
    category: "variety",
    keywords: ["衍生品", "期货", "基差", "仓单", "持仓", "多空", "库存"]
  },
  // ── 权威官方 HTML（可正常抓取的来源）────────────────────────────────
  {
    name: "中国证监会-公告",
    url: "https://www.csrc.gov.cn/csrc/c100028/index.html",
    type: "html-list",
    keywords: ["期货", "衍生品", "处罚", "监管", "行政许可", "行政处罚", "征求意见"]
  },
  {
    name: "中国证监会-新闻",
    url: "https://www.csrc.gov.cn/csrc/c100022/index.html",
    type: "html-list",
    keywords: ["期货", "衍生品", "监管", "征求意见", "规则"]
  },
  {
    name: "中国期货业协会",
    url: "https://www.cfachina.org/",
    type: "html-list",
    keywords: ["期货公司", "自律", "通知", "公告", "处罚", "规范", "合规", "培训", "期货从业", "月度经营"]
  },
  {
    name: "中国人民银行",
    url: "https://www.pbc.gov.cn/goutongjiaoliu/113456/index.html",
    type: "html-list",
    keywords: ["货币政策", "利率", "汇率", "流动性", "公告", "通知"]
  },
];

const NAVIGATION_LABELS = new Set([
  "首页", "新闻动态", "通知公告", "交易所公告", "交易所动态", "市场公告",
  "监管动态", "辖区监管动态", "信息公开", "投资者教育", "业务公告",
  "更多", "查看更多", "中文", "English", "返回", "上一页", "下一页",
  "登录", "注册", "关于我们", "联系我们", "网站地图", "隐私政策",
]);

// ── 主流程 ────────────────────────────────────────────────────────────────
async function main() {
  const startedAt = Date.now();
  const results = await Promise.allSettled(SOURCES.map(fetchSource));
  const rawItems = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  const failedSources = results.filter((r) => r.status === "rejected").length;

  // 降级兜底：新数据不足时合并上次成功数据
  let finalItems = rawItems;
  if (rawItems.length < 10) {
    const previous = await loadPreviousItems();
    if (previous.length) {
      finalItems = [...rawItems, ...previous];
      console.log(`新数据 ${rawItems.length} 条，合并上次 ${previous.length} 条历史数据`);
    }
  }

  const dashboard = buildDashboard(finalItems);
  dashboard.health = {
    status: failedSources > SOURCES.length / 2 ? "部分延迟" : "正常",
    successRate: `${SOURCES.length - failedSources}/${SOURCES.length}`,
    failedSources,
    durationMs: Date.now() - startedAt,
    note: rawItems.length
      ? `已从 ${SOURCES.length - failedSources} 个来源抓取，共 ${dashboard.items.length} 条（含 Google 新闻聚合）。`
      : "未抓取到内容，已使用历史缓存数据。"
  };

  await writeFile("public/data/live.json", JSON.stringify(dashboard, null, 2), "utf8");
  console.log(JSON.stringify({
    items: dashboard.items.length,
    high: dashboard.metrics.high,
    peer: dashboard.metrics.peer,
    variety: dashboard.metrics.variety,
    finance: dashboard.metrics.finance,
    official: dashboard.metrics.official,
    status: dashboard.health.status,
    successRate: dashboard.health.successRate,
    durationMs: dashboard.health.durationMs
  }, null, 2));
}

async function loadPreviousItems() {
  try {
    const raw = await readFile("public/data/live.json", "utf8");
    return (JSON.parse(raw).items || []).slice(0, 60);
  } catch { return []; }
}

// ── 抓取单个来源 ──────────────────────────────────────────────────────────
async function fetchSource(source) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18000);
  try {
    const response = await fetch(source.url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/rss+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8"
      }
    });
    if (!response.ok) throw new Error(`${source.name} HTTP ${response.status}`);
    const text = await response.text();

    if (source.type === "google-rss") return parseGoogleNewsRss(text, source).slice(0, 15);
    if (source.type === "rss")        return parseRss(text, source).slice(0, 10);
    return parseHtmlList(text, source).slice(0, 10);
  } finally {
    clearTimeout(timeout);
  }
}

// ── Google News RSS 解析 ──────────────────────────────────────────────────
// Google News 标题格式：「真实标题 - 媒体名」
// 链接是 Google 跳转链接，用户点击后重定向到原文
function parseGoogleNewsRss(xml, source) {
  const blocks = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((m) => m[1]);
  const items = blocks.map((block) => {
    const rawTitle = decode(stripTags(matchFirst(block, /<title[^>]*>([\s\S]*?)<\/title>/i)));
    const pubDate  = decode(matchFirst(block, /<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i));
    const link     = decode(matchFirst(block, /<link[^>]*>([\s\S]*?)<\/link>/i)) ||
                     decode(matchFirst(block, /<guid[^>]*>([^<]+)<\/guid>/i));
    // 从描述里尝试提取原始链接
    const rawDesc  = matchFirst(block, /<description[^>]*>([\s\S]*?)<\/description>/i);
    const origUrl  = extractOriginalUrl(rawDesc) || link;

    // 拆分「标题 - 媒体名」
    const dashIdx = rawTitle.lastIndexOf(" - ");
    const title   = dashIdx > 0 ? rawTitle.slice(0, dashIdx).trim() : rawTitle.trim();
    const publisher = dashIdx > 0 ? rawTitle.slice(dashIdx + 3).trim() : "";

    // 用原始来源 URL 给评分引擎，用 Google 链接给用户点击
    const scoreUrl = origUrl || link;

    return {
      title,
      summary: decode(stripTags(rawDesc)).replace(/\s+/g, " ").slice(0, 160),
      url: origUrl || link,          // 优先原始链接，其次 Google 跳转链接
      publishedAt: normalizeDate(pubDate),
      sourceName: publisher || source.name,
      sourceUrl: scoreUrl,           // 供评分引擎使用
      // 强制分类提示（让引擎优先考虑该分类）
      _hintCategory: source.category
    };
  });

  return items.filter((item) => item.title.length >= 6 && isUsefulGoogle(item, source));
}

function extractOriginalUrl(htmlDesc) {
  if (!htmlDesc) return "";
  // Google 的描述里有原文链接，格式：href="原始URL"
  const decoded = htmlDesc.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
  const match = /href=["'](?!https?:\/\/news\.google\.com)([^"']+)["']/.exec(decoded);
  return match ? match[1] : "";
}

function isUsefulGoogle(item, source) {
  if (!item.title || item.title.length < 6 || item.title.length > 160) return false;
  const text = (item.title + " " + item.summary).toLowerCase();
  return source.keywords.some((kw) => text.includes(kw.toLowerCase()));
}

// ── 标准 RSS 解析 ─────────────────────────────────────────────────────────
function parseRss(xml, source) {
  const blocks = [...xml.matchAll(/<(?:item|entry)\b[\s\S]*?<\/(?:item|entry)>/gi)].map((m) => m[0]);
  return blocks
    .map((block) => ({
      title: decode(stripTags(matchFirst(block, /<title[^>]*>([\s\S]*?)<\/title>/i))),
      summary: decode(stripTags(matchFirst(block, /<(?:description|summary|content)[^>]*>([\s\S]*?)<\/(?:description|summary|content)>/i))).slice(0, 200),
      url: decode(matchFirst(block, /<link[^>]*>([^<]+)<\/link>/i) || matchFirst(block, /<link[^>]+href=["']([^"']+)["'][^>]*\/?>/i)),
      publishedAt: normalizeDate(decode(matchFirst(block, /<(?:pubDate|published|updated|dc:date)[^>]*>([\s\S]*?)<\/(?:pubDate|published|updated|dc:date)>/i))),
      sourceName: decode(matchFirst(block, /<(?:source|News:Source)[^>]*>([^<]+)<\/(?:source|News:Source)>/i)) || source.name
    }))
    .filter((item) => isUseful(item, source));
}

// ── HTML 列表解析（官方页面）─────────────────────────────────────────────
function parseHtmlList(html, source) {
  const metaDesc = decode(stripTags(
    matchFirst(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
    matchFirst(html, /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i)
  )).slice(0, 100);

  const seen = new Set();
  const items = [];

  for (const [fullMatch, attrs, innerHtml] of [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)]) {
    const hrefMatch = /href=["']([^"']+)["']/.exec(attrs);
    if (!hrefMatch) continue;
    const href = hrefMatch[1];
    if (/^(#|javascript:|mailto:|tel:)/.test(href)) continue;

    const title = cleanTitle(decode(stripTags(innerHtml)).replace(/\s+/g, " ").trim());
    if (!title || seen.has(title)) continue;
    seen.add(title);

    const pos = html.indexOf(fullMatch);
    const context = html.slice(Math.max(0, pos - 200), pos + fullMatch.length + 200);
    const dateMatch = /(\d{4}[-年]\d{1,2}[-月]\d{0,2}日?)/.exec(context);

    items.push({
      title,
      summary: metaDesc || `${source.name}发布的最新公告。`,
      url: absolutize(href, source.url),
      publishedAt: dateMatch ? normalizeDate(dateMatch[1]) : "",
      sourceName: source.name
    });
  }

  return items.filter((item) => isUseful(item, source));
}

// ── 过滤判断 ──────────────────────────────────────────────────────────────
function isUseful(item, source) {
  if (!item.title || item.title.length < 6 || item.title.length > 160) return false;
  if (NAVIGATION_LABELS.has(item.title)) return false;
  if (/^(首页|更多|查看更多|通知公告|新闻动态|监管动态|市场公告|业务公告|English|中文|登录|注册)$/.test(item.title)) return false;
  const text = `${item.title} ${item.summary || ""}`.toLowerCase();
  const hasKeyword = source.keywords.some((kw) => text.includes(kw.toLowerCase()));
  const hasNewsShape = /关于|发布|调整|修订|征求意见|处罚|通报|提示|风险|公告|通知|数据|报告|声明|上市|交割|保证金|涨跌停|手续费|异常交易|大涨|大跌|上涨|下跌|行情|\d{4}[-年./]\d{1,2}/.test(item.title);
  return hasKeyword && hasNewsShape;
}

// ── 工具函数 ──────────────────────────────────────────────────────────────
function cleanTitle(title) {
  const s = title.replace(/\s+/g, " ").trim();
  const noDate = s
    .replace(/^\d{1,2}\s+\d{4}-\d{1,2}(?:-\d{1,2})?\s*/, "")
    .replace(/^\d{4}-\d{1,2}(?:-\d{1,2})?\s*/, "")
    .replace(/^\d{4}年\d{1,2}月\d{1,2}日\s*/, "");
  for (let size = Math.floor(noDate.length / 2); size >= 8; size -= 1) {
    if (noDate.slice(0, size).trim() === noDate.slice(size).trim()) return noDate.slice(0, size).trim();
  }
  return noDate;
}

function normalizeDate(raw) {
  if (!raw) return "";
  const cn = /(\d{4})年(\d{1,2})月(\d{1,2})?日?/.exec(raw);
  if (cn) return `${cn[1]}-${cn[2].padStart(2, "0")}-${(cn[3] || "01").padStart(2, "0")}`;
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) return d.toISOString();
  if (/^\d{4}-\d{2}/.test(raw)) return raw;
  return "";
}

function matchFirst(text, regex) { return regex.exec(text)?.[1] || ""; }
function stripTags(value) { return (value || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim(); }
function decode(value) {
  return (value || "")
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).trim();
}
function absolutize(href, base) { try { return new URL(href, base).toString(); } catch { return base; } }

await main();
