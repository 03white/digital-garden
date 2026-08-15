# Digital Garden

涓€涓熀浜?Astro 鐨?GitHub Pages 闈欐€佸崥瀹?/ 鏁板瓧鑺卞洯椤圭洰銆?
## 鎶€鏈爤

- Astro锛氶潤鎬佺珯鐐规鏋躲€?- Markdown / MDX锛氬唴瀹瑰啓浣滄牸寮忋€?- Astro Content Collections锛氭枃绔犲拰绗旇鍏冩暟鎹害鏉熴€?- GitHub Actions + GitHub Pages锛氳嚜鍔ㄦ瀯寤哄拰閮ㄧ讲銆?
## 鏈湴寮€鍙?
鍏堝畨瑁呬緷璧栵細

```bash
npm install
```

鍚姩寮€鍙戞湇鍔★細

```bash
npm run dev
```

鐢变簬褰撳墠榛樿鎸?GitHub Pages 椤圭洰椤甸厤缃簡 `base: /digital-garden`锛屾湰鍦拌闂矾寰勯€氬父鏄細

```text
http://localhost:4321/digital-garden/
```

鏋勫缓鐢熶骇鐗堟湰锛?
```bash
npm run build
```

棰勮鏋勫缓缁撴灉锛?
```bash
npm run preview
```

## 鍐欐枃绔?
鍦?`src/content/posts` 涓柊澧?Markdown 鏂囦欢锛屼緥濡傦細

```md
---
title: 鏂版枃绔犳爣棰?description: 鏂囩珷鎽樿銆?pubDate: 2026-08-15
tags: [astro, blog]
draft: false
---

杩欓噷鏄鏂囥€?```

鏂囩珷浼氱敓鎴愬埌 `/posts/<鏂囦欢鍚?/`銆?
## 鍐欑瑪璁?
鍦?`src/content/notes` 涓柊澧?Markdown 鏂囦欢锛屼緥濡傦細

```md
---
title: 鏂扮瑪璁版爣棰?description: 绗旇鎽樿銆?createdDate: 2026-08-15
updatedDate: 2026-08-15
tags: [digital-garden]
status: seedling
draft: false
---

杩欓噷鏄瑪璁版鏂囥€?```

绗旇鐘舵€佸彲閫夛細

- `seedling`锛氱瀛愩€?- `growing`锛氱敓闀夸腑銆?- `evergreen`锛氬父闈掋€?
绗旇浼氱敓鎴愬埌 `/notes/<鏂囦欢鍚?/`銆?
## GitHub Pages 閰嶇疆

褰撳墠 `astro.config.mjs` 榛樿閫傞厤浠撳簱鍚嶄负 `digital-garden` 鐨?GitHub Pages 椤圭洰椤碉細

```js
export default defineConfig({
  site: process.env.SITE ?? 'https://03white.github.io',
  base: process.env.BASE_PATH ?? '/digital-garden',
});
```

閮ㄧ讲鍓嶅缓璁妸 `SITE` 璁剧疆涓轰綘鐨勫疄闄?GitHub Pages 鍦板潃锛屾垨鐩存帴淇敼 `astro.config.mjs`銆?
濡傛灉浠撳簱鏄櫘閫氶」鐩〉锛屽湴鍧€閫氬父鏄細

```text
https://03white.github.io/digital-garden/
```

濡傛灉浠撳簱鏄敤鎴蜂富椤典粨搴?`<username>.github.io`锛岄€氬父闇€瑕佺Щ闄?`base` 閰嶇疆銆?
## 鑷姩閮ㄧ讲

`.github/workflows/deploy.yml` 浼氬湪鎺ㄩ€佸埌 `main` 鍒嗘敮鏃惰嚜鍔ㄦ瀯寤哄苟閮ㄧ讲鍒?GitHub Pages銆?
浣犺繕闇€瑕佸湪 GitHub 浠撳簱涓繘鍏ワ細

```text
Settings 鈫?Pages 鈫?Build and deployment 鈫?Source 鈫?GitHub Actions
```

## 椤圭洰鏂囨。

- `涓€鑸渶姹傚垎鏋?md`
- `璇︾粏璁捐.md`
