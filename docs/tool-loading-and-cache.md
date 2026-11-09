# 按技能加载工具与前缀缓存

状态：2026-11-09 文档与源码调研完成。核对本机安装版 DSH 0.2.2-rc.1 的 Agent Loop 与 pi-ai 适配器，并对照官方仓库及供应商文档。没有执行供应商缓存命中率、费用或延迟对比实验。

## 结论

按需加载减少未用工具定义的初始上下文占用。是否保留已有 KV cache 前缀，取决于模型协议与适配器能否把新增定义放在历史末尾；“技能加载”或“工具搜索”这个入口本身不能决定缓存命中。

本插件只通过 Agent 作用域的工具限制控制可见性。成功加载技能后解除相应工具的限制，始终拦截列表保留；DSH 随后负责组装实际请求。Native 模式下表现为工具 schema 更新，PTC 模式下还涉及 SDK/说明上下文，具体请求由选用的 executor 与 adapter 决定。

## 为什么前缀位置重要

模型处理提示词时计算 attention 的 Key/Value 状态。供应商的提示词缓存复用相同的已处理前缀；普通历史末尾追加内容，既有前缀仍可匹配，新内容需要计算。修改早期工具名称、描述、schema 或排列，可能从首个不同 token 起失去旧前缀复用。并非每次都清空所有缓存：第一个差异之前的有效前缀仍可能复用。

上下文长度、缓存命中量和实际费用是不同指标。隐藏工具可以减少初始定义，但技能正文和加载后的工具仍会占用上下文；供应商的缓存路由、保留策略以及历史压缩也影响命中。

依据：[OpenAI Prompt Caching](https://developers.openai.com/api/docs/guides/prompt-caching)。

## DSH 的能力判定

[Agent Loop 文档](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/core/agent-loop/README.md#model-experience) 说明：可追加路由可以保留早先系统消息；重写早期系统提示词或工具声明会影响其后的前缀复用。

[Agent Loop 源码](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/core/agent-loop/src/agent.ts) 的请求准备逻辑检查 `preparedCall?.systemPromptUpdate === 'in-history'`。工具可见集合变化且 `preparedCall?.toolUpdate === undefined` 时，会把该条件计入新请求序列的判断。本机安装版 `@deepseek-ai/dsh-agent-loop/lib/index.js` 第 851–852 行保留同一逻辑；其包版本为 0.2.2-rc.1。

[pi-ai 能力解析](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/llm/llm-pi-ai/src/models.ts) 的 `conversationUpdates` 先要求 `supportsMidConvoSystemMessages`。随后按模型协议分别检查：

- Anthropic Messages：`supportsMidConvoToolChanges` → `toolUpdate: 'in-history'`。
- OpenAI Completions：`supportsMidConvoToolAdditions` → `toolUpdate: 'addition-only'`。
- OpenAI Responses / Azure Responses / Codex Responses：`supportsAdditionalTools` 或 `supportsToolSearch` → `toolUpdate: 'addition-only'`。

安装版 `@deepseek-ai/dsh-llm-pi-ai/lib/index.js` 第 788–792 行核到了同样的判断。这些是能力条件，并不意味着每个兼容该 API 名称的模型或网关都实现了它们。

## 是 DeepSeek 还是 GPT

两条路线均存在，证据强度与适用范围如下：

| 来源 | 已核实的支持 | 范围 |
| --- | --- | --- |
| DSH [DeepSeek 默认目录](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/llm/llm-deepseek/src/models.ts) | `deepseek-flash` 同时声明 `systemPromptUpdate: 'in-history'` 与 `toolUpdate: 'addition-only'` | 是 DSH 默认目录声明；实际服务目录可覆盖，自定义路由另行判断，不能泛化到所有 DeepSeek 模型。 |
| OpenAI [Tool Search](https://developers.openai.com/api/docs/guides/tools-tool-search) | 官方写明新发现工具放在上下文末尾，以保留模型缓存；Responses API 从 GPT-5.4 起支持 `tool_search` | 是特定协议能力，不是随意修改普通 `tools` 数组就具有的保证。 |
| Anthropic [Advanced Tool Use](https://www.anthropic.com/research/advanced-tool-use) | 延迟工具不放入初始提示词，搜索后加入上下文；系统提示词和核心工具定义仍可缓存 | 其原生 deferred-tool 协议；不能直接推广为所有自定义工具加载器都保留前缀。 |

本插件的技能绑定不要求 Agent 发起工具搜索；同样可以受益于 DSH 支持的底层追加能力。官方工具搜索协议的缓存说明用于解释协议原理，不能直接当作本插件在任意供应商上的实测结果。

## 与工具搜索的简短比较

工具搜索：搜索能力，再获得匹配工具。技能门控：加载场景技能，同时取得指导和绑定工具。后者适合使用场景明确、需要配套指导的专用工具；其优势是复用本来就要发生的技能加载。

“对熟悉技能的模型可能更顺手”是设计判断。没有证据把“大多数模型都经过技能强化训练”或“技能加载比工具搜索更准确、更快”写成普遍结论。两种路线的缓存行为应单独按实际请求验证。

## 发布文档的表述边界

README 使用“支持追加式更新时保留未变前缀”，避免承诺任意路由缓存完全无损。图片来自用户提供的真实界面，仅用于展示操作与工具可见性，不作为缓存收益实验。
