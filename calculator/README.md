# Noon 费用计算原子 Tool Call — 开发文档

> 日期：2026-03-27
> 仓库：`unilume-app/calculator/`
> 关联 Issue：unilume-ai/unilume-docs#6
> 关联设计：`plan/04_profit_calculator_design.md`、`plan/05_mvp_profit_estimator.md`
> 状态：MVP 已实现

---

## 一、设计理念

### 第一性原理

Noon 的费用体系可以分解为**有限个原子操作**——每个 Excel 计算器都是若干原子操作的组合。我们不做业务层封装（如 `calc_profit()`），而是将每个原子操作暴露为独立的 Tool Call，由 Claude 根据用户问题自行组合。

```
旧架构（业务封装）：
  用户 → calc_profit() → 结果
  问题：不灵活，无法回答"仓储费多少？""退货损失？"等非利润问题

新架构（原子组合）：
  用户 → Claude 推理 → 调用 N 个原子 Tool → Claude 组合结果 → 回答
  优势：通用，能回答任何费用相关问题
```

### 核心原则

1. **每个 Tool = Noon 的一个官方操作**（不发明新操作）
2. **数据忠于原始来源**（Excel/文档中的每个数字都精确还原）
3. **Claude 负责组合**（利润 = 售价 - 佣金 - 物流 - VAT - 成本）
4. **Tool 之间无依赖**（每个 Tool 独立可调用）

---

## 二、16 个原子 Tool

### 分类与重量（`classify.py`）

| # | Tool | 来源 | 输入 | 输出 |
|---|------|------|------|------|
| 1 | `classify_item_size` | Excel Calculator rows 30-48 | 尺寸(cm) + 重量(kg) | 7 种分类之一 |
| 2 | `classify_directship_size` | Excel Calculator rows 25-34 | 尺寸(cm) + 重量(kg) | standard_parcel / oversize |
| 3 | `calc_billable_weight` | Excel D15-D17 | 重量 + 尺寸 + 分类 | 计费重量(kg) |
| 4 | `calc_cubic_feet` | Excel D18 | 尺寸(cm) | CBF 值 |

### 佣金（`referral_fee.py`）

| # | Tool | 输入 | 输出 |
|---|------|------|------|
| 5 | `lookup_referral_fee` | 售价 + 品类 + 市场 + FBN/FBP | 佣金金额 + 实际费率 |
| 6 | `list_categories` | 市场 + FBN/FBP | 所有品类及费率列表 |

### 物流费（`fulfillment_fee.py`）

| # | Tool | 来源 | 输入 | 输出 |
|---|------|------|------|------|
| 7 | `lookup_fbn_outbound_fee` | Excel Outbound sheet | 重量 + 分类 + 市场 + ASP | 出库费 |
| 8 | `lookup_directship_fee` | Excel directship sheet | 重量 + 分类 + 市场 + pickup/dropoff | DS 费 |

### 仓储费（`storage_fee.py`）

| # | Tool | 输入 | 输出 |
|---|------|------|------|
| 9 | `calc_storage_fee` | 尺寸 + 市场 + 月数 | 月度仓储费 |
| 10 | `calc_long_term_storage_fee` | 尺寸 + 市场 | 长期附加费（UAE/KSA >365天, Egypt >180天） |
| 11 | `calc_non_saleable_storage_fee` | 尺寸 + 市场 | 不可售品仓储费（>30天） |

### 其他费用（`other_fees.py`）

| # | Tool | 输入 | 输出 |
|---|------|------|------|
| 12 | `calc_return_admin_fee` | 佣金金额 + 市场 | 退货管理费 |
| 13 | `calc_inventory_removal_fee` | 数量 + 重量 + 市场 + 配送/自取 | 库存移除费 |
| 14 | `lookup_vas_fee` | 服务类型 + 分类 + 市场 | 增值包装费 |
| 15 | `lookup_shipping_reimbursement` | 订单金额 + 市场 | 运费补贴 |
| 16 | `calc_vat` | 费用金额 + 市场 | VAT（对服务费，非售价） |

---

## 三、核心计算逻辑（对标 Excel）

### 3.1 尺寸分类（7 种 FBN / 2 种 DirectShip）

