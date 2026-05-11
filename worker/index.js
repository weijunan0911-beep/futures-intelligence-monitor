import { buildDashboard } from "../src/engine.mjs";

// ── 数据源配置 ─────────────────────────────────────────────────────────────
const SOURCE_FEEDS = [
  // 监管机构
  { name: "中国证监会-公告",    url: "https://www.csrc.gov.cn/csrc/c100028/index.html",         type: "html-list", keywords: ["期货", "衍生品", "处罚", "监管", "公告", "通知", "规则"] },
  { name: "中国证监会-新闻",    url: "https://www.csrc.gov.cn/csrc/c100022/index.html",         type: "html-list", keywords: ["期货", "衍生品", "监管", "征求意见", "规则"] },
  // 五大交易所
  { name: "中国金融期货交易所", url: "https://www.cffex.com.cn/zcfg/",                          type: "html-list", keywords: ["通知", "公告", "保证金", "交割", "异常交易", "手续费", "涨跌停"] },
  { name: "上海期货交易所",     url: "https://www.shfe.com.cn/news/notice/",                    type: "html-list", keywords: ["通知", "公告", "保证金", "涨跌停", "交割", "手续费"] },
  { name: "大连商品交易所",     url: "https://www.dce.com.cn/DCE/yw/index.html",                type: "html-list", keywords: ["通知", "公告", "保证金", "涨跌停", "交割"] },
  { name: "郑州商品交易所",     url: "https://www.czce.com.cn/cn/ywtz/",                        type: "html-list", keywords: ["通知", "公告", "保证金", "涨跌停", "交割"] },
  { name: "广州期货交易所",     url: "https://www.gfex.com.cn/gfex/tzgg/",                      type: "html-list", keywords: ["通知", "公告", "保证金", "涨跌停", "交割"] },
  // 货币政策与经济数据
  { name: "中国人民银行",       url: "https://www.pbc.gov.cn/goutongjiaoliu/113456/index.html", type: "html-list", keywords: ["货币政策", "利率", "汇率", "流动性", "公告", "通知"] },
  { name: "国家统计局",         url: "https://www.stats.gov.cn/sj/zxfb/",                       type: "html-list", keywords: ["工业", "价格", "产量", "经济数据", "CPI", "PPI", "PMI"] },
  // 行业协会
  { name: "中国期货业协会",     url: "https://www.cfachina.org/",                               type: "html-list", keywords: ["期货公司", "自律", "通知", "公告", "处罚", "规范", "合规", "培训", "从业"] },
  // 行业媒体
  { name: "期货日报",           url: "https://www.futuresdaily.cn/",                            type: "html-list", keywords: ["期货", "监管", "交易所", "风险", "品种", "公司", "处罚", "通知", "动态"] },
  // 海外机构
  { name: "EIA",                url: "https://www.eia.gov/",                                    type: "html-list", keywords: ["oil", "natural gas", "inventory", "energy", "crude", "petroleum"] },
  { name: "CME Group",          url: "https://www.cmegroup.com/media-room/press-releases.html", type: "html-list", keywords: ["futures", "market", "notice", "clearing", "settlement"] },
];

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
};

const NAVIGATION_LABELS = new Set([
  "首页", "新闻动态", "通知公告", "交易所公告", "交易所动态", "市场公告",
  "监管动态", "辖区监管动态", "信息公开", "投资者教育", "业务公告",
  "更多", "查看更多", "中文", "English", "返回", "上一页", "下一页",
  "登录", "注册", "关于我们", "联系我们", "网站地图", "隐私政策",
]);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/today") return withJson(await getDashboard(request, env, ctx));
    if (url.pathname === "/api/sources") return withJson({ generatedAt: new Date().toISOString(), sources: SOURCE_FEEDS });
    if (url.pathname === "/api/health") return withJson({ status: "ok", generatedAt: new Date().toISOString(), sourceCount: SOURCE_FEEDS.length });
    return addHeaders(await env.ASSETS.fetch(request));
  }
};

async function getDashboard(request, env, ctx) {
  const cache = caches.default;
  const cacheKey = new Request(new URL("/api/today-cache", request.url), request);
  const cached = await cache.match(cacheKey);
  if (cached) return cached.json();

  const dashboard = await buildLiveDashboard();
  const response = new Response(JSON.stringify(dashboard), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=900" }
  });
  ctx?.waitUntil?.(cache.put(cacheKey, response.clone()));
  return dashboard;
}

