# Personal Finance Dashboard V3

繁體中文、免費、免登入的個人財務儀表板。保留 Light / Dark、localStorage、財務摘要 PNG、快照趨勢、壓力測試與 JSON 備份；新增首次導引、三步驟設定、現金分類、多筆負債、投資配置與新資金再平衡。

**所有財務資料僅儲存在此裝置瀏覽器，不會上傳至伺服器。**

清除瀏覽器資料、更換裝置或使用無痕模式可能造成資料遺失，建議定期匯出備份。沒有帳號、資料庫、第三方追蹤、分析或外部 API。程式使用 CSP `connect-src 'none'` 與 `form-action 'none'`，僅載入本地靜態資源。

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

主要檔案：`index.html`、`style.css`、`app.js`、`v3-core.js`、`summary.js`。改動後重新產生單檔版：

```sh
python scripts/build-single.py
node tests/core.cjs
node tests/browser.cjs
node tests/summary.cjs
node tests/appearance.cjs
```

瀏覽器測試需要開發機安裝 Playwright 與 Chromium；使用者直接開網頁不需要安裝。可用 `CHROMIUM_PATH` 指定瀏覽器。測試涵蓋 Desktop Chromium 與 Android Chrome 模擬，非實體手機。

## GitHub Pages

GitHub **Settings → Pages → Deploy from a branch → main → /(root) → Save**。`.nojekyll` 允許直接部署靜態檔。等待部署完成後開啟 Pages 提供的網址。請勿把財務 JSON 備份提交到公開儲存庫。
