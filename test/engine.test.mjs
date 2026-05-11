import test from "node:test";
import assert from "node:assert/strict";
import { buildDashboard, categorize, dedupeItems, enrichItem, processItems, scoreSource } from "../src/engine.mjs";

test("official exchange sources receive high authority score", () => {
  const result = scoreSource({
    sourceName: "上海期货交易所",
    url: "https://www.shfe.com.cn/news/notice/example.html"
  });

  assert.equal(result.tier, "权威官方");
  assert.equal(result.score, 98);
});

test("regulatory notices are categorized into regulation", () => {
  const result = categorize({
    title: "关于调整部分期货合约交易保证金和涨跌停板幅度的通知",
    summary: "交易所公告涉及保证金、涨跌停和风险控制。"
  });

  assert.equal(result.id, "regulation");
});

test("duplicate items keep the stronger source", () => {
  const items = [
    { title: "关于调整部分期货合约交易保证金的通知", sourceName: "某财经媒体", url: "https://example.com/a" },
    { title: "关于调整部分期货合约交易保证金的通知", sourceName: "上海期货交易所", url: "https://www.shfe.com.cn/a" }
  ];

  const [deduped] = dedupeItems(items);

  assert.equal(deduped.sourceName, "上海期货交易所");
});

test("high-impact official content is promoted to high importance", () => {
  const item = enrichItem({
    title: "关于调整部分期货合约交易保证金和涨跌停板幅度的通知",
    summary: "涉及保证金、涨跌停和客户风险提示。",
    sourceName: "大连商品交易所",
    url: "https://www.dce.com.cn/example"
  });

  assert.equal(item.rank.importance, "高");
  assert.ok(item.businessLines.includes("风控"));
});

test("dashboard builds leader and employee reading lists", () => {
  const dashboard = buildDashboard([
    {
      title: "关于调整部分期货合约交易保证金和涨跌停板幅度的通知",
      summary: "涉及保证金、涨跌停和客户风险提示。",
      sourceName: "郑州商品交易所",
      url: "https://www.czce.com.cn/example"
    },
    {
      title: "某期货公司上线数字化投研服务平台",
      summary: "同行数字化与客户服务经验值得参考。",
      sourceName: "期货日报",
      url: "https://www.futuresdaily.cn/example"
    }
  ]);

  assert.equal(dashboard.items.length, 2);
  assert.equal(dashboard.briefs.employee.length, 2);
  assert.ok(dashboard.metrics.high >= 1);
});

test("processed list is sorted by importance score", () => {
  const processed = processItems([
    { title: "普通行业资讯", sourceName: "公开来源", url: "https://example.com/1" },
    {
      title: "证监会发布期货市场监管相关通知",
      sourceName: "中国证监会",
      url: "https://www.csrc.gov.cn/example"
    }
  ]);

  assert.match(processed[0].title, /证监会/);
});
