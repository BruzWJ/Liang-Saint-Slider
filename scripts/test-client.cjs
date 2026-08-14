const { chromium } = require("playwright-core");
const fs = require("fs");

(async () => {
  const PLUGIN = "/home/goose/dsh-plugin-liang-calibrator";
  const clientSrc = fs.readFileSync(`${PLUGIN}/lib/client.js`, "utf8");

  const browser = await chromium.launch({
    executablePath: "/home/goose/.agent-browser/browsers/chrome-147.0.7727.57/chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));

  // Serve the plugin's keyframes at their published URLs
  let frameHits = 0;
  await page.route("**/liang-assets/frames/*.webp", async (route) => {
    frameHits += 1;
    const name = route.request().url().split("/").pop();
    await route.fulfill({
      status: 200,
      contentType: "image/webp",
      body: fs.readFileSync(`${PLUGIN}/lib/assets/frames/${name}`),
    });
  });

  await page.goto("http://127.0.0.1:3080", { waitUntil: "networkidle", timeout: 30000 });

  // 1) register the client factory with the live module system
  await page.evaluate((src) => {
    (0, eval)(src);
    return window.__DSH_MODULES__ !== undefined;
  }, clientSrc);

  // 2) materialize, apply with a fake ctx, capture the slot registration
  const captured = await page.evaluate(async () => {
    const loader = window.__DSH_MODULES__;
    const mod = loader.materialize("dsh-plugin-liang-calibrator");
    const React = await loader.import("react");
    const ReactDOMClient = await loader.import("react-dom/client");
    const exportsObj = mod.exports;

    // ---- fake services ----
    const zh = {
      "trigger.fallback": "选择模型", "trigger.selectAria": "选择模型",
      "trigger.aria": "选择模型，当前 {model}",
      "trigger.ariaEffort": "选择模型，当前 {model}，推理等级 {effort}",
      "menu.aria": "模型与梁系校准", "menu.model": "模型",
      "effort.providerDefault": "Default", "status.loading": "正在刷新模型列表…",
      "error.action": "模型操作失败：{message}", "retry": "重试",
      "warning.groupLoad": "{name} 加载失败：{message}", "empty.models": "没有可用的模型。",
    };
    const t = (key, params) => {
      let text = zh[key] ?? key;
      if (params) text = text.replace(/\{(\w+)\}/g, (_, k) => String(params[k]));
      return text;
    };
    const efforts = [
      { id: "off", name: "Off" }, { id: "high", name: "High" }, { id: "max", name: "Max" },
    ];
    const store = (() => {
      let state = {
        current: { provider: "deepseek-official", model: "deepseek-v4-pro", reasoningEffort: "max" },
        routable: null,
        groups: [{
          id: "deepseek-official",
          name: "DeepSeek",
          models: [
            { id: "deepseek-v4-flash", name: "DeepSeek-V4-Flash", reasoning: { efforts, defaultEffort: "high" } },
            { id: "deepseek-v4-pro", name: "DeepSeek-V4-Pro", reasoning: { efforts, defaultEffort: "high" } },
          ],
        }],
        failures: [], status: "ready", error: null,
      };
      const subs = new Set();
      return {
        subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
        getSnapshot() { return state; },
        update(fn) { state = fn({ ...state }); for (const s of subs) s(); },
      };
    })();
    const calls = [];
    const directory = {
      store,
      load: async () => {},
      select: async (selection) => {
        calls.push(selection);
        store.update((s) => ({ ...s, status: "selecting" }));
        await new Promise((r) => setTimeout(r, 120));
        store.update((s) => ({
          ...s,
          current: {
            provider: selection.provider,
            model: selection.model,
            ...(selection.reasoningEffort !== undefined ? { reasoningEffort: selection.reasoningEffort } : {}),
          },
          status: "ready",
        }));
        return true;
      },
    };
    const slotCapture = { options: null, component: null };
    const ctx = {
      effect(fn) { fn(); },
      locale: { register: (ns, dict) => { slotCapture.dicts = { ns, dict }; } },
      inject(deps, cb) {
        cb({
          slots: {
            inject(name, factory) {
              slotCapture.name = name;
              const result = factory();
              slotCapture.options = result.options;
              slotCapture.component = result.component;
              return result;
            },
            register(options, component) { return { options, component }; },
          },
          modelDirectories: { directoryFor: () => directory },
          sessions: { subagentAddress: () => undefined },
        });
      },
    };
    exportsObj.apply(ctx);

    // ---- mount the captured component with the injected face ----
    const container = document.createElement("div");
    container.id = "liang-test-mount";
    document.body.appendChild(container);
    const injected = slotCapture.options.inject("test-session");
    const element = React.createElement(slotCapture.component, {
      locked: false,
      ...injected,
      t,
    });
    ReactDOMClient.createRoot(container).render(element);
    window.__LIANG_TEST__ = { calls, store };
    return {
      name: slotCapture.name,
      options: { ...slotCapture.options, inject: undefined },
      dicts: slotCapture.dicts,
    };
  });

  console.log("slot captured:", JSON.stringify({ name: captured.name, options: captured.options, dicts: captured.dicts?.ns }));

  // 3) drive the UI
  const trigger = page.locator("#liang-test-mount button[aria-haspopup='menu']");
  await trigger.waitFor({ state: "visible", timeout: 10000 });
  console.log("trigger:", (await trigger.textContent()).trim());

  await trigger.click();
  const slider = page.locator(".dsh-liang");
  await slider.waitFor({ state: "visible", timeout: 10000 });
  await page.waitForTimeout(1200);
  console.log("open:", await page.locator(".dsh-liang-stage").textContent(), "|", await page.locator(".dsh-liang-combo").textContent());

  // drag to far left -> Flash · Off
  const range = page.locator(".dsh-liang-range");
  let box = await range.boundingBox();
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width - 2, y);
  await page.mouse.down();
  await page.mouse.move(box.x + 2, y, { steps: 25 });
  await page.mouse.up();
  await page.waitForTimeout(1500);
  console.log("drag-left:", await page.locator(".dsh-liang-stage").textContent(), "|", await page.locator(".dsh-liang-combo").textContent(), "| open:", await slider.isVisible());

  // styles + canvas while the slider is open
  const style = await range.evaluate((el) => getComputedStyle(el).accentColor);
  const marker = await page.locator(".dsh-liang-marker.is-current").evaluate((el) => getComputedStyle(el).color);
  console.log("accent:", style, "| marker:", marker);

  // model list pane still reachable
  await page.getByRole("menuitem").filter({ hasText: /Model|模型/ }).first().click();
  await page.waitForTimeout(400);
  console.log("list radios:", await page.locator('[role="menuitemradio"]').count());
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  console.log("escape -> slider:", await slider.isVisible());
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  console.log("escape -> closed:", !(await slider.isVisible()));
  console.log("trigger now:", (await trigger.textContent()).trim());

  // commit calls
  const calls = await page.evaluate(() => window.__LIANG_TEST__.calls);
  console.log("select calls:", JSON.stringify(calls));
  const finalState = await page.evaluate(() => window.__LIANG_TEST__.store.getSnapshot().current);
  console.log("final current:", JSON.stringify(finalState));
  console.log("frame requests:", frameHits);
  console.log("page errors:", errs.slice(0, 6));

  await page.screenshot({ path: "/home/goose/dsh-plugin-liang-calibrator/screenshot-test.png" });
  await browser.close();
})().catch((e) => { console.error("VERIFY FAILED:", e); process.exit(1); });
