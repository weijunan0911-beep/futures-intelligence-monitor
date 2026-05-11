import { writeFile } from "node:fs/promises";
import { buildDashboard } from "../src/engine.mjs";

const SOURCES = [
  { name: "中国证监会", url: "https://www.csrc.gov.cn/", keywords: ["期货", "衍生品", "监管", "处罚"] },
  { name: "中国金融期货交易所", url: "https://www.cffex.com.cn/", keywords: ["通知", "公告", "保证金", "交割", "异常交易"] },
  { name: "上海期货交易所", url: "https://www.shfe.com.cn/", keywords: ["通知", "公告", "保证金", "涨跌停", "交割"] },
  { name: "大连商品交易所", url: "https://www.dce.com.cn/", keywords: ["通知", "公告", "保证金", "涨跌停", "交割"] },
  { name: "郑州商品交易所", url: "https://www.czce.com.cn/", keywords: ["通知", "公告", "保证金", "涨跌停", "交割"] },
  { name: "广州期货交易所", url: "https://www.gfex.com.cn/", keywords: ["通知", "公告", "保证金", "涨跌停", "交割"] },
  { name: "中国人民银行", url: "https://www.pbc.gov.cn/", keywords: ["货币政策", "利率", "汇率", "流动性"] },
  { name: "国家统计局", url: "https://www.stats.gov.cn/", keywords: ["工业", "价格", "产量", "经济数据"] },
  { name: "EIA", url: "https://www.eia.gov/", keywords: ["oil", "natural gas", "inventory", "energy"] },
  { name: "CME Group", url: "https://www.cmegroup.com/", keywords: ["futures", "market", "notice", "clearing"] }
];

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

async function main() {
  const startedAt = Date.now();
  const results = await Promise.allSettled(SOURCES.map(fetchSource));
  const rawItems = results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
  const failedSources = results.filter((result) => result.status === "rejected").length;
  const dashboard = buildDashboard(rawItems);

  dashboard.health = {
    status: failedSources > SOURCES.length / 2 ? "部分延迟" : "正常",
    successRate: `${SOURCES.length - failedSources}/${SOURCES.length}`,
    failedSources,
    durationMs: Date.now() - startedAt,
    note: rawItems.length ? "已使用公开来源抓取并自动处理。" : "未抓取到可确认的公开来源条目；系统不会使用虚构数据兜底。"
  };

  await writeFile("public/data/live.json", JSON.stringify(dashboard, null, 2), "utf8");
  console.log(JSON.stringify({
    items: dashboard.items.length,
    high: dashboard.metrics.high,
    status: dashboard.health.status,
    successRate: dashboard.health.successRate
  }, null, 2));
}

async function fetchSource(source) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(source.url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 futures-intelligence-monitor/0.1",
        "Accept": "text/html,application/rss+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });
    if (!response.ok) throw new Error(`${source.name} returned ${response.status}`);
    const html = await response.text();
    return parseHtml(html, source).slice(0, 8);
  } finally {
    clearTimeout(timeout);
  }
}

function parseHtml(html, source) {
  const title = decode(stripTags(matchFirst(html, /<title[^>]*>([\s\S]*?)<\/title>/i)));
  const anchors = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  return anchors
    .map(([, href, label]) => {
      const text = cleanTitle(decode(stripTags(label)).replace(/\s+/g, " ").trim());
      return {
        title: text,
        summary: `${source.name}页面发现相关链接。页面标题：${title}`,
        url: absolutize(href, source.url),
        publishedAt: "",
        sourceName: source.name
      };
    })
    .filter((item) => isUseful(item, source));
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

function cleanTitle(title) {
  const compact = title.replace(/\s+/g, " ").trim();
  const withoutLeadingDate = compact
    .replace(/^\d{1,2}\s+\d{4}-\d{1,2}(?:-\d{1,2})?\s*/, "")
    .replace(/^\d{4}-\d{1,2}(?:-\d{1,2})?\s*/, "")
    .replace(/^\d{4}年\d{1,2}月\d{1,2}日\s*/, "");
  for (let size = Math.floor(withoutLeadingDate.length / 2); size >= 8; size -= 1) {
    const first = withoutLeadingDate.slice(0, size).trim();
    const second = withoutLeadingDate.slice(size).trim();
    if (first && first === second) return first;
  }
  return withoutLeadingDate;
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

await main();
