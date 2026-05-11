const SOURCE_RULES = [
  { pattern: /(?:^|\.)csrc\.gov\.cn$/i, label: "监管机构", tier: "权威官方", score: 100 },
  { pattern: /(?:^|\.)cffex\.com\.cn$/i, label: "期货交易所", tier: "权威官方", score: 98 },
  { pattern: /(?:^|\.)shfe\.com\.cn$/i, label: "期货交易所", tier: "权威官方", score: 98 },
  { pattern: /(?:^|\.)dce\.com\.cn$/i, label: "期货交易所", tier: "权威官方", score: 98 },
  { pattern: /(?:^|\.)czce\.com\.cn$/i, label: "期货交易所", tier: "权威官方", score: 98 },
  { pattern: /(?:^|\.)gfex\.com\.cn$/i, label: "期货交易所", tier: "权威官方", score: 98 },
  { pattern: /(?:^|\.)cfachina\.org$/i, label: "行业协会", tier: "权威官方", score: 94 },
  { pattern: /(?:^|\.)gov\.cn$/i, label: "政府部门", tier: "权威官方", score: 92 },
  { pattern: /(?:^|\.)stats\.gov\.cn$/i, label: "政府部门", tier: "权威官方", score: 92 },
  { pattern: /(?:^|\.)pbc\.gov\.cn$/i, label: "央行", tier: "权威官方", score: 92 },
  { pattern: /(?:^|\.)xinhua(?:net)?\.com$/i, label: "主流媒体", tier: "主流媒体", score: 82 },
  { pattern: /(?:^|\.)cnstock\.com$/i, label: "主流媒体", tier: "主流媒体", score: 80 },
  { pattern: /(?:^|\.)stcn\.com$/i, label: "主流媒体", tier: "主流媒体", score: 80 },
  { pattern: /(?:^|\.)futuresdaily\.cn$/i, label: "行业媒体", tier: "行业参考", score: 78 },
  { pattern: /(?:^|\.)cmegroup\.com$/i, label: "海外交易所", tier: "权威官方", score: 88 },
  { pattern: /(?:^|\.)lme\.com$/i, label: "海外交易所", tier: "权威官方", score: 88 },
  { pattern: /(?:^|\.)ice\.com$/i, label: "海外交易所", tier: "权威官方", score: 88 },
  { pattern: /(?:^|\.)federalreserve\.gov$/i, label: "海外央行", tier: "权威官方", score: 90 },
  { pattern: /(?:^|\.)eia\.gov$/i, label: "海外官方数据", tier: "权威官方", score: 88 },
  { pattern: /(?:^|\.)usda\.gov$/i, label: "海外官方数据", tier: "权威官方", score: 88 }
];

const CATEGORY_RULES = [
  {
    id: "regulation",
    label: "监管与交易所",
    // 只保留真正区分性的监管词汇，去掉"公告"/"通知"等普遍词
    keywords: ["证监会", "交易所", "保证金", "涨跌停", "手续费", "交割", "异常交易", "自律监管", "行政许可", "行政处罚", "征求意见", "上市申请"]
  },
  {
    id: "peer",
    label: "同行动态",
    // 扩充期货业协会、期货公司相关词汇
    keywords: ["期货公司", "风险管理子公司", "组织架构", "高管", "数字化", "投研服务", "合规", "处罚", "客户服务", "先进经验",
               "期货从业", "会员单位", "月度经营", "行业统计", "交易情况简报", "从业人员资格", "协会通知", "协会倡议", "联合研究", "服务实体"]
  },
  {
    id: "finance",
    label: "金融要闻",
    keywords: ["央行", "利率", "汇率", "美联储", "美元", "债券", "股票", "金融监管", "地缘", "经济数据", "通胀", "货币政策", "流动性", "LPR"]
  },
  {
    id: "variety",
    label: "品种异动",
    keywords: ["涨停", "跌停", "大涨", "大跌", "持仓", "成交量", "库存", "仓单", "基差", "原油", "黄金", "白银", "铜", "铝", "螺纹", "焦煤", "豆粕", "碳酸锂", "天然气", "inventory", "crude", "natural gas"]
  },
  {
    id: "industry",
    label: "产业资讯",
    keywords: ["供需", "产量", "进口", "出口", "港口", "矿山", "天气", "种植", "装置", "开工率", "PMI", "工业价格", "CPI", "PPI"]
  }
];

