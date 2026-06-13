# Hanzi Writer 项目全面分析文档

> 版本：3.0.0 | 语言：TypeScript | 许可证：MIT  
> 仓库：https://github.com/chanind/hanzi-writer

---

## 一、项目简介

**Hanzi Writer** 是一个免费开源的 JavaScript/TypeScript 库，专门用于：

1. **动画演示**中文汉字的书写笔顺（逐笔动画）
2. **交互式练习**，让用户在页面上手写汉字并自动判分

支持简体字和繁体字。可运行在任何现代浏览器中，也可嵌入微信小程序等平台。  
字符数据来源于开源项目 [Make Me A Hanzi](https://github.com/skishore/makemeahanzi)，包含每个汉字的笔画路径（SVG path）和笔顺中轴线（medians）。

---

## 二、技术架构

### 技术栈

| 层次 | 技术 | 说明 |
|------|------|------|
| 语言 | TypeScript 4.x | 完整类型定义 |
| 构建 | Rollup 2.x | 输出 CJS + ESM + UMD |
| 测试 | Jest 26 | 单元测试 + 快照测试 |
| 代码质量 | ESLint + Prettier | 统一风格 |
| CI | CircleCI | 持续集成 |
| 发布 | semantic-release | 语义化版本 |

### 产物格式

```
dist/
  index.cjs.js   ← CommonJS（Node.js / Webpack）
  index.esm.js   ← ES Module（现代打包器）
  hanzi-writer.js ← UMD（直接 <script> 引入）
```

### 核心模块结构

```
src/
├── HanziWriter.ts          ← 对外公开的主类（全部 API 入口）
├── Quiz.ts                 ← 测验逻辑（有序 / 随机笔顺）
├── RenderState.ts          ← 渲染状态机（驱动所有动画）
├── Mutation.ts             ← 动画帧 / 状态变更原语
├── Positioner.ts           ← 坐标系转换（外部坐标 ↔ 内部坐标）
├── LoadingManager.ts       ← 字符数据加载（网络 / 自定义）
├── parseCharData.ts        ← 解析字符 JSON 为 Character 模型
├── characterActions.ts     ← 动画动作工厂（显示/隐藏/动画/高亮）
├── quizActions.ts          ← 测验动作工厂（用户笔画渲染）
├── strokeMatches.ts        ← 笔画匹配算法（核心判分引擎）
├── geometry.ts             ← 几何计算（Fréchet 距离、余弦相似度等）
├── defaultOptions.ts       ← 全部默认配置
├── defaultCharDataLoader.ts← 默认数据加载器（jsdelivr CDN）
├── models/
│   ├── Character.ts        ← 汉字数据模型
│   ├── Stroke.ts           ← 单笔画数据模型
│   └── UserStroke.ts       ← 用户输入笔画
├── renderers/
│   ├── svg/                ← SVG 渲染器（默认）
│   └── canvas/             ← Canvas 渲染器（可选）
└── typings/types.ts        ← 全部 TypeScript 类型定义
```

---

## 三、核心能力详解

### 3.1 字符显示与隐藏

控制汉字本体及轮廓的显示，支持淡入淡出动画。

```typescript
// 显示字符（带淡入动画）
writer.showCharacter({ duration: 400, onComplete: (res) => {} });

// 隐藏字符
writer.hideCharacter({ duration: 400 });

// 显示/隐藏灰色轮廓
writer.showOutline();
writer.hideOutline();
```

**配置参数：**

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `showCharacter` | `true` | 初始是否显示字符 |
| `showOutline` | `true` | 初始是否显示轮廓 |
| `strokeFadeDuration` | `400ms` | 淡入淡出时长 |

---

### 3.2 笔顺动画（核心功能）

按正确笔顺逐笔绘制整个汉字，每笔之间有延迟间隔。

```typescript
// 播放完整笔顺动画（播放一次）
writer.animateCharacter({ onComplete: (res) => {} });

// 循环播放（无限循环）
writer.loopCharacterAnimation();

// 只动画第 N 笔（从 0 开始）
writer.animateStroke(2, { onComplete: (res) => {} });

// 暂停 / 恢复动画
writer.pauseAnimation();
writer.resumeAnimation();
```

**动画控制参数：**

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `strokeAnimationSpeed` | `1` | 笔画绘制速度倍率（越大越快） |
| `delayBetweenStrokes` | `1000ms` | 每笔之间的停顿时长 |
| `delayBetweenLoops` | `2000ms` | 循环动画每轮之间的停顿 |
| `strokeFadeDuration` | `400ms` | 笔画淡入时长 |

---

### 3.3 笔画高亮

以高亮色单独演示某一笔，动画结束后高亮自动消失。

```typescript
// 高亮第 3 笔（从 0 计数）
writer.highlightStroke(2, { onComplete: () => {} });
```

**高亮控制参数：**

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `highlightColor` | `#AAF` | 高亮颜色（浅蓝） |
| `strokeHighlightSpeed` | `2` | 高亮绘制速度 |

---

### 3.4 交互式书写测验（最复杂功能）

用户用鼠标或触摸在画布上手写笔画，库会自动判断是否正确。

#### 有序测验模式（默认）
必须按照正确笔顺一笔一笔写，否则判为错误。

```typescript
writer.quiz({
  onMistake: (strokeData) => {
    console.log(`第 ${strokeData.strokeNum} 笔写错了，本笔错误次数: ${strokeData.mistakesOnStroke}`);
  },
  onCorrectStroke: (strokeData) => {
    console.log(`剩余笔画: ${strokeData.strokesRemaining}`);
  },
  onComplete: (summary) => {
    console.log(`完成！总错误: ${summary.totalMistakes}`);
  },
});
```

#### 随机笔顺模式（randomOrder）
允许用户以任意顺序书写所有笔画，完成后记录用户实际的书写顺序。

```typescript
writer.quiz({
  randomOrder: true,
  onComplete: (summary) => {
    // summary.userStrokeOrder 记录用户书写的笔画索引顺序
    console.log('用户笔顺:', summary.userStrokeOrder);
  },
});
```

#### 测验控制

```typescript
// 跳过当前笔画（直接显示正确笔画）
writer.skipQuizStroke();

// 取消测验
writer.cancelQuiz();
```

**测验参数全览：**

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `leniency` | `1` | 判分宽松度（越接近 0 越严格） |
| `showHintAfterMisses` | `3` | 错误几次后显示提示（`false` 禁用） |
| `markStrokeCorrectAfterMisses` | `false` | 错误几次后强制通过当前笔画 |
| `acceptBackwardsStrokes` | `false` | 是否接受反向书写的笔画 |
| `quizStartStrokeNum` | `0` | 从第几笔开始测验 |
| `highlightOnComplete` | `true` | 完成时全字高亮闪烁 |
| `highlightCompleteColor` | `null` | 完成高亮色（默认用 highlightColor） |
| `randomOrder` | `false` | 启用随机笔顺模式 |
| `averageDistanceThreshold` | `350` | 平均距离阈值（越大越宽松） |

---

### 3.5 笔画匹配算法（判分引擎）

这是整个库最核心的技术，用于判断用户画的笔画是否与正确笔画匹配。

采用多维度联合判断，**所有条件同时满足才视为匹配**：

| 判断维度 | 算法 | 说明 |
|---------|------|------|
| **位置距离** | 平均欧式距离 | 用户笔画的平均位置是否足够靠近正确笔画 |
| **起止点** | 欧式距离 | 笔画的起点和终点是否在误差范围内 |
| **方向** | 余弦相似度 | 笔画方向是否一致 |
| **形状** | Fréchet 距离 | 归一化曲线的形状是否匹配（允许±11.25°旋转容差） |
| **长度** | 长度比例 | 笔画长度是否足够接近标准笔画 |

**反向笔画检测：** 若正向不匹配，自动反转用户输入重新检测，识别反向书写。

**多笔画歧义消解：** 若当前笔画与后续某笔更接近，自动降低宽松度重新判断，避免误判。

---

### 3.6 颜色自定义

支持运行时动态修改任意颜色，带过渡动画。

```typescript
// 静态配置（初始化时）
HanziWriter.create('target', '中', {
  strokeColor: '#333',        // 笔画颜色
  outlineColor: '#DDD',       // 轮廓颜色
  highlightColor: '#AAF',     // 高亮颜色
  drawingColor: '#555',       // 用户书写颜色
  radicalColor: '#FF4444',    // 部首颜色（需数据支持）
});

// 动态修改（带淡入动画）
writer.updateColor('strokeColor', '#FF0000', { duration: 400 });
writer.updateColor('radicalColor', null); // 恢复部首与笔画同色
```

**颜色参数：**

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `strokeColor` | `#555` | 字符笔画颜色 |
| `outlineColor` | `#DDD` | 轮廓颜色 |
| `highlightColor` | `#AAF` | 高亮/测验提示色 |
| `drawingColor` | `#333` | 用户书写笔迹颜色 |
| `radicalColor` | `null` | 部首独立颜色（null 表示与笔画同色） |
| `highlightCompleteColor` | `null` | 测验完成高亮色 |

---

### 3.7 尺寸与布局控制

```typescript
// 初始化时指定尺寸
HanziWriter.create('target', '中', { width: 200, height: 200, padding: 20 });

// 运行时动态调整（不重置渲染状态）
writer.updateDimensions({ width: 300, height: 300, padding: 10 });
```

**坐标系：** 所有字符数据基于 1024×1024 坐标系，`Positioner` 负责自动缩放和居中映射到实际渲染尺寸。

---

### 3.8 动态切换字符

不需要销毁重建，直接切换到新字符：

```typescript
writer.setCharacter('好');
```

---

### 3.9 双渲染器支持

| 渲染器 | 默认 | 特点 |
|--------|------|------|
| **SVG** | ✅ 是 | 矢量、可缩放、DOM 结构清晰、适合 Web |
| **Canvas** | 否 | 性能更高、适合嵌入式/小程序场景 |

```typescript
// 使用 Canvas 渲染器
HanziWriter.create('target', '中', { renderer: 'canvas' });

// 完全自定义渲染器
HanziWriter.create('target', '中', {
  rendererOverride: {
    HanziWriterRenderer: MyCustomRenderer,
    createRenderTarget: myCreateRenderTarget,
  },
});
```

---

### 3.10 自定义数据加载器

默认从 jsdelivr CDN 加载字符数据，可替换为本地或私有数据源：

```typescript
HanziWriter.create('target', '中', {
  charDataLoader: (char, onLoad, onError) => {
    fetch(`/local-data/${char}.json`)
      .then(res => res.json())
      .then(onLoad)
      .catch(onError);
  },
});
```

**静态方法：** 也可以在创建实例前预加载数据：

```typescript
const charData = await HanziWriter.loadCharacterData('中');
```

---

### 3.11 静态工具方法

```typescript
// 获取 SVG 坐标变换参数（用于自定义 SVG 集成）
const { x, y, scale, transform } = HanziWriter.getScalingTransform(200, 200, 20);
// transform 是完整的 SVG transform 属性字符串

// 获取已加载的字符数据（Character 对象）
const character = await writer.getCharacterData();
// character.strokes 包含每笔的路径点、中轴线、长度等信息
```

---

## 四、完整 API 速查

### 实例方法

| 方法 | 说明 |
|------|------|
| `showCharacter(opts?)` | 显示字符（淡入） |
| `hideCharacter(opts?)` | 隐藏字符（淡出） |
| `showOutline(opts?)` | 显示轮廓 |
| `hideOutline(opts?)` | 隐藏轮廓 |
| `animateCharacter(opts?)` | 播放一次完整笔顺动画 |
| `animateStroke(n, opts?)` | 动画第 n 笔 |
| `loopCharacterAnimation()` | 无限循环动画 |
| `highlightStroke(n, opts?)` | 高亮第 n 笔 |
| `pauseAnimation()` | 暂停当前动画 |
| `resumeAnimation()` | 恢复动画 |
| `quiz(quizOpts?)` | 开始书写测验 |
| `skipQuizStroke()` | 跳过当前笔画 |
| `cancelQuiz()` | 取消测验 |
| `setCharacter(char)` | 切换到新字符 |
| `updateColor(name, val, opts?)` | 动态更新颜色 |
| `updateDimensions(opts)` | 动态调整尺寸 |
| `getCharacterData()` | 获取当前字符数据 |

### 静态方法

| 方法 | 说明 |
|------|------|
| `HanziWriter.create(el, char, opts?)` | 创建实例（最常用入口） |
| `HanziWriter.loadCharacterData(char, opts?)` | 预加载字符数据 |
| `HanziWriter.getScalingTransform(w, h, padding?)` | 获取 SVG 坐标变换 |

---

## 五、典型使用场景

### 场景 1：汉字学习 App 展示笔顺

```html
<div id="writer-target" style="width:200px;height:200px"></div>
<script>
const writer = HanziWriter.create('writer-target', '永', {
  strokeAnimationSpeed: 0.5,
  delayBetweenStrokes: 1200,
  strokeColor: '#333',
  outlineColor: '#EEE',
});
writer.loopCharacterAnimation();
</script>
```

### 场景 2：书法练习测验

```javascript
const writer = HanziWriter.create('target', '永', {
  showCharacter: false,
  showOutline: true,
  leniency: 0.8,            // 严格模式
  showHintAfterMisses: 5,   // 5次错误后提示
  markStrokeCorrectAfterMisses: 10, // 10次后强制过关
});

writer.quiz({
  onMistake: ({ strokeNum, mistakesOnStroke }) =>
    console.log(`第${strokeNum}笔错误，已错${mistakesOnStroke}次`),
  onCorrectStroke: ({ strokesRemaining }) =>
    console.log(`还剩 ${strokesRemaining} 笔`),
  onComplete: ({ totalMistakes }) =>
    alert(`完成！共犯 ${totalMistakes} 个错误`),
});
```

### 场景 3：研究笔顺习惯（随机模式）

```javascript
writer.quiz({
  randomOrder: true,
  showOutline: false,   // 不显示轮廓，更有挑战性
  onComplete: ({ userStrokeOrder }) => {
    console.log('用户书写的笔画顺序:', userStrokeOrder);
    // 可以分析用户是否习惯某些不规范笔顺
  },
});
```

### 场景 4：部首对比教学

```javascript
const writer = HanziWriter.create('target', '语', {
  radicalColor: '#FF4444', // 部首"讠"用红色显示
  strokeColor: '#333',
});
```

---

## 六、项目构建与开发

```bash
# 安装依赖
yarn install

# 运行测试（含覆盖率）
yarn test

# 构建（输出到 dist/）
yarn build

# 代码检查
yarn lint-test

# 格式化
yarn prettier

# 类型检查
yarn typecheck
```

**CI 流程：** CircleCI 在每次 Push 时自动运行测试，覆盖率上报到 Codecov。

---

## 七、数据格式说明

字符数据是一个 JSON 文件，格式如下：

```json
{
  "strokes": [
    "M 517 -125 Q ...",   // 每笔的 SVG path 字符串
    "M 362 417 Q ..."
  ],
  "medians": [
    [[517, -125], [490, 200], [430, 430]],  // 每笔的中轴线坐标
    [[362, 417], [430, 350]]
  ],
  "radStrokes": [0, 1]   // 哪些笔属于部首（可选）
}
```

坐标系基于 1024×1024（y 轴向上为正），`Positioner` 会自动映射到屏幕坐标。

---

## 八、扩展性设计

| 扩展点 | 方式 |
|--------|------|
| 字符数据来源 | `charDataLoader` 回调，可接入本地文件、数据库、自定义 API |
| 渲染后端 | `rendererOverride` 替换整个渲染器，支持微信小程序 Canvas API 等 |
| 判分算法 | 通过 `leniency` / `averageDistanceThreshold` 调整；高级场景可 fork 修改 `strokeMatches.ts` |
| 事件系统 | 所有测验回调（`onMistake`、`onCorrectStroke`、`onComplete`）可接入任意外部状态管理 |

---

## 九、项目边界（不能做什么）

- ❌ 不支持汉字**识别**（OCR），只做书写判断
- ❌ 不包含字体渲染，依赖独立的字符数据包 `hanzi-writer-data`
- ❌ 不管理用户进度和历史记录（需要上层应用自己实现）
- ❌ 不支持词组或句子，每个 `HanziWriter` 实例对应**一个汉字**
- ❌ 不内置拼音/注音标注

---

*生成时间：2026-06-13 | 基于源码分析，版本 3.0.0*
