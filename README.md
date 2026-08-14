# dsh-plugin-liang-calibrator

**滑动变祖器** — the [liang-intensity-calibrator](https://github.com/Lichtspektrum/liang-intensity-calibrator) as the DeepSeek Harness **model + thinking-effort selector**.

[![Preview](https://pbs.twimg.com/amplify_video_thumb/2087967285621542912/img/Vk2-2wdcV3s2ITIO.jpg)](https://x.com/BruzWJ/status/2087968145114120691)


Clicking the composer's model seat opens the 31-level calibrator directly. The six
stages map 1:1 onto the DeepSeek model catalog's combinations (2 models × 3
thinking levels = 6 = the six stages):

| Stage | Position | Model · Thinking level |
| --- | --- | --- |
| 小难梁 | 00 | DeepSeek-V4-Flash · Off |
| 牢梁 | 06 | DeepSeek-V4-Flash · High |
| 梁子 | 12 | DeepSeek-V4-Flash · Max |
| 梁圣 | 18 | DeepSeek-V4-Pro · Off |
| 梁神 | 24 | DeepSeek-V4-Pro · High |
| 梁祖 | 30 | DeepSeek-V4-Pro · Max |

With any other catalog the slider splits the 0–30 track proportionally across
every provider/model/effort combination, and the stage follows the selected
combo. A small **Model** row beneath the slider still drills into the plain
model list.

## Install

```sh
dsh plugin --profile web add dsh-plugin-liang-calibrator
```

then register the entry in your profile's `cordis.patch.yml`
(`$DSH_HOME/profiles/web/cordis.patch.yml`):

```yaml
- insert:
    - id: liang-calibrator
      name: dsh-plugin-liang-calibrator
```

and restart `dsh web`.

## How it works

- **Host half** (`lib/index.js`): serves the 31 portrait keyframes under
  `/liang-assets/frames/` through the profile's `webServer` service — no CDN,
  no patched static server.
- **Browser half** (`lib/client.js`): a standard `dsh.client` bundle that
  registers the `conversation.input.model` slot at **priority −1**. Slot
  rendering is priority-based ("lowest renders"), so the calibrator shadows the
  stock selector without touching it — uninstalling the plugin restores the
  original UI.
- The portrait is drawn from per-level keyframes rather than a scrubbed video:
  the stock static server has no HTTP Range support, so media-element seeking
  silently fails; image keyframes work everywhere.
- Requires `@deepseek-ai/dsh-client-ui-model-selection` (ships with the default
  web profile) for the shared model directory service.

## Uninstall

```sh
dsh plugin --profile web remove dsh-plugin-liang-calibrator
```

(and drop the entry from `cordis.patch.yml`).

## Development

Regenerate the browser bundle from an installed DSH checkout:

```sh
python3 scripts/assemble-client.py /path/to/node_modules/@deepseek-ai [region.js]
```

## Portraits

`lib/assets/frames/frame-00.webp … frame-30.webp` derive from the
[liang-intensity-calibrator](https://github.com/Lichtspektrum/liang-intensity-calibrator)
project's `public/frames`. Reuse or redistribution requires confirming you hold
the relevant portrait and asset rights (see that project's README).

## License

MIT. The calibrator concept and portrait assets belong to their original
authors — see above.
