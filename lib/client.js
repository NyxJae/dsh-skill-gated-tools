window.__ModuleLoader__.load({
	id: "dsh-skill-gated-tools",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/policy.ts
		/** Derive policies for exactly the supplied catalog, without adding missing references. */
		function describeTools(names, bindings, blockedTools) {
			const blocked = new Set(blockedTools);
			const skillsByTool = /* @__PURE__ */ new Map();
			for (const row of bindings) for (const tool of row.tools) {
				const skills = skillsByTool.get(tool) ?? /* @__PURE__ */ new Set();
				skills.add(row.skill);
				skillsByTool.set(tool, skills);
			}
			return [...new Set(names)].sort().map((name) => {
				const skills = [...skillsByTool.get(name) ?? []].sort();
				return {
					name,
					skills,
					policy: blocked.has(name) ? "blocked" : skills.length > 0 ? "gated" : "available"
				};
			});
		}
		/** Replace selected tools' rules, retaining every unrelated binding and block. */
		function replacePolicies(bindings, blockedTools, selected, policy, skills) {
			const targets = new Set(selected);
			const next = /* @__PURE__ */ new Map();
			for (const row of bindings) {
				const tools = next.get(row.skill) ?? /* @__PURE__ */ new Set();
				for (const name of row.tools) if (!targets.has(name)) tools.add(name);
				next.set(row.skill, tools);
			}
			if (policy === "gated") for (const skill of skills) {
				const tools = next.get(skill) ?? /* @__PURE__ */ new Set();
				for (const name of targets) tools.add(name);
				next.set(skill, tools);
			}
			const blocked = new Set(blockedTools.filter((name) => !targets.has(name)));
			if (policy === "blocked") for (const name of targets) blocked.add(name);
			return {
				bindings: [...next].filter(([, tools]) => tools.size > 0).map(([skill, tools]) => ({
					skill,
					tools: [...tools].sort()
				})),
				blockedTools: [...blocked].sort()
			};
		}
		//#endregion
		//#region \0dsh-css:C:\Users\HJ\.dsh\plugins\dsh-skill-gated-tools\src\client\SkillGateSection.module.css.mjs
		const css = "._7gFMta_section{width:100%;min-width:0;max-width:1120px;color:var(--dsw-alias-label-primary);flex-direction:column;gap:20px;display:flex;container-type:inline-size}._7gFMta_header{justify-content:space-between;align-items:flex-start;gap:20px;display:flex}._7gFMta_header>div{min-width:0}._7gFMta_title{letter-spacing:-.3px;margin:0 0 6px;font-size:20px;font-weight:600;line-height:1.4}._7gFMta_subtle{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px;line-height:1.65}._7gFMta_section button{white-space:nowrap}._7gFMta_section button:focus-visible,._7gFMta_section input:focus-visible,._7gFMta_section select:focus-visible,._7gFMta_section summary:focus-visible{outline:2px solid var(--dsw-alias-label-secondary);outline-offset:3px}._7gFMta_section button:disabled{cursor:default}._7gFMta_ruleCounts{flex-wrap:wrap;gap:8px;display:flex}._7gFMta_ruleCounts>button{border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md);color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1);cursor:pointer;align-items:center;gap:8px;padding:6px 10px;font-size:12px;display:flex}._7gFMta_ruleCounts>button:hover,._7gFMta_ruleCounts>button[aria-pressed=true]{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-label-tertiary)}._7gFMta_ruleCounts strong{font-variant-numeric:tabular-nums;font-weight:600}._7gFMta_dot{background:var(--dsw-alias-label-tertiary);border-radius:50%;width:6px;height:6px}._7gFMta_dot[data-policy=gated]{background:var(--dsw-alias-label-secondary)}._7gFMta_dot[data-policy=blocked]{background:var(--dsw-alias-label-primary)}._7gFMta_workspace{grid-template-columns:minmax(0,1fr) 280px;align-items:start;gap:20px;display:grid}._7gFMta_directory{border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-bg-layer-1);min-width:0;overflow:hidden}._7gFMta_toolbar{border-bottom:1px solid var(--dsw-alias-border-l2);align-items:center;gap:10px;padding:12px;display:flex}._7gFMta_search{flex:1;min-width:0}._7gFMta_search input,._7gFMta_skillPicker input:not([type=checkbox]){box-sizing:border-box;width:100%;min-width:0}._7gFMta_select{border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md);min-width:0;max-width:44%;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-base);padding:7px 9px;font-size:12px}._7gFMta_table{border-collapse:collapse;table-layout:fixed;text-align:left;width:100%;font-size:12px}._7gFMta_table th{color:var(--dsw-alias-label-tertiary);background:var(--dsw-alias-bg-layer-2);padding:10px 12px;font-weight:500}._7gFMta_table td{border-top:1px solid var(--dsw-alias-border-l1);vertical-align:middle;padding:11px 12px}._7gFMta_table tr[data-selected],._7gFMta_table tbody tr:hover{background:var(--dsw-alias-bg-layer-2)}._7gFMta_table ._7gFMta_checkColumn{width:32px;padding-left:12px;padding-right:0}._7gFMta_table ._7gFMta_actionColumn{text-align:right;width:58px;padding-left:4px;padding-right:12px}._7gFMta_table input[type=checkbox]{cursor:pointer;width:14px;height:14px;margin:0}._7gFMta_toolName{font-family:var(--dsw-font-markdown-code-font-family,monospace);overflow-wrap:anywhere;font-size:12px;line-height:1.6;display:block}._7gFMta_policyBadge{border-radius:var(--dsw-radius-sm);color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);padding:2px 6px;font-size:11px;line-height:18px;display:inline-block}._7gFMta_policyBadge[data-policy=blocked]{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l2)}._7gFMta_skillNames{-webkit-line-clamp:2;overflow-wrap:anywhere;color:var(--dsw-alias-label-tertiary);font-family:var(--dsw-font-markdown-code-font-family,monospace);-webkit-box-orient:vertical;margin-top:3px;font-size:11px;line-height:1.5;display:-webkit-box;overflow:hidden}._7gFMta_pagination{border-top:1px solid var(--dsw-alias-border-l2);flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;padding:10px 12px;display:flex}._7gFMta_actions{align-items:center;gap:8px;display:flex}._7gFMta_pageNumber{color:var(--dsw-alias-label-tertiary);white-space:nowrap;font-variant-numeric:tabular-nums;font-size:11px}._7gFMta_editor{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-bg-layer-1);flex-direction:column;gap:16px;min-width:0;padding:18px;display:flex}._7gFMta_editorHeading{justify-content:space-between;align-items:center;gap:8px;display:flex}._7gFMta_editor h3{margin:0;font-size:15px;font-weight:600;line-height:1.5}._7gFMta_editorHeading h3{font-size:13px}._7gFMta_editorEmpty{flex-direction:column;gap:8px;padding:30px 0;display:flex}._7gFMta_emptySymbol{color:var(--dsw-alias-label-tertiary);font-size:28px}._7gFMta_selectionSummary{flex-direction:column;gap:6px;display:flex}._7gFMta_selectionSummary>strong{font-size:16px;font-weight:600}._7gFMta_selectionSummary details{color:var(--dsw-alias-label-tertiary);font-size:12px}._7gFMta_selectionSummary summary{cursor:pointer}._7gFMta_selectedNames{flex-direction:column;gap:4px;max-height:100px;padding-top:8px;display:flex;overflow:auto}._7gFMta_selectedNames code{overflow-wrap:anywhere;font-size:11px}._7gFMta_policyChoices{border:0;flex-direction:column;gap:8px;min-width:0;margin:0;padding:0;display:flex}._7gFMta_policyChoice{border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md);cursor:pointer;align-items:flex-start;gap:9px;padding:10px;display:flex}._7gFMta_policyChoice[data-active]{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-label-tertiary)}._7gFMta_policyChoice input{flex:none;margin:3px 0 0}._7gFMta_policyChoice strong{font-size:12px;font-weight:500}._7gFMta_policyChoice ._7gFMta_subtle{margin-top:3px;font-size:11px;display:block}._7gFMta_skillPicker{flex-direction:column;gap:8px;min-width:0;display:flex}._7gFMta_label{font-size:12px;font-weight:500}._7gFMta_skillChoices{border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md);flex-direction:column;gap:2px;max-height:180px;padding:4px;display:flex;overflow-y:auto}._7gFMta_skillChoice{cursor:pointer;align-items:flex-start;gap:8px;padding:6px 4px;display:flex}._7gFMta_skillChoice input{flex:none;margin:2px 0 0}._7gFMta_skillChoice code{overflow-wrap:anywhere;font-size:11px}._7gFMta_skillChoice ._7gFMta_subtle{font-size:11px;display:block}._7gFMta_storage{color:var(--dsw-alias-label-tertiary);flex-direction:column;gap:3px;margin:0;font-size:12px;line-height:1.6;display:flex}._7gFMta_storage code{font-family:var(--dsw-font-markdown-code-font-family,monospace);overflow-wrap:anywhere;color:var(--dsw-alias-label-secondary);font-size:11px}._7gFMta_legacy{border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-bg-layer-1);justify-content:space-between;align-items:flex-start;gap:16px;padding:12px 14px;display:flex}._7gFMta_legacy p{color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere;margin:0;font-size:12px;line-height:1.65}._7gFMta_error,._7gFMta_warning,._7gFMta_success{border-radius:var(--dsw-radius-md);border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere;margin:0;padding:10px 12px;font-size:12px;line-height:1.65}._7gFMta_error{border-left:3px solid var(--dsw-alias-label-primary)}._7gFMta_warning{border-color:color-mix(in srgb, var(--dsw-alias-state-warn-label) 20%, transparent);background:var(--dsw-alias-state-warn-tertiary);color:var(--dsw-alias-state-warn-label)}._7gFMta_loading,._7gFMta_empty{color:var(--dsw-alias-label-tertiary);text-align:center;margin:0;padding:28px 16px;font-size:13px}._7gFMta_srOnly{clip:rect(0,0,0,0);white-space:nowrap;border:0;width:1px;height:1px;margin:-1px;padding:0;position:absolute;overflow:hidden}@container (width<=800px){._7gFMta_workspace{grid-template-columns:minmax(0,1fr)}._7gFMta_workspace[data-has-selection] ._7gFMta_editor{grid-row:1}._7gFMta_workspace:not([data-has-selection]) ._7gFMta_editor{display:none}._7gFMta_policyChoices{grid-template-columns:repeat(3,minmax(0,1fr));display:grid}}@container (width<=480px){._7gFMta_header{flex-direction:column;gap:12px}._7gFMta_toolbar{flex-wrap:wrap}._7gFMta_search{flex-basis:100%}._7gFMta_select{width:100%;max-width:100%}._7gFMta_pagination{flex-direction:column;align-items:stretch}._7gFMta_pagination ._7gFMta_actions{justify-content:space-between}._7gFMta_table td,._7gFMta_table th{padding-left:8px;padding-right:8px}._7gFMta_policyChoices{display:flex}}";
		const tagId = "dsh-skill-gated-tools/SkillGateSection.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-skill-gated-tools";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var SkillGateSection_module_css_default = {
			"actionColumn": "_7gFMta_actionColumn",
			"actions": "_7gFMta_actions",
			"checkColumn": "_7gFMta_checkColumn",
			"directory": "_7gFMta_directory",
			"dot": "_7gFMta_dot",
			"editor": "_7gFMta_editor",
			"editorEmpty": "_7gFMta_editorEmpty",
			"editorHeading": "_7gFMta_editorHeading",
			"empty": "_7gFMta_empty",
			"emptySymbol": "_7gFMta_emptySymbol",
			"error": "_7gFMta_error",
			"header": "_7gFMta_header",
			"label": "_7gFMta_label",
			"legacy": "_7gFMta_legacy",
			"loading": "_7gFMta_loading",
			"pageNumber": "_7gFMta_pageNumber",
			"pagination": "_7gFMta_pagination",
			"policyBadge": "_7gFMta_policyBadge",
			"policyChoice": "_7gFMta_policyChoice",
			"policyChoices": "_7gFMta_policyChoices",
			"ruleCounts": "_7gFMta_ruleCounts",
			"search": "_7gFMta_search",
			"section": "_7gFMta_section",
			"select": "_7gFMta_select",
			"selectedNames": "_7gFMta_selectedNames",
			"selectionSummary": "_7gFMta_selectionSummary",
			"skillChoice": "_7gFMta_skillChoice",
			"skillChoices": "_7gFMta_skillChoices",
			"skillNames": "_7gFMta_skillNames",
			"skillPicker": "_7gFMta_skillPicker",
			"srOnly": "_7gFMta_srOnly",
			"storage": "_7gFMta_storage",
			"subtle": "_7gFMta_subtle",
			"success": "_7gFMta_success",
			"table": "_7gFMta_table",
			"title": "_7gFMta_title",
			"toolName": "_7gFMta_toolName",
			"toolbar": "_7gFMta_toolbar",
			"warning": "_7gFMta_warning",
			"workspace": "_7gFMta_workspace"
		};
		//#endregion
		//#region src/client/RuleEditor.tsx
		/** Focused editor for one tool or an explicitly selected group of tools. */
		/** Render explicit policy choices, multi-skill selection and the save action. */
		function RuleEditor({ selected, policy, skills, catalog, catalogResolved, busy, onPolicy, onSkills, onClear, onSave, t }) {
			const id = (0, react.useId)();
			const [query, setQuery] = (0, react.useState)("");
			const choices = [.../* @__PURE__ */ new Set([...catalog, ...skills])].sort().filter((name) => name.toLowerCase().includes(query.trim().toLowerCase()));
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("aside", {
				className: SkillGateSection_module_css_default.editor,
				"aria-label": t("editor.title"),
				children: selected.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: SkillGateSection_module_css_default.editorEmpty,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: SkillGateSection_module_css_default.emptySymbol,
							"aria-hidden": "true",
							children: "↖"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t("editor.emptyTitle") }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: SkillGateSection_module_css_default.subtle,
							children: t("editor.empty")
						})
					]
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: SkillGateSection_module_css_default.editorHeading,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t("editor.title") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							size: "sm",
							variant: "outline",
							disabled: busy,
							onClick: onClear,
							children: t("editor.clear")
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: SkillGateSection_module_css_default.selectionSummary,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("editor.count", { count: selected.length }) }), selected.length === 1 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
							className: SkillGateSection_module_css_default.toolName,
							children: selected[0]
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: t("editor.selectedTools") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: SkillGateSection_module_css_default.selectedNames,
							children: selected.map((name) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: name }, name))
						})] })]
					}),
					selected.length > 1 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: SkillGateSection_module_css_default.subtle,
						children: t("editor.batch")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("fieldset", {
						className: SkillGateSection_module_css_default.policyChoices,
						disabled: busy,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("legend", {
							className: SkillGateSection_module_css_default.srOnly,
							children: t("editor.policy")
						}), [
							"available",
							"gated",
							"blocked"
						].map((kind) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: SkillGateSection_module_css_default.policyChoice,
							"data-active": policy === kind || void 0,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "radio",
								name: id,
								checked: policy === kind,
								onChange: () => onPolicy(kind)
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("policy." + kind) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: SkillGateSection_module_css_default.subtle,
								children: t("policy." + kind + "Desc")
							})] })]
						}, kind))]
					}),
					policy === "gated" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: SkillGateSection_module_css_default.skillPicker,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
								className: SkillGateSection_module_css_default.label,
								htmlFor: id + "-skills",
								children: t("skills.label")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
								id: id + "-skills",
								placeholder: t("skills.search"),
								value: query,
								disabled: busy,
								onChange: (event) => setQuery(event.target.value)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: SkillGateSection_module_css_default.skillChoices,
								children: [choices.map((name) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: SkillGateSection_module_css_default.skillChoice,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "checkbox",
										disabled: busy,
										checked: skills.includes(name),
										onChange: () => onSkills(skills.includes(name) ? skills.filter((skill) => skill !== name) : [...skills, name])
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: name }), !catalog.includes(name) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: SkillGateSection_module_css_default.subtle,
										children: t(catalogResolved ? "skills.missing" : "skills.unresolved")
									})] })]
								}, name)), choices.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: SkillGateSection_module_css_default.subtle,
									children: t("skills.empty")
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: SkillGateSection_module_css_default.subtle,
								children: t("skills.selected", { count: skills.length })
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "primary",
						disabled: busy || policy === void 0 || policy === "gated" && skills.length === 0,
						onClick: onSave,
						children: busy ? t("save.saving") : t("save.submit")
					})
				] })
			});
		}
		//#endregion
		//#region src/client/ToolDirectory.tsx
		/** Searchable, paginated tool directory over the saved access rules. */
		const PAGE_SIZE = 10;
		/** Render a bounded tool table and its search/filter controls. */
		function ToolDirectory({ rows, filter, onFilter, knownTools, knownSkills, selected, onSelect, onEdit, busy, t }) {
			const searchId = (0, react.useId)();
			const filterId = (0, react.useId)();
			const [query, setQuery] = (0, react.useState)("");
			const [page, setPage] = (0, react.useState)(0);
			const term = query.trim().toLowerCase();
			const matches = rows.filter((row) => (filter === "all" || row.policy === filter) && (row.name.toLowerCase().includes(term) || row.skills.some((skill) => skill.toLowerCase().includes(term))));
			const pages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
			const currentPage = Math.min(page, pages - 1);
			const visible = matches.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
			const pageSelected = visible.length > 0 && visible.every((row) => selected.includes(row.name));
			/** A gated row whose catalog is readable and no longer lists one of its skills. */
			const missingSkill = (row) => row.policy === "gated" && knownSkills !== void 0 && row.skills.some((skill) => !knownSkills.has(skill));
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: SkillGateSection_module_css_default.directory,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: SkillGateSection_module_css_default.toolbar,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: SkillGateSection_module_css_default.search,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
									className: SkillGateSection_module_css_default.srOnly,
									htmlFor: searchId,
									children: t("table.search")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
									id: searchId,
									placeholder: t("table.search"),
									value: query,
									onChange: (event) => {
										setQuery(event.target.value);
										setPage(0);
									}
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
								className: SkillGateSection_module_css_default.srOnly,
								htmlFor: filterId,
								children: t("table.filter")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
								id: filterId,
								className: SkillGateSection_module_css_default.select,
								value: filter,
								onChange: (event) => {
									onFilter(event.target.value);
									setPage(0);
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: "all",
									children: t("policy.all")
								}), [
									"available",
									"gated",
									"blocked"
								].map((policy) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: policy,
									children: t("policy." + policy)
								}, policy))]
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("table", {
						className: SkillGateSection_module_css_default.table,
						"aria-label": t("table.name"),
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
								className: SkillGateSection_module_css_default.checkColumn,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "checkbox",
									"aria-label": t("table.selectPage"),
									disabled: busy || visible.length === 0,
									checked: pageSelected,
									onChange: () => onSelect(pageSelected ? selected.filter((name) => !visible.some((row) => row.name === name)) : [.../* @__PURE__ */ new Set([...selected, ...visible.map((row) => row.name)])])
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: t("table.name") }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: t("table.policy") }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
								className: SkillGateSection_module_css_default.actionColumn,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: SkillGateSection_module_css_default.srOnly,
									children: t("table.actions")
								})
							})
						] }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("tbody", { children: visible.map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", {
							"data-tool-row": row.name,
							"data-selected": selected.includes(row.name) || void 0,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
									className: SkillGateSection_module_css_default.checkColumn,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "checkbox",
										"aria-label": t("table.selectTool", { tool: row.name }),
										disabled: busy,
										checked: selected.includes(row.name),
										onChange: () => onSelect(selected.includes(row.name) ? selected.filter((name) => name !== row.name) : [...selected, row.name])
									})
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("td", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
									className: SkillGateSection_module_css_default.toolName,
									children: row.name
								}), !knownTools.has(row.name) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: SkillGateSection_module_css_default.subtle,
									children: t("table.unregistered")
								})] }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("td", { children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: SkillGateSection_module_css_default.policyBadge,
										"data-policy": row.policy,
										children: t("policy." + row.policy)
									}),
									row.policy === "gated" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: SkillGateSection_module_css_default.skillNames,
										title: row.skills.join(", "),
										children: row.skills.join(" · ")
									}),
									missingSkill(row) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: SkillGateSection_module_css_default.subtle,
										children: t("table.missingSkills")
									})
								] }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
									className: SkillGateSection_module_css_default.actionColumn,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										size: "sm",
										variant: "outline",
										disabled: busy,
										"aria-label": t("table.editTool", { tool: row.name }),
										onClick: () => onEdit(row.name),
										children: t("table.edit")
									})
								})
							]
						}, row.name)) })]
					}),
					matches.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: SkillGateSection_module_css_default.empty,
						children: t("table.empty")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: SkillGateSection_module_css_default.pagination,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: SkillGateSection_module_css_default.subtle,
							children: t("table.result", { count: matches.length })
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: SkillGateSection_module_css_default.actions,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									size: "sm",
									variant: "outline",
									disabled: currentPage === 0,
									onClick: () => setPage(currentPage - 1),
									children: t("table.previous")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: SkillGateSection_module_css_default.pageNumber,
									children: t("table.page", {
										page: currentPage + 1,
										pages
									})
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									size: "sm",
									variant: "outline",
									disabled: currentPage >= pages - 1,
									onClick: () => setPage(currentPage + 1),
									children: t("table.next")
								})
							]
						})]
					})
				]
			});
		}
		//#endregion
		//#region src/client/SkillGateSection.tsx
		/** Tool policy workspace: the rule directory and the editor for the current selection. */
		/** Render searchable rule management for the document this profile owns. */
		function SkillGateSection({ load, save, importLegacy, t }) {
			const [snapshot, setSnapshot] = (0, react.useState)();
			const [busy, setBusy] = (0, react.useState)("load");
			const [message, setMessage] = (0, react.useState)();
			const [filter, setFilter] = (0, react.useState)("all");
			const [selected, setSelected] = (0, react.useState)([]);
			const [policy, setPolicy] = (0, react.useState)();
			const [skills, setSkills] = (0, react.useState)([]);
			const clearDraft = (0, react.useCallback)(() => {
				setSelected([]);
				setPolicy(void 0);
				setSkills([]);
			}, []);
			const refresh = (0, react.useCallback)(async () => {
				setBusy("load");
				setMessage(void 0);
				try {
					setSnapshot(await load());
					clearDraft();
				} catch (error) {
					setMessage({
						kind: "error",
						text: t("load.failed", { message: String(error) })
					});
				} finally {
					setBusy(void 0);
				}
			}, [
				clearDraft,
				load,
				t
			]);
			(0, react.useEffect)(() => {
				refresh();
			}, [refresh]);
			const rows = snapshot === void 0 ? [] : describeTools([
				...snapshot.tools,
				...snapshot.blockedTools,
				...snapshot.bindings.flatMap((row) => row.tools)
			], snapshot.bindings, snapshot.blockedTools);
			const choose = (names) => {
				setSelected(names);
				setMessage(void 0);
				const row = names.length === 1 ? rows.find((row) => row.name === names[0]) : void 0;
				setPolicy(row?.policy);
				setSkills(row?.skills ?? []);
			};
			const persist = async () => {
				if (snapshot === void 0 || busy !== void 0 || policy === void 0 || selected.length === 0 || policy === "gated" && skills.length === 0) return;
				const next = replacePolicies(snapshot.bindings, snapshot.blockedTools, selected, policy, skills);
				setBusy("save");
				setMessage(void 0);
				try {
					const saved = await save(next.bindings, next.blockedTools);
					setSnapshot((current) => current === void 0 ? current : {
						...current,
						bindings: saved,
						blockedTools: next.blockedTools
					});
					setMessage({
						kind: "ok",
						text: t("save.saved")
					});
				} catch (error) {
					setMessage({
						kind: "error",
						text: t("save.failed", { message: String(error) })
					});
				} finally {
					setBusy(void 0);
				}
			};
			const importLegacyRules = async () => {
				if (snapshot === void 0 || busy !== void 0) return;
				setBusy("import");
				setMessage(void 0);
				try {
					const imported = await importLegacy();
					setSnapshot((current) => current === void 0 ? current : {
						...current,
						bindings: imported.bindings,
						blockedTools: imported.blockedTools,
						legacyAvailable: false
					});
					clearDraft();
					setMessage({
						kind: "ok",
						text: t("legacy.imported")
					});
				} catch (error) {
					setMessage({
						kind: "error",
						text: t("legacy.failed", { message: String(error) })
					});
				} finally {
					setBusy(void 0);
				}
			};
			const missingSkills = snapshot?.bindings.map((row) => row.skill).filter((skill) => !snapshot.skills.includes(skill)) ?? [];
			const catalogResolved = snapshot?.skillsResolved ?? true;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: SkillGateSection_module_css_default.section,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
						className: SkillGateSection_module_css_default.header,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
							className: SkillGateSection_module_css_default.title,
							children: t("title")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							size: "sm",
							variant: "outline",
							disabled: busy !== void 0,
							onClick: () => {
								refresh();
							},
							children: t("refresh")
						})]
					}),
					message !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: message.kind === "error" ? SkillGateSection_module_css_default.error : SkillGateSection_module_css_default.success,
						role: message.kind === "error" ? "alert" : "status",
						children: message.text
					}),
					snapshot?.warnings.map((warning) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: SkillGateSection_module_css_default.warning,
						children: warning
					}, warning)),
					missingSkills.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: SkillGateSection_module_css_default.warning,
						children: catalogResolved ? t("warn.unknownSkills", { skills: [...new Set(missingSkills)].join(", ") }) : t("warn.unresolvedSkills", { skills: [...new Set(missingSkills)].join(", ") })
					}),
					snapshot?.legacyAvailable === true && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: SkillGateSection_module_css_default.legacy,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("legacy.body", { path: snapshot.legacyBindingPath }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							size: "sm",
							variant: "outline",
							disabled: busy !== void 0,
							onClick: () => {
								importLegacyRules();
							},
							children: t("legacy.import")
						})]
					}),
					busy === "load" && snapshot === void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: SkillGateSection_module_css_default.loading,
						role: "status",
						children: t("loading")
					}),
					snapshot !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: SkillGateSection_module_css_default.ruleCounts,
							children: [
								"available",
								"gated",
								"blocked"
							].map((kind) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								"aria-pressed": filter === kind,
								onClick: () => setFilter(filter === kind ? "all" : kind),
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: SkillGateSection_module_css_default.dot,
										"data-policy": kind
									}),
									t("policy." + kind),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: rows.filter((row) => row.policy === kind).length })
								]
							}, kind))
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: SkillGateSection_module_css_default.workspace,
							"data-has-selection": selected.length > 0 || void 0,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToolDirectory, {
								rows,
								filter,
								onFilter: setFilter,
								knownTools: new Set(snapshot.tools),
								knownSkills: catalogResolved ? new Set(snapshot.skills) : void 0,
								selected,
								onSelect: choose,
								onEdit: (name) => choose([name]),
								busy: busy !== void 0,
								t
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RuleEditor, {
								selected,
								policy,
								skills,
								catalog: snapshot.skills,
								catalogResolved,
								busy: busy !== void 0,
								onPolicy: setPolicy,
								onSkills: setSkills,
								onClear: () => choose([]),
								onSave: () => {
									persist();
								},
								t
							}, selected.join("|"))]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
							className: SkillGateSection_module_css_default.storage,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [t("store.label"), snapshot.profileName === null ? "" : " · " + t("store.profile", { profile: snapshot.profileName })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: snapshot.bindingPath })]
						})
					] })
				]
			});
		}
		//#endregion
		//#region src/client/locales.ts
		/** Tool gate workspace locale dictionaries. */
		const NS = "skillGate";
		const zh = {
			title: "技能门控工具",
			refresh: "刷新数据",
			loading: "正在读取工具和规则…",
			"policy.available": "直接可用",
			"policy.gated": "按技能解锁",
			"policy.blocked": "始终拦截",
			"policy.all": "全部规则",
			"policy.availableDesc": "启动时直接提供，不需要加载技能。",
			"policy.gatedDesc": "加载任一所选技能后，才提供这些工具。",
			"policy.blockedDesc": "始终不提供，加载技能也不会解锁。",
			"table.name": "工具",
			"table.policy": "访问规则",
			"table.actions": "操作",
			"table.search": "搜索工具或技能",
			"table.filter": "按访问规则筛选",
			"table.selectPage": "选择当前页工具",
			"table.selectTool": "选择 {tool}",
			"table.edit": "编辑",
			"table.editTool": "编辑 {tool}",
			"table.unregistered": "当前未注册",
			"table.missingSkills": "含未找到的技能",
			"table.empty": "没有匹配的工具",
			"table.result": "{count} 个结果",
			"table.page": "第 {page} / {pages} 页",
			"table.previous": "上一页",
			"table.next": "下一页",
			"editor.title": "编辑规则",
			"editor.emptyTitle": "选择要调整的工具",
			"editor.empty": "点击工具旁的编辑，或勾选多个工具批量设置。",
			"editor.count": "已选 {count} 个工具",
			"editor.clear": "取消选择",
			"editor.batch": "选择一种访问方式，应用到全部选中工具。",
			"editor.policy": "访问方式",
			"editor.selectedTools": "查看选中的工具",
			"skills.label": "解锁技能",
			"skills.search": "搜索技能",
			"skills.selected": "已选 {count} 个技能，加载任意一个即可解锁",
			"skills.empty": "没有匹配的技能",
			"skills.missing": "未在技能目录中找到",
			"skills.unresolved": "技能目录暂不可用，未解析",
			"save.submit": "保存规则",
			"save.saving": "正在保存…",
			"save.saved": "已保存。重新打开会话后应用。",
			"save.failed": "保存失败：{message}",
			"load.failed": "读取失败：{message}",
			"warn.unknownSkills": "这些解锁技能目前不在目录中：{skills}",
			"warn.unresolvedSkills": "技能目录暂不可用：这些解锁技能暂未解析，不影响保存其它规则：{skills}",
			"store.label": "绑定文件",
			"store.profile": "Profile {profile}",
			"legacy.body": "检测到旧版全局绑定 {path}。当前 profile 的文件还没建立；导入只写入当前 profile 的文件，不覆盖已有内容，也不改动旧文件。",
			"legacy.import": "导入旧规则",
			"legacy.imported": "已导入。重新打开会话后应用。",
			"legacy.failed": "导入失败：{message}"
		};
		const en = {
			title: "Skill-gated tools",
			refresh: "Refresh data",
			loading: "Loading tools and rules…",
			"policy.available": "Available",
			"policy.gated": "Skill-gated",
			"policy.blocked": "Always blocked",
			"policy.all": "All rules",
			"policy.availableDesc": "Offer these tools at startup without loading a skill.",
			"policy.gatedDesc": "Offer these tools after any selected skill loads.",
			"policy.blockedDesc": "Never offer these tools, even after a skill loads.",
			"table.name": "Tool",
			"table.policy": "Access rule",
			"table.actions": "Actions",
			"table.search": "Search tools or skills",
			"table.filter": "Filter by access rule",
			"table.selectPage": "Select tools on this page",
			"table.selectTool": "Select {tool}",
			"table.edit": "Edit",
			"table.editTool": "Edit {tool}",
			"table.unregistered": "Not currently registered",
			"table.missingSkills": "Includes a skill not found",
			"table.empty": "No matching tools",
			"table.result": "{count} results",
			"table.page": "Page {page} of {pages}",
			"table.previous": "Previous",
			"table.next": "Next",
			"editor.title": "Edit rule",
			"editor.emptyTitle": "Choose tools to adjust",
			"editor.empty": "Edit a tool, or select several tools to apply a rule in bulk.",
			"editor.count": "{count} tools selected",
			"editor.clear": "Clear selection",
			"editor.batch": "Choose an access rule to apply to every selected tool.",
			"editor.policy": "Access rule",
			"editor.selectedTools": "View selected tools",
			"skills.label": "Unlocking skills",
			"skills.search": "Search skills",
			"skills.selected": "{count} skills selected; loading any one unlocks the tools",
			"skills.empty": "No matching skills",
			"skills.missing": "Not found in the skill catalog",
			"skills.unresolved": "Skill catalog unavailable, unresolved",
			"save.submit": "Save rule",
			"save.saving": "Saving…",
			"save.saved": "Saved. Reopen a session to apply.",
			"save.failed": "Save failed: {message}",
			"load.failed": "Load failed: {message}",
			"warn.unknownSkills": "These unlocking skills are missing from the catalog: {skills}",
			"warn.unresolvedSkills": "Skill catalog unavailable: these unlocking skills are unresolved, and saving other rules is unaffected: {skills}",
			"store.label": "Binding file",
			"store.profile": "Profile {profile}",
			"legacy.body": "A legacy global document exists at {path}. This profile has no file yet; importing writes only this profile’s file, overwrites nothing, and leaves the legacy document untouched.",
			"legacy.import": "Import legacy rules",
			"legacy.imported": "Imported. Reopen a session to apply.",
			"legacy.failed": "Import failed: {message}"
		};
		//#endregion
		//#region src/client/snapshot.ts
		/** Route the Host serves this plugin's REST surface on. */
		const BASE = "/skill-gate";
		/** Read one JSON response, turning every failure into a thrown Error. */
		async function readJson(path, init) {
			const response = await fetch(path, {
				headers: {
					accept: "application/json",
					...init?.headers
				},
				...init
			});
			const text = await response.text();
			let payload;
			try {
				payload = text.length === 0 ? void 0 : JSON.parse(text);
			} catch {
				throw new Error(`${path} returned non-JSON content`);
			}
			const body = payload;
			if (!response.ok || body?.ok !== true) throw new Error(typeof body?.message === "string" ? body.message : `${path} failed with ${String(response.status)}`);
			return payload;
		}
		/** Read the Host state. */
		async function loadSnapshot() {
			const body = await readJson(BASE);
			return {
				skills: body.skills,
				skillsResolved: body.skillsResolved ?? true,
				tools: body.tools,
				startupTools: body.startupTools ?? null,
				bindings: body.bindings,
				blockedTools: body.blockedTools ?? [],
				warnings: body.warnings,
				bindingPath: body.bindingPath ?? BASE,
				profileName: body.profileName ?? null,
				legacyBindingPath: body.legacyBindingPath ?? "",
				legacyAvailable: body.legacyAvailable ?? false
			};
		}
		/**
		* Copy the legacy global document into an empty profile file.
		*
		* The Host refuses this when the profile file already exists, so the action can
		* never overwrite rules the user has since saved.
		*/
		async function importLegacyBindings() {
			const body = await readJson("/skill-gate/bindings/import-legacy", { method: "POST" });
			return {
				bindings: body.bindings,
				blockedTools: body.blockedTools ?? []
			};
		}
		/** Replace the stored bindings. */
		async function saveBindings(rows, blockedTools) {
			return (await readJson(`${BASE}/bindings`, {
				method: "PUT",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					bindings: rows,
					blockedTools
				})
			})).bindings;
		}
		//#endregion
		//#region src/client/index.ts
		/** Services required by the browser plugin. */
		const inject = ["slots", "locale"];
		/** Register dictionaries and the settings page. */
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "skill-gate: dictionaries");
			const t = ctx.locale.bind(NS);
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "skill-gate",
				order: 80,
				locale: NS,
				label: () => t("title"),
				inject: () => ({
					load: loadSnapshot,
					save: saveBindings,
					importLegacy: importLegacyBindings
				})
			}, SkillGateSection));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map