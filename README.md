# dsh-plugin-liang-calibrator

**滑动变祖器** — 把 [liang-intensity-calibrator](https://github.com/Lichtspektrum/liang-intensity-calibrator) 移植为 DeepSeek Harness 的**模型 + 思考强度（thinking-effort）选择器**，并支持**按供应商定制生效范围**。

[![预览](https://pbs.twimg.com/amplify_video_thumb/2087967285621542912/img/Vk2-2wdcV3s2ITIO.jpg)](https://x.com/BruzWJ/status/2087968145114120691)

## 特性

- 点击输入框（composer）右侧的**模型座位**，直接打开 31 级滑动变祖器。
- 六档位 1:1 对应 DeepSeek 模型目录组合（2 模型 × 3 思考档 = 6 档）：

  | 档位 | 位置 | 模型 · 思考档 |
  | --- | --- | --- |
  | 小难梁 | 00 | DeepSeek-V4-Flash · Off |
  | 牢梁 | 06 | DeepSeek-V4-Flash · High |
  | 梁子 | 12 | DeepSeek-V4-Flash · Max |
  | 梁圣 | 18 | DeepSeek-V4-Pro · Off |
  | 梁神 | 24 | DeepSeek-V4-Pro · High |
  | 梁祖 | 30 | DeepSeek-V4-Pro · Max |

- 对其他模型目录，滑块把 0–30 轨道按比例映射到全部「供应商 × 模型 × 思考档」组合，档位跟随当前选中组合。
- 滑块下方的小 **模型** 行仍可进入普通模型列表。
- **供应商门控（可选）**：通过配置把变祖器**限定**到指定供应商，被排除的供应商完全使用原版模型选择器；未配置时对所有供应商生效（等价上游原版）。
- 生效供应商名单**通过配置指定**，无需改动插件包。

## 供应商配置（核心）

生效范围由 profile 的 `cordis.patch.yml`（`$DSH_HOME/profiles/web/cordis.patch.yml`）里插件行的 `config` 指定。**默认（不配置）对所有供应商生效**，即上游原版行为；想限定生效范围，就写 `config`：

```yaml
- insert:
    - id: liang-calibrator
      name: dsh-plugin-liang-calibrator
      config:
        # 生效的供应商显示名（不配置 = 对所有供应商生效）
        targetVendors:
          - 我的供应商
        # 生效的供应商 id（可选，精确指定）
        targetProviderIds:
          - my-provider
```

改完保存，重启 `dsh web` 生效。

### 匹配规则

一个供应商只要满足**任意一条**即生效：

1. 其模型目录分组的**显示名**等于 `targetVendors` 里的某个名字；
2. 或显示名以 `<名字> ` 开头 —— 覆盖 modlens 视觉包装形式（如 **`我的供应商 (modlens vision)`**，它保留上游显示名并在末尾追加引擎后缀，`modlens-<上游>` 自动发现生成的包装器即为此形式）；
3. 或 provider id 在 `targetProviderIds` 里。

### 常用配置场景

| 想要的效果 | 配置 |
| --- | --- |
| 对所有供应商生效（默认） | 不写 `config` |
| 只对某个供应商显示名生效 | `targetVendors: ['该供应商显示名']` |
| 只对某个特定供应商 id 生效 | 只写 `targetProviderIds: ['xxx']` |
| 临时关闭全部生效 | `targetProviderIds: []` 且 `targetVendors: []`（空数组＝不对任何供应商生效） |

> 空数组表示“不匹配任何供应商”，缺省（不写）表示所有供应商生效，`'*'` 表示通配全部。

## 行为说明

- 当前会话模型属于生效供应商 → 模型座位变成滑动变祖器；
- 其余供应商 → 插件**不注册任何条目**，原版模型选择器原样渲染；
- 切换会话或切换模型后实时联动：命中 → 变祖器，未命中 → 原版；
- 滑块**只在当前供应商内部**排布「模型 × 思考档」，拖动只会调整该供应商内的模型/思考档，**不会改变供应商**；需要换供应商时，用滑块下方「模型」行进入的普通模型列表切换。

实现上是**在注册层面动态注册/注销**，而不是在组件里返回 `null`：`conversation.input.model` 是 `single` 槽，只渲染“最低优先级且未 abdicate 的第一个条目”，占位组件返回 `null` 并不会回落到下一个注册 —— 如果那样做，其他供应商的模型座位会变成空白而非恢复原版。因此插件在命中供应商时才注册 priority −1 的变祖器条目，未命中时注销，让原版 priority 0 条目照常渲染。

## 安装

```sh
dsh plugin --profile web add dsh-plugin-liang-calibrator
```

然后按[「供应商配置」](#供应商配置核心)把条目（含 `config`）注册到 `$DSH_HOME/profiles/web/cordis.patch.yml`，最后重启 `dsh web`。

## 原理

- **Host 半**（`lib/index.js`）：通过 profile 的 `webServer` 服务提供 `/liang-assets/frames/` 下的 31 张肖像关键帧 —— 无 CDN、无需改静态服务器。
- **浏览器半**（`lib/client.js`）：标准 `dsh.client` bundle；读取插件行 `config`（`targetVendors` / `targetProviderIds`），按当前会话模型动态注册/注销 `conversation.input.model` 槽的 **priority −1** 条目，遮蔽原版选择器；未命中时原版照常渲染，卸载插件即恢复原版 UI。
- 肖像用逐帧关键帧而非视频：dsh 静态服务器不支持 HTTP Range，媒体元素 seek 会静默失败，图片关键帧则到处可用。
- 依赖 `@deepseek-ai/dsh-client-ui-model-selection`（随默认 web profile 提供）的共享模型目录服务。

## 卸载

```sh
dsh plugin --profile web remove dsh-plugin-liang-calibrator
```

（并删除 `cordis.patch.yml` 中的条目。）

## 开发

从已安装的 DSH 检出重新生成浏览器 bundle：

```sh
python3 scripts/assemble-client.py /path/to/node_modules/@deepseek-ai [region.js]
```

## 肖像

`lib/assets/frames/frame-00.webp … frame-30.webp` 源自
[liang-intensity-calibrator](https://github.com/Lichtspektrum/liang-intensity-calibrator)
项目的 `public/frames`。复用或再分发前请确认你持有相关肖像与资产权利（参见该项目 README）。

## 许可

MIT。变祖器概念与肖像资产归原作者所有 —— 见上。