const BUSINESS_RULES = [
  { label: "风控", keywords: ["保证金", "涨跌停", "异常交易", "风险", "大涨", "大跌", "持仓", "波动"] },
  { label: "合规", keywords: ["监管", "处罚", "自律", "合规", "适当性", "反洗钱"] },
  { label: "投研", keywords: ["供需", "库存", "经济数据", "产业", "宏观", "外盘", "基差"] },
  { label: "经纪业务", keywords: ["客户", "手续费", "交易", "开户", "服务", "营销"] },
  { label: "结算", keywords: ["保证金", "交割", "结算", "涨跌停", "仓单"] },
  { label: "客户服务", keywords: ["客户", "风险提示", "通知", "投资者", "教育"] }
];

const VARIETY_RULES = [
  { label: "黑色", keywords: ["螺纹", "热卷", "铁矿", "焦煤", "焦炭", "钢材"] },
  { label: "有色", keywords: ["铜", "铝", "锌", "铅", "镍", "锡", "氧化铝"] },
  { label: "能化", keywords: ["原油", "燃料油", "沥青", "甲醇", "PTA", "PVC", "橡胶"] },
  { label: "农产品", keywords: ["豆粕", "豆油", "棕榈油", "玉米", "棉花", "白糖", "生猪"] },
  { label: "贵金属", keywords: ["黄金", "白银"] },
  { label: "新能源", keywords: ["碳酸锂", "工业硅", "多晶硅"] },
  { label: "金融期货", keywords: ["股指", "国债", "中证", "沪深", "上证"] }
];

function safeUrlHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function textOf(item) {
  return [item.title, item.summary, item.sourceName, item.rawText].filter(Boolean).join(" ");
}

function matchKeywords(text, rules) {
  return rules
    .map((rule) => ({ ...rule, hits: rule.keywords.filter((word) => text.includes(word)) }))
    .filter((rule) => rule.hits.length > 0)
    .sort((a, b) => b.hits.length - a.hits.length);
}

export function scoreSource(item) {
  const host = safeUrlHost(item.url || item.sourceUrl || "");
  const sourceText = `${item.sourceName || ""} ${host}`;
  const exact = SOURCE_RULES.find((rule) => rule.pattern.test(host));
  if (exact) return { ...exact, host };

  if (/交易所|证监会|协会|监管|政府|央行/.test(sourceText)) {
    return { label: "疑似官方", tier: "较高可信", score: 76, host };
  }
  if (/证券报|期货日报|财联社|新华社|时报|财经/.test(sourceText)) {
    return { label: "财经媒体", tier: "主流媒体", score: 70, host };
  }
  return { label: "公开来源", tier: "待验证来源", score: 52, host };
}

export function categorize(item) {
  const text = textOf(item);
  const matches = matchKeywords(text, CATEGORY_RULES);
  return matches[0] ? { id: matches[0].id, label: matches[0].label, hits: matches[0].hits } : { id: "general", label: "综合资讯", hits: [] };
}

export function inferBusinessLines(item) {
  const text = textOf(item);
  const matches = matchKeywords(text, BUSINESS_RULES);
  return matches.length ? matches.slice(0, 3).map((rule) => rule.label) : ["管理参考"];
}

export function inferVarieties(item) {
  const text = textOf(item);
  const matches = matchKeywords(text, VARIETY_RULES);
  return matches.length ? matches.slice(0, 3).map((rule) => rule.label) : [];
}

