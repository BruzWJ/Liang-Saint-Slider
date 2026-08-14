#!/usr/bin/env python3
"""Assemble lib/client.js for dsh-plugin-liang-calibrator.

Ports the verified liang slider + model-select UI from a DSH installation's
compiled `dsh-client-ui-model-selection` bundle into a self-contained client
plugin: the ported component shadows the built-in `conversation.input.model`
slot (priority -1, lowest renders), keeps the plain Model list pane, and draws
the portrait from keyframes served by the host half under `/liang-assets/`.

Usage: python3 scripts/assemble-client.py <dsh-node-modules> [region.js]

The DSH checkout must already carry the liang region (patched bundle) or you
can point `region.js` at the standalone copy of the injected region.
"""
import re
import sys
from pathlib import Path

DSH_MODULES = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(
    "/home/goose/.npm/_npx/1e7f6d9597241db0/node_modules/@deepseek-ai")
REGION_JS = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(
    "/home/goose/dsh-liang-integration/region.js")

BUNDLE = DSH_MODULES / "dsh-client-ui-model-selection/lib/client.js"
OUT = Path(__file__).resolve().parent.parent / "lib/client.js"

src = BUNDLE.read_text(encoding="utf-8")

def cut(start_marker: str, end_marker: str) -> str:
    start = src.index(start_marker) + len(start_marker)
    end = src.index(end_marker)
    return src[start:end]

# --- liang region (helpers + keyframe slider) ------------------------------
liang = REGION_JS.read_text(encoding="utf-8")
liang = liang.replace('const LIANG_FRAME_BASE = "/assets/liang/frames/";',
                      'const LIANG_FRAME_BASE = "/liang-assets/frames/";')
# the menu max-height override moves to the ported menu class below
liang = liang.replace("._7KE1Ra_menu{max-height:min(420px,100vh - 96px)}", "")
assert "dsh-liang" in liang and "/liang-assets/frames/" in liang

# --- ModelSelect region, renamed -------------------------------------------
modelselect = cut("//#region lib/types/client/ModelSelect.js",
                  "//#region lib/types/client/locales.js")
modelselect = modelselect.replace("ModelSelect_module_css_default.", "liang_css.")
modelselect = modelselect.replace("function ModelSelect({", "function LiangModelSelect({")
assert "LiangModelSelect" in modelselect and "liang_css.root" in modelselect

# --- locale dictionaries ----------------------------------------------------
locales = cut("//#region lib/types/client/locales.js",
              "//#region lib/types/client/index.js")
zh = re.search(r"const zh = \{(.*?)\n\t\t\};", locales, re.S).group(0)
en = re.search(r"const en = \{(.*?)\n\t\t\};", locales, re.S).group(0)

# --- ported menu CSS (hash-prefixed module class -> stable dsh-lm-*) -------
css = re.search(r'const css = "([^"]*)";', src).group(1)
css = css.replace("._7KE1Ra_", ".dsh-lm-")
css += " .dsh-lm-menu{max-height:min(420px,100vh - 96px)}"

# --- bundled clsx helper ----------------------------------------------------
clsx = re.search(r"function r\(e\) \{.*?\n\t\t\}", src, re.S).group(0)
clsx += "\n" + re.search(r"function clsx\(\) \{.*?\n\t\t\}", src, re.S).group(0)

HEADER = """window.__ModuleLoader__.load({
	id: "dsh-plugin-liang-calibrator",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
"""

CSS_BLOCK = f"""
		const liang_menu_css = "{css}";
		if (typeof document !== "undefined") {{
			for (const stale of document.querySelectorAll("style[data-plugin-css=\\"dsh-plugin-liang-calibrator/menu\\"]")) stale.remove();
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-plugin-liang-calibrator";
			tag.dataset.pluginCss = "dsh-plugin-liang-calibrator/menu";
			tag.textContent = liang_menu_css;
			document.head.appendChild(tag);
		}}
		const liang_css = {{
"""

CSS_MAP = "".join(f'\t\t\t"{name}": "dsh-lm-{name}",\n' for name in [
    "root", "trigger", "triggerLabel", "triggerEffort", "chevron", "chevronOpen",
    "menu", "status", "empty", "error", "warning", "retry", "groups", "group",
    "groupTitle", "option", "optionCopy", "modelName", "description", "check",
    "selected", "cell", "cellLabel", "cellValue", "cellChevron",
]) + "\t\t};"

FOOTER = """
		/** Dictionary namespace owned by this plugin. */
		const NS = "liang";
		/** Required services: locale, the slot registry, sessions, and the shared model directory. */
		const inject = ["locale", "slots", "sessions", "modelDirectories"];
		/**
		* Client plugin body: register the dictionaries, then shadow the built-in
		* `conversation.input.model` seat with the liang calibrator. The shadow
		* wins by priority: the slot renders the LOWEST priority registration,
		* and the built-in registers at the default 0, so -1 replaces it while
		* the original registration stays intact (dispose my plugin to restore
		* the stock selector).
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "liang-calibrator: dictionaries");
			ctx.inject(["slots", "modelDirectories"], (scope) => {
				const models = scope.modelDirectories;
				const sessions = scope.sessions;
				scope.slots.inject("conversation.input.model", () => scope.slots.register({
					name: "conversation.input.model",
					locale: NS,
					priority: -1,
					registrant: "liang-calibrator",
					inject: (sessionId) => {
						const directory = models.directoryFor(sessionId);
						const available = sessions.subagentAddress(sessionId) === void 0;
						return {
							available,
							directory: directory.store,
							load: () => {
								if (available) directory.load().catch(() => {});
							},
							select: (selection) => available ? directory.select(selection).then(() => true, () => false) : Promise.resolve(false)
						};
					}
				}, LiangModelSelect));
			});
		}
		exports.name = "liang-calibrator";
		exports.inject = inject;
		exports.apply = apply;
		exports.LiangModelSelect = LiangModelSelect;
		exports.LiangEffortSlider = LiangEffortSlider;
		return module.exports;
	}
});
"""

out = (
    HEADER
    + clsx + "\n"
    + CSS_BLOCK + CSS_MAP
    + liang + "\n"
    + modelselect + "\n"
    + zh + "\n" + en + "\n"
    + FOOTER
)
OUT.write_text(out, encoding="utf-8")
print(f"wrote {OUT} ({len(out)} bytes)")