FBN 有 7 种分类，按从小到大排列，取**第一个**全部维度和重量都满足的分类：

| 分类 | 最长边(cm) | 中间边(cm) | 最短边(cm) | 最大重量(g) | 包装重量(g) |
|------|-----------|-----------|-----------|------------|------------|
| Small Envelope | 20 | 15 | 1 | 100 | 20 |
| Standard Envelope | 33 | 23 | 2.5 | 500 | 40 |
| Large Envelope | 33 | 23 | 5 | 1000 | 40 |
| Standard Parcel | 45 | 34 | 26 | 12000 | 100 |
| Oversize | 130 | 34 | 26 | 30000 | 240 |
| Extra Oversize | 130 | 130 | 130 | 30000 | 240 |
| Bulky | 无限制 | 无限制 | 无限制 | 无限制 | 400 |

DirectShip 只有 2 种：Standard Parcel（同上）和 Oversize（兜底）。

### 3.2 计费重量

```
计费重量 = max(实重 + 包装重量, 体积重量)
体积重量 = L × W × H(cm) / 5000
向上取整到最近 50g
```

### 3.3 佣金三种模式

```python
# flat — 固定比例（~80% 品类）
fee = sale_price × rate

# tiered — 分段累进（手表、家具、珠宝）
# 6000 AED 手表: 5000×15% + 1000×5% = 800
fee = sum(每段金额 × 对应费率)

# price_switch — 整体切换（美妆、个护、运动）
# 60 AED 美妆: 60×15% = 9（不分段，整体用 15%）
fee = sale_price × 所在区间费率
```

最低佣金：UAE/KSA 1 AED/SAR，Egypt 1 EGP。

### 3.4 FBN 出库费查表

按 **分类 × 市场 × ASP 档位 × 计费重量** 查表：
- UAE/KSA：ASP ≤25 用低档费率，>25 用高档费率
- Egypt：无 ASP 分档，单一费率
- Bulky 超 40kg：每增 5kg 加收 10 当地货币

### 3.5 DirectShip 费查表

按 **分类 × 市场 × pickup/dropoff × 计费重量** 查表：
- Dropoff 统一比 pickup 便宜 2 当地货币
- Oversize 超 30kg：每增 1kg 加收（AED/SAR +1，EGP +2）
- 体积重量主导时有 fee cap：AED 84 / SAR 83 / EGP 135

### 3.6 VAT

**VAT 对服务费征收，不对售价征收！**

| 市场 | VAT 率 |
|------|--------|
| UAE | 5% |
| KSA | 15% |
| Egypt | 14% |

---

## 四、Claude 如何组合 Tool

### 场景 1："成本 ¥35，售价 69 AED，FBN UAE，0.3kg，利润多少？"

```
Claude 推理链：
1. classify_item_size(无尺寸, 0.3kg) → standard_parcel
2. calc_billable_weight(0.3, standard_parcel) → 0.4kg
3. lookup_referral_fee(69, "home.cleaning_hygiene", UAE) → 6.21 AED
4. lookup_fbn_outbound_fee(0.4, standard_parcel, UAE, asp=69) → 9.0 AED
5. calc_vat(6.21, 9.0, UAE) → 0.76 AED
6. 成本换算: 35 CNY × 0.50 = 17.5 AED
7. 净利润 = 69 - 6.21 - 9.0 - 0.76 - 17.5 = 35.53 AED
```

### 场景 2："退货损失多少？"

```
Claude 推理链：
1. lookup_referral_fee(69, ...) → 6.21 AED
2. calc_return_admin_fee(6.21, UAE) → 1.24 AED
3. 加上商品成本损失 + 物流费不退 → 给出总损失估算
```

### 场景 3："FBN 存 6 个月要多少仓储费？"

```
Claude 推理链：
1. calc_storage_fee(尺寸, UAE, 6个月) → 月度费×6
2. 如果超 365 天还需要: calc_long_term_storage_fee(尺寸, UAE)
```

### 场景 4："帮我比较 FBN 和 DirectShip 的费用"

