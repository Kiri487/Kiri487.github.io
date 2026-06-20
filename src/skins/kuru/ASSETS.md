# kuru skin — asset manifest

Hand-drawn artwork the `kuru` skin needs. Until a real file exists, the
code shows a labelled `<Placeholder>` box reserving the final layout size.

## Workflow

1. Draw the asset at (at least) the listed size, keeping the aspect ratio.
2. Save it into `src/skins/kuru/assets/` with the filename below.
3. Tell Claude — or swap the `<Placeholder>` for an `<img>` yourself.

## Hero section

### Required

| Slot           | Filename             | Size (px)                          | Format              | Notes |
|----------------|----------------------|------------------------------------|---------------------|-------|
| hero-character | `hero-character.png` | 460 × 600 (or larger, same ratio)  | PNG, transparent bg | Kiri 的龐克角色立繪。主視覺，可以誇張、超出邊框 |

### Optional — a CSS version already exists; draw only to replace it

| Slot     | Filename                | Size (px)    | Notes |
|----------|-------------------------|--------------|-------|
| hero-bg  | `hero-bg.png` / `.jpg`  | 1920 × 1080+ | 塗鴉牆背景。目前用 CSS 做暗底 + 噴漆光暈 + 格線 |
| kiri-tag | `kiri-tag.png` / `.svg` | 640 × 240    | 手繪 "Kiri" 塗鴉簽名，可取代目前用字體做的標題 |

---

About / Projects / Works / Credits 的素材，會在做那些 section 時往下補。