export function rankItem(item) {
  const source = scoreSource(item);
  const category = categorize(item);
  const text = textOf(item);
  let score = source.score;

  if (/保证金|涨跌停|交割|处罚|监管|异常交易|重大|风险|突发|高管|组织架构/.test(text)) score += 16;
  if (/大涨|大跌|涨停|跌停|美联储|央行|地缘|库存|仓单|持仓/.test(text)) score += 10;
  if (category.id === "peer" && /先进|数字化|AI|投研|客户服务|风控/.test(text)) score += 8;
  if (!item.publishedAt) score -= 12;
  if (!item.url && !item.sourceUrl) score -= 18;

  const importance = score >= 104 ? "高" : score >= 86 ? "中" : "一般";
  const action = importance === "高" ? "建议纳入今日重点" : importance === "中" ? "建议关注" : "一般参考";
  return { score: Math.max(0, Math.min(120, score)), importance, action };
}

function normalizedKey(item) {
  return (item.title || "")
    .replace(/[【】\[\]（）()《》]/g, "")
    .replace(/\s+/g, "")
    .slice(0, 42);
}

export function dedupeItems(items) {
  const map = new Map();
  for (const item of items) {
    const key = normalizedKey(item);
    const previous = map.get(key);
    if (!previous || rankItem(item).score > rankItem(previous).score) {
      map.set(key, item);
    }
  }
  return [...map.values()];
}

export function enrichItem(raw) {
  const item = {
    id: raw.id || `${normalizedKey(raw)}-${raw.publishedAt || Date.now()}`,
    title: raw.title || "未命名资讯",
    summary: raw.summary || raw.description || "",
    sourceName: raw.sourceName || raw.source || "公开来源",
    url: raw.url || raw.sourceUrl || "",
    publishedAt: raw.publishedAt || raw.date || "",
    rawText: raw.rawText || ""
  };
  const source = scoreSource(item);
  const category = categorize(item);
  const rank = rankItem(item);
  const businessLines = inferBusinessLines(item);
  const varieties = inferVarieties(item);
  const why = buildWhyImportant(item, category, source, rank, businessLines, varieties);

  return {
    ...item,
    category,
    source,
    rank,
    businessLines,
    varieties,
    why,
    confidence: source.score >= 90 ? "高" : source.score >= 70 ? "中" : "观察"
  };
}

export function buildWhyImportant(item, category, source, rank, businessLines, varieties) {
  if (rank.importance === "高") {
    return `来源为${source.tier}，内容涉及${category.label}，可能影响${businessLines.join("、")}等工作。`;
  }
  if (varieties.length) {
    return `涉及${varieties.join("、")}相关品种，适合纳入市场跟踪和业务提示。`;
  }
  if (category.id === "peer") {
    return "可作为同行管理经验、业务创新或风险案例的参考素材。";
  }
  return `属于${category.label}类信息，建议作为日常资讯参考。`;
}

export function processItems(rawItems) {
  const enriched = dedupeItems(rawItems).map(enrichItem);
  return enriched.sort((a, b) => b.rank.score - a.rank.score);
}

export function buildDashboard(items) {
  const processed = processItems(items);
  const countBy = (predicate) => processed.filter(predicate).length;
  return {
    generatedAt: new Date().toISOString(),
    items: processed,
    metrics: {
      high: countBy((item) => item.rank.importance === "高"),
      peer: countBy((item) => item.category.id === "peer"),
      finance: countBy((item) => item.category.id === "finance"),
      variety: countBy((item) => item.category.id === "variety"),
      official: countBy((item) => item.source.tier === "权威官方")
    },
    briefs: {
      leader: processed.filter((item) => item.rank.importance !== "一般").slice(0, 8),
      employee: processed.slice(0, 18),
      mustRead: processed.filter((item) => item.rank.importance === "高").slice(0, 10)
    }
  };
}