async function buildLiveDashboard() {
  const startedAt = Date.now();
  const results = await Promise.allSettled(SOURCE_FEEDS.map(fetchSource));
  const rawItems = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  const failedSources = results.filter((r) => r.status === "rejected").length;
  const dashboard = buildDashboard(rawItems);
  dashboard.health = {
    status: failedSources > SOURCE_FEEDS.length / 2 ? "部分延迟" : "正常",
    successRate: `${SOURCE_FEEDS.length - failedSources}/${SOURCE_FEEDS.length}`,
    failedSources,
    durationMs: Date.now() - startedAt,
    note: rawItems.length ? "已使用公开来源实时抓取并自动处理。" : "未抓取到可确认的公开来源条目；系统不会使用虚构数据兜底。"
  };
  return dashboard;
}

async function fetchSource(source) {
  const response = await fetch(source.url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; futures-intelligence-monitor/0.2)",
      "Accept": "text/html,application/rss+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8"
    },
    cf: { cacheTtl: 900, cacheEverything: true }
  });
  if (!response.ok) throw new Error(`${source.name} HTTP ${response.status}`);
  const text = await response.text();
  if (source.type === "rss") return parseRss(text, source).slice(0, 10);
  return parseHtmlList(text, source).slice(0, 10);
}

function parseRss(xml, source) {
  const blocks = [...xml.matchAll(/<(?:item|entry)\b[\s\S]*?<\/(?:item|entry)>/gi)].map((m) => m[0]);
  return blocks
    .map((block) => ({
      title: decode(stripTags(matchFirst(block, /<title[^>]*>([\s\S]*?)<\/title>/i))),
      summary: decode(stripTags(matchFirst(block, /<(?:description|summary|content)[^>]*>([\s\S]*?)<\/(?:description|summary|content)>/i))).slice(0, 200),
      url: decode(matchFirst(block, /<(?:link|guid)[^>]*>([^<]+)<\/(?:link|guid)>/i) || matchFirst(block, /<link[^>]+href=["']([^"']+)["'][^>]*\/?>/i)),
      publishedAt: normalizeDate(decode(matchFirst(block, /<(?:pubDate|published|updated|dc:date)[^>]*>([\s\S]*?)<\/(?:pubDate|published|updated|dc:date)>/i))),
      sourceName: source.name
    }))
    .filter((item) => isUseful(item, source));
}

function parseHtmlList(html, source) {
  const metaDesc = decode(stripTags(
    matchFirst(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
    matchFirst(html, /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i)
  )).slice(0, 100);

  const anchors = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)];
  const seen = new Set();
  const items = [];

  for (const [fullMatch, attrs, innerHtml] of anchors) {
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
    const publishedAt = dateMatch ? normalizeDate(dateMatch[1]) : "";

    items.push({
      title,
      summary: metaDesc || `${source.name}发布的最新公告。`,
      url: absolutize(href, source.url),
      publishedAt,
      sourceName: source.name
    });
  }

  return items.filter((item) => isUseful(item, source));
}

function isUseful(item, source) {
  if (!item.title || item.title.length < 6 || item.title.length > 140) return false;
  if (NAVIGATION_LABELS.has(item.title)) return false;
  if (/^(首页|更多|查看更多|通知公告|新闻动态|监管动态|市场公告|业务公告|English|中文|登录|注册)$/.test(item.title)) return false;
  const text = `${item.title} ${item.summary || ""}`.toLowerCase();
  const hasKeyword = source.keywords.some((kw) => text.includes(kw.toLowerCase()));
  const hasNewsShape = /关于|发布|调整|修订|征求意见|处罚|通报|提示|风险|公告|通知|数据|报告|声明|上市|交割|保证金|涨跌停|手续费|异常交易|forecast|release|report|update|notice|\d{4}[-年./]\d{1,2}/.test(item.title);
  return hasKeyword && hasNewsShape;
}

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
function withJson(data) {
  return addHeaders(new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=300" }
  }));
}
function addHeaders(response) {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers.set(k, v);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