```
Claude 推理链：
1. lookup_fbn_outbound_fee(...) → FBN 费
2. lookup_directship_fee(..., pickup) → DS pickup 费
3. lookup_directship_fee(..., dropoff) → DS dropoff 费
4. 对比三种方案给出建议
```

---

## 五、数据覆盖

### 品类数量

| 市场 | FBN 品类 | FBP 差异覆盖 | Refurbished |
|------|---------|-------------|-------------|
| UAE | 67 | 12 | 8 品类 |
| KSA | 72 | 12 | 8 品类 |
| Egypt | 53 | 15 | 无 |

### FBN vs FBP

大部分品类 FBN 和 FBP 费率相同。部分电子品类 FBP 比 FBN 高 0.5%（如 Laptops FBN 6% → FBP 6.5%）。代码通过 `fbp_overrides` 处理差异。

### Refurbished

UAE 和 KSA 有独立的 Refurbished 费率：
- 佣金更低（如手机 FBN 标准 6% → Refurbished Unopened 5% / Renewed 10%）
- FBN 出库费无 ASP 分档（单一费率）
- 不可售品仓储费更低（UAE 2 AED/CBF vs 标准 12 AED/CBF）

---

## 六、文件结构

```
unilume-app/
├── calculator/
│   ├── __init__.py              # 16 个 Tool 公开 API
│   ├── models.py                # 枚举、数据类、费率加载、汇率
│   ├── classify.py              # Tool 1-4: 分类 + 重量 + CBF
│   ├── referral_fee.py          # Tool 5-6: 佣金 + 品类浏览
│   ├── fulfillment_fee.py       # Tool 7-8: FBN 出库 + DirectShip
│   ├── storage_fee.py           # Tool 9-11: 仓储费
│   ├── other_fees.py            # Tool 12-16: 退货/移除/VAS/运费/VAT
│   └── tests/
│       ├── test_classify.py     # 18 个测试
│       ├── test_referral_fee.py # 18 个测试
│       ├── test_fulfillment_fee.py # 14 个测试
│       └── test_other_fees.py   # 17 个测试
├── data/
│   ├── fees_uae.json            # 975 行，UAE 完整费率
│   ├── fees_ksa.json            # 943 行，KSA 完整费率
│   └── fees_egypt.json          # 631 行，Egypt 完整费率
├── scripts/
│   └── extract_excel_fees.py    # Excel → JSON 提取工具
└── requirements.txt
```

---

## 七、费率数据同步

Noon 费率更新频率低（季度/年度），采用手动同步：

```
Noon 更新费率 → 爬虫重新爬取 → unilume-noon-docs/attachments/*.xlsx 更新
                                        ↓
                             python scripts/extract_excel_fees.py --inspect
                             （查看 Excel 结构，手动更新 JSON）
                                        ↓
                             data/fees_*.json 更新 → commit & push
```

后续可升级为 GitHub Action 自动监听 Excel 变更。

---

## 八、已知限制与后续扩展

| 项目 | 当前状态 | 后续计划 |
|------|----------|----------|
| Tool Call 注册 | 函数已实现，未接入 Claude | 待 Policy Agent (#4) 完成后统一接入 Vercel AI SDK |
| 汇率 | 内置兜底值 | 接入实时汇率 API |
| PST/品牌级别例外 | 未纳入 | Noon 有品牌级别费率例外表，需额外提取 |
| FBN 仓储费（利润计算） | 作为独立 Tool 可查 | Claude 组合时按需调用 |
| extract_excel_fees.py | 仅 inspect 模式 | 扩展自动提取逻辑 |

---

## 九、测试

```bash
cd unilume-app
pip install -r requirements.txt
python -m pytest calculator/tests/ -v
```

67 个测试覆盖：
- 7 种 FBN 尺寸分类 + 2 种 DS 分类
- 计费重量（包装 + 体积 + 取整）
- 三种佣金模式 × 三市场
- FBN/FBP 差异覆盖
- FBN 出库费（ASP 分档 + 7 种分类）
- DirectShip（pickup/dropoff + envelope 映射）
- 仓储费（月度/长期/不可售，Egypt 180天差异）
- 退货管理费、库存移除费（Egypt 高 min_fee）
- 增值服务（可用性检查）
- 运费补贴、VAT（三市场不同税率）
