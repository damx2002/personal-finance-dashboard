# Personal Finance Dashboard V5

繁體中文、免費、免登入的家庭財務儀表板。保留所有財務計算、財務決策實驗室、Light / Dark、localStorage、PNG、快照、壓力測試、JSON 備份與 PWA 離線能力。V5 整理首頁閱讀動線、共用 KPI 詳情、手機排版與可及性，不新增財務功能或資料欄位。

**所有財務資料僅儲存在此裝置瀏覽器，不會上傳至伺服器。**

清除瀏覽器資料、更換裝置或使用無痕模式可能造成資料遺失，建議定期匯出備份。沒有帳號、資料庫、第三方追蹤、分析或外部 API。程式使用 CSP `connect-src 'none'` 與 `form-action 'none'`，僅載入本地靜態資源。

[V5 視覺層級、共用 KPI 詳情與驗收說明](V5.md)

[V4.1.2 輸入指引、個人警戒換算與決策比較](V4.1.2.md)

[V4.1.1 邏輯精煉、分析狀態與再平衡修正](V4.1.1.md)

[V4.1 目標基準與 KPI 組成修正](GOAL-BASIS.md)

[V4.1 財務解讀、每日重置壓力模型、AI 隱私文字與驗收說明](V4.1.md)

[V4 決策實驗室、公式、情境儲存、PWA 與驗收說明](V4.md)

[V3 功能、schema、migration、公式與手動驗收說明](V3.md)

## 開啟

建議用固定 HTTPS 網址：<https://damx2002.github.io/personal-finance-dashboard/>。下載時可直接開啟完整單檔 `dashboard.html`；但 `file://` 的保存行為依瀏覽器而異，建議固定網址並備份。

開發環境：

```sh
python -m http.server 8000 --bind 0.0.0.0
```

在自己的電腦開啟 `http://localhost:8000`，不需要安裝應用依賴或建置。金額欄位輸入時即時顯示千分位，並提供萬／億元提示；數據仍保存為純數字。

## 升級注意

V3 會自動讀取既有 V2 / V1，驗證後寫入新的 `personal-finance-dashboard.v3`，保留原始舊紀錄。不要清除瀏覽器資料以更新網站；建議更新前先匯出備份。不同 origin、瀏覽器、設定檔及裝置不共享資料，搬移請用 JSON。

同一台共用電腦，請各自使用不同瀏覽器使用者設定檔。未填利率時不猜測，只顯示補填提示。預設沒有任何目標資產比例。

## 維護

V4.1 新增 `stress-core.js` 與 `health-analysis.js`，供 Dashboard、情境實驗室和摘要圖共用。正式財務 schema 維持 V3，壓力偏好使用獨立 key，無需 migration。

主要檔案：`index.html`、`style.css`、`app.js`、`v3-core.js`、`summary.js`。V5 的顯示互動集中在 `dashboard-ui.js`，不寫入正式資料。改動後重新產生單檔版：

```sh
python scripts/build-single.py
node tests/core.cjs
node tests/browser.cjs
node tests/summary.cjs
node tests/summary-copy.cjs
node tests/appearance.cjs
node tests/dashboard-ui.cjs
node tests/scenario-core.cjs
node tests/scenario-browser.cjs
node tests/pwa.cjs
node tests/pwa-install.cjs
node tests/stress-core.cjs
node tests/health-analysis.cjs
node tests/insight-browser.cjs
node tests/goal-basis.cjs
node tests/goal-basis-browser.cjs
node tests/refinements.cjs
node tests/refinements-browser.cjs
node tests/decision-core.cjs
node tests/guidance-browser.cjs
node tests/filling-guide.cjs
```

瀏覽器測試需要開發機安裝 Playwright 與 Chromium；使用者直接開網頁不需要安裝。可用 `CHROMIUM_PATH` 指定瀏覽器。測試涵蓋 Desktop Chromium 與 Android Chrome 模擬，非實體手機。

## GitHub Pages

GitHub **Settings → Pages → Deploy from a branch → main → /(root) → Save**。`.nojekyll` 允許直接部署靜態檔。等待部署完成後開啟 Pages 提供的網址。請勿把財務 JSON 備份提交到公開儲存庫。

## V4 使用提醒

正式財務仍是 V3 格式，沒有 V4 財務 schema migration。情境存於獨立 `personal-finance-dashboard.scenarios.v4`，最多20筆，只存動作，不存基準。試算沒有套用正式資料的功能。JSON 備份可選擇包含情境。

PWA 首次須連線並等離線資源準備完成，再用 Android Chrome 安裝／新增到主畫面。快取只有靜態程式，財務資料仍在 localStorage。新版本等待使用者按「重新載入更新」，不會在輸入中自動重載。每次修改靜態檔都必須執行 `python scripts/build-single.py`，同步單檔版與 service worker 內容版本。

iPhone／iPad 加入主畫面：用 Safari 開啟網站，點「分享」→「加入主畫面」→「新增」。網站的「安裝／新增到主畫面」會在按鈕下方顯示步驟；iOS 不會由網站按鈕直接跳出安裝視窗。已從主畫面開啟時則提示無需重複新增。

財務摘要 PNG：維持 1080 × 1350，六張核心卡片加次要資訊、目標與市場壓力摘要。完整版呈現金額與相對衝擊；隱藏金額版只呈現比例、月份、倍數與目標時間。歷史快照缺少的欄位仍標示「未記錄」，不套用目前財務設定。所有圖片均在瀏覽器 Canvas 本機產生。

摘要圖精簡：Header 保留標題與日期，分享版另標示金額已隱藏；目標時間集中於目標區。分享版前兩張核心卡為「負債 / 資產」「固定投資前餘裕」，平均月收入不大於 0 時餘裕率顯示「—」。完整版壓力卡金額加註「淨資產」，分享版維持純百分比。
