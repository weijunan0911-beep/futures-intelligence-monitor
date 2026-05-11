import { buildDashboard } from "../src/engine.mjs";

const SOURCE_FEEDS = [
  {
    name: "中国证监会",
    url: "https://www.csrc.gov.cn/",
    type: "html",
    keywords: ["期货", "衍生品", "监管", "处罚"]
  },
  {
    name: "中国金融期货交易所",
    url: "https://www.cffex.com.cn/",
    type: "html",
    keywords: ["通知", "公告", "保证金", "交割", "异常交易"]
  },
  {
    name: "上海期货交易所",
    url: "https://www.shfe.com.cn/",
    type: "html",
    keywords: ["通知", "公告", "保证金", "涨跌停", "交割"]
  },
  {
    name: "大连商品交易所",
    url: "https://www.dce.com.cn/",
    type: "html",
    keywords: ["通知", "公告", "保证金", "涨跌停", "交割"]
  },
  {
    name: "郑州商品交易所",
    url: "https://www.czce.com.cn/",
    type: "html",
    keywords: ["通知", "公告", "保证金", "涨跌停", "交割"]
  },
  {
    name: "广州期货交易所",
    url: "https://www.gfex.com.cn/",
    type: "html",
    keywords: ["通知", "公告", "保证金", "涨跌停", "交割"]
  },
  {
    name: "中国人民银行",
    url: "https://www.pbc.gov.cn/",
    type: "html",
    keywords: ["货币政策", "利率", "汇率", "流动性"]
  },
  {
    name: "国家统计局",
    url: "https://www.stats.gov.cn/",
    type: "html",
    keywords: ["工业", "价格", "产量", "经济数据"]
  },
  {
    name: "EIA",
    url: "https://www.eia.gov/",
    type: "html",
    keywords: ["oil", "natural gas", "inventory", "energy"]
  },
  {
    name: "CME Group",
    url: "https://www.cmegroup.com/",
    type: "html",
    keywords: ["futures", "market", "notice", "clearing"]
  }
];

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
};

const NAVIGATION_LABELS = new Set([
  "首页",
  "新闻动态",
  "通知公告",
  "交易所公告",
  "交易所动态",
  "市场公告",
  "监管动态",
  "辖区监管动态",
  "信息公开",
  "投资者教育",
  "业务公告",
  "更多",
  "查看更多",
  "中文",
  "English"
]);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/today") {
      return withJson(await getDashboard(request, env, ctx));
    }
    if (url.pathname === "/api/sources") {
      return withJson({ generatedAt: new Date().toISOString(), sources: SOURCE_FEEDS });
    }
    if (url.pathname === "/api/health") {
      return withJson({ status: "ok", generatedAt: new Date().toISOString(), sourceCount: SOURCE_FEEDS.length });
    }
    const assetResponse = await env.ASSETS.fetch(request);
    return addHeaders(assetResponse);
  }
};

async function getDashboard(request, env, ctx) {
  const cache = caches.default;
  const cacheKey = new Request(new URL("/api/today-cache", request.url), request);
  const cached = await cache.match(cacheKey);
  if (cached) return cached.json();

  const dashboard = await buildLiveDashboard(env);
  const response = new Response(JSON.stringify(dashboard), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=900"
    }
  });
  ctx?.waitUntil?.(cache.put(cacheKey, response.clone()));
  return dashboard;
}

async function buildLiveDashboard(env) {
  const startedAt = Date.now();
  const results = await Promise.allSettled(SOURCE_FEEDS.map(fetchSource));
  const rawItems = results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
  const failedSources = results.filter((result) => result.status === "rejected").length;
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
      "User-Agent": "Mozilla/5.0 futures-intelligence-monitor/0.1",
      "Accept": "text/html,application/rss+xml,application/xml;q=0.9,*/*;q=0.8"
    },
    cf: { cacheTtl: 900, cacheEverything: true }
  });
  if (!response.ok) throw new Error(`${source.name} returned ${response.status}`);
  const text = await response.text();
  const items = source.type === "rss" ? parseRss(text, source) : parseHtml(text, source);
  return items.slice(0, 8);
}

function parseRss(xml, source) {
  const itemBlocks = [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((match) => match[0]);
  return itemBlocks.map((block) => ({
    title: decode(stripTags(matchFirst(block, /<title[^>]*>([\s\S]*?)<\/title>/i))),
    summary: decode(stripTags(matchFirst(block, /<description[^>]*>([\s\S]*?)<\/description>/i))),
    url: decode(matchFirst(block, /<link[^>]*>([\s\S]*?)<\/link>/i)) || source.url,
    publishedAt: decode(matchFirst(block, /<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)),
    sourceName: source.name
  })).filter((item) => isUseful(item, source));
}

function parseHtml(html, source) {
  const title = decode(stripTags(matchFirst(html, /<title[^>]*>([\s\S]*?)<\/title>/i)));
  const anchors = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  const items = anchors.map(([, href, label]) => {
    const text = decode(stripTags(label)).replace(/\s+/g, " ").trim();
    const url = absolutize(href, source.url);
    return {
      title: text,
      summary: `${source.name}页面发现相关链接。页面标题：${title}`,
      url,
      publishedAt: "",
      sourceName: source.name
    };
  });
  return items.filter((item) => isUseful(item, source));
}

function isUseful(item, source) {
  if (!item.title || item.title.length < 6 || item.title.length > 120) return false;
  if (NAVIGATION_LABELS.has(item.title)) return false;
  if (/^(首页|更多|查看更多|通知公告|新闻动态|监管动态|市场公告|业务公告)$/.test(item.title)) return false;
  const text = `${item.title} ${item.summary || ""}`.toLowerCase();
  const hasSourceKeyword = source.keywords.some((keyword) => text.includes(keyword.toLowerCase()));
  const hasNewsShape = /关于|发布|调整|修订|征求意见|处罚|通报|提示|风险|公告|通知|数据|报告|声明|上市|交割|保证金|涨跌停|手续费|异常交易|\d{4}[-年./]\d{1,2}/.test(item.title);
  return hasSourceKeyword && hasNewsShape;
}

function matchFirst(text, regex) {
  return regex.exec(text)?.[1] || "";
}

function stripTags(value) {
  return value.replace(/<[^>]*>/g, "");
}

function decode(value) {
  return value
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .trim();
}

function absolutize(href, base) {
  try {
    return new URL(href, base).toString();
  } catch {
    return base;
  }
}

function withJson(data) {
  return addHeaders(new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=300"
    }
  }));
}

function addHeaders(response) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) headers.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
