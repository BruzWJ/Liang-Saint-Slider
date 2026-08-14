import { apply, name, inject } from "/home/goose/dsh-plugin-liang-calibrator/lib/index.js";

const registered = [];
const ctx = {
  webServer: {
    register(route) {
      registered.push(route);
    },
  },
};

apply(ctx);

if (registered.length !== 1) throw new Error("expected one route registration");
const route = registered[0];
if (route.kind !== "prefix" || route.path !== "/liang-assets") throw new Error(`bad route: ${JSON.stringify(route)}`);

function mockRes() {
  const res = { status: 0, headers: {}, body: null };
  res.writeHead = (code, headers) => {
    res.status = code;
    Object.assign(res.headers, headers ?? {});
  };
  res.end = (body) => {
    res.body = body;
  };
  return res;
}

async function hit(url, method = "GET") {
  const res = mockRes();
  await route.handler({ method, url }, res);
  return res;
}

// 1) real frame
const ok = await hit("/liang-assets/frames/frame-15.webp");
if (ok.status !== 200) throw new Error(`frame status ${ok.status}`);
if (ok.headers["content-type"] !== "image/webp") throw new Error(`frame mime ${ok.headers["content-type"]}`);
if (!ok.body || ok.body.length < 1000) throw new Error(`frame body too small: ${ok.body?.length}`);
console.log("frame 200:", ok.headers["content-type"], ok.body.length, "bytes");

// 2) traversal blocked
const trav = await hit("/liang-assets/../../package.json");
if (trav.status !== 403) throw new Error(`traversal status ${trav.status}`);
console.log("traversal:", trav.status);

// 3) missing file
const miss = await hit("/liang-assets/frames/frame-99.webp");
if (miss.status !== 404) throw new Error(`missing status ${miss.status}`);
console.log("missing:", miss.status);

// 4) method guard
const bad = await hit("/liang-assets/frames/frame-00.webp", "POST");
if (bad.status !== 405) throw new Error(`method status ${bad.status}`);
console.log("method:", bad.status);

console.log("host half OK — name:", name, "inject:", inject.join(","));
