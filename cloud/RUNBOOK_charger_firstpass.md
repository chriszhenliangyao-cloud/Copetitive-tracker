# Charger first-pass → 云端 运行手册

抓取**只能在你的 Mac 本地跑**（headed Playwright + Fnac 的 CloakBrowser/DataDome，
云端 sandbox 没有显示器、也连不到零售商站点）。云端只负责存 + 展示。

数据流：`run_all.py`（本地抓取）→ 本地 CSV+图片 → `push_to_supabase.py`（推云）→ Supabase → Vercel 看板。
**抓取代码无需为云端改动**——它产出的 `channel_chargers_<brand>_<date>.csv` 字段与 push 脚本 1:1 对齐（已校验）。

---

## 数据保存形式（已定）

- 抓取脚本：照旧**存本地** CSV（+ 带图 xlsx）。不直接写云端。
- 原因：first-pass 是重字段抓取，本地文件是可复核、可重跑的产物；push 脚本已封装
  「防覆盖三原则 + 幂等 + 图片上传 Storage」。让抓取器直连云端会重复这套逻辑，
  且抓取中途失败会写入半截脏数据。
- 推云：跑完用 `push_to_supabase.py` 一次性上传（products/listings/snapshots + 图片）。

---

## 一次完整 first-pass（全渠道全品牌，仅 charger）

```bash
cd ~/Desktop/competitive追踪/插头/channel

# 1) 可选：先列出可用渠道/品牌确认环境 OK
python3 run_all.py --list

# 2) 全渠道全品牌跑（会弹出有头浏览器；Fnac 自动走 CloakBrowser）
python3 run_all.py
#   产物：插头/output/<brand>_output/channel_chargers_<brand>_<今天>.csv (+ .xlsx)

# 单独补某几个品牌/渠道（出错重跑用）：
# python3 run_all.py --brand anker,belkin boulanger fnac
```

抓取小贴士：
- 第一次先小范围验证，例如 `python3 run_all.py --brand anker boulanger`，确认能出数据再全量。
- Fnac 若被 DataDome 拦，参考 `competitive追踪/docs/RUNBOOK_fnac.md`。

---

## 推送到云端

```bash
cd ~/Desktop/competitive追踪/插头/cloud/pipeline

# service_role 密钥：Supabase 后台 → Settings → API → service_role（secret）
# 绝不要写进代码/git，只临时 export 到当前终端
export SUPABASE_SERVICE_KEY='你的_service_role_密钥'

# 先 dry-run 看数量（不写库）
python3 push_to_supabase.py --category charger --dry-run

# 正式推（自动选最新日期；上传图片到 Storage）
python3 push_to_supabase.py --category charger
```

push 的保证（堵 powerbank 的老坑）：
1. products 只增不改——审核补全的规格/图片不会被下次抓取冲掉
2. listings 只增 + 刷 last_seen——status/product_id/reviewed_* 只有人能改
3. snapshots 按 (listing, 日期) 幂等 upsert——同日重跑安全

> 注：我已先用数据库直连把 5-14 那批里 **112 条带 SKU 的 mapped 行**导入云端做引导
> （无图）。等你这次正式 `push` 跑通，它会**补上 473 条 new_listing + 回填所有图片**，
> 不会重复、不会覆盖。

---

## 推完之后

1. 打开 https://copetitive-tracker.vercel.app 登录 → 看板出现真实数据。
2. 新 listing（无 SKU 的）去 **Review** 页人工填 SKU / Skip。
3. 新品牌数据齐了，激活上看板：
   ```sql
   update category_brands set is_active=true
    where brand_id=(select id from brands where key='xxx')
      and category_id=(select id from categories where key='charger');
   ```
   （带 mapped 数据的品牌我已自动激活；纯 new_listing 的品牌审核后再激活。）
