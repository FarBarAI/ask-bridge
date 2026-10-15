# 維護狀態

更新日期：2026-10-15。這份紀錄保存來源、必要修正及驗證限制；每次維護完成後更新。實際 Git 狀態與本機部署另行查證。

## 2026-10-15 官方更新整合（本機）

- 實際官方 `main`：`5f83bf904b594050b706a6201fd0a3e8f893b7fa`，包含 6 個新提交；最新正式版本為 `0.3.1`，標籤所指提交為 `d890fe75ca0b4cc94d7d2220e07450971aff01b6`。
- 組織修正基底：`a841ba35e58dcb52963507caa3be8a99c476a847`。整合分支：`codex/merge-upstream-20261015`；使用者已明確授權建立本機 merge commit 並將 `codex/local-fixes` 更新到相同結果，不推送遠端。
- 本次以官方 URL fetch 至 `refs/remotes/upstream/main`；目前只有已設定的 `origin` 遠端，沒有新增或改寫 remote 設定。
- 整合先在獨立工作目錄執行 `git merge --no-commit --no-ff upstream/main`，解決 6 個檔案的衝突並驗證，再建立本機合併提交；原分支以 `git merge --ff-only codex/merge-upstream-20261015` 採用同一結果。此整合提交的第一個 parent 是組織修正基底，第二個 parent 是官方 `main`，保留雙方歷史。
- 採用官方新版輸入框、登入辨識、Chat 模式切換、`xhigh`、圖片回覆與 CodeMirror 程式碼換行修復，以及官方版本／發布工具更新。發布腳本仍指向原作者及原 npm 套件，本次不執行。
- 官方依選項名稱操作推理滑桿的方式取代 fork 的固定位置表；保留 Pro 預設、舊選單入口備援、重開選單確認與不可用時停止。
- 回覆部分保留 fork 的單一回答身分、URL、完成訊號、實際逾時預算、partial 檔與非零失敗狀態。官方圖片容器、`in_progress` 及 CodeMirror 支援移入 `response-dom.cjs`；程式碼修補同樣核對回答身分，排除思考摘要。
- 保留 `chrome-devtools-mcp ^1.10.1` 的 npm 依賴與 fork 的完整 Node 測試入口；同步 `package-lock.json` 的專案版本為 `0.3.1`。Rust 執行時仍使用專用 Chrome `9223` 與 `chrome-devtools-mcp@1.7.0`，未更換控制媒介。
- 本次本地驗證：116 個 Rust 測試、45 個 Node 測試、`cargo fmt --all -- --check`、全 targets Clippy（warnings 為錯誤）及兩個 CLI 的 debug 建置通過；`ask-bridge --version`／`--help` 確認 `0.3.1`、`xhigh` 及 Pro 預設。新增發布工具僅做 Node 語法檢查，安裝 shell 腳本僅做語法檢查。
- 未做網站問答、原對話取回、搜尋、長篇完成辨識、真實圖片下載、Windows／WSL、遠端 CI 或發布驗證。前次長篇完成訊號缺失仍屬開放限制。
- 原 checkout 的原始碼更新至整合結果；現用執行檔與外部操作 skill 未切換。本次環境的 PATH 找不到 `ask-bridge`／`ask`，也沒有下方歷史部署紀錄的位置，不能把歷史執行檔描述成目前使用版本。
- 驗證日誌存於整合工作目錄的忽略目錄 `target/upstream-integration/`。回退基準是上述組織修正基底；需要比較舊版時另開 checkout，不直接重設共享分支。本次未推送、發版或部署。

## 來源與分支

- 官方來源：<https://github.com/doggy8088/ask-bridge>。
- 組織儲存庫：<https://github.com/FarBarAI/ask-bridge>，公開 GitHub Fork，parent 為 `doggy8088/ask-bridge`。
- `origin` 指向 `https://github.com/FarBarAI/ask-bridge.git`；官方來源與候選的實際取得方式見上方更新紀錄。
- 目前本機整合的官方基底：`5f83bf904b594050b706a6201fd0a3e8f893b7fa`，版本 `0.3.1`；原官方基底 `477c15455da421fb626dc352ce9b59e32f2a839d`（`0.2.13`）保留於歷史。
- 已保存的套件調整：`e7c195d`；已保存的程式修正：`5b6c42d`。
- Pro 預設與現行效能滑桿：`c249810`；最終回答範圍：`1ef35ef`。
- 官方來源分支：`main`。組織修正及組織預設分支：`codex/local-fixes`。
- 建立副本時先保存現有修改，不在同一工作中默默升級至最新 upstream。

## 個人修正清單

| 修正 | 位置 | 保留原因與官方更新時的檢查 |
|---|---|---|
| 輸入框與頁面就緒辨識 | `src/main.rs` | 舊輸入框結構可能已改變；核對實際送出與登入狀態 |
| 回覆定位與擷取 | `src/response-dom.cjs`、`src/main.rs` | 支援新舊回答結構、去重、綁定對話與回答、工具列複製及 Markdown 擷取 |
| ChatGPT 預設 Pro | `src/main.rs`、`src/model-selection.cjs` | 未明確指定推理等級的普通提問先選網頁 Pro；現行五段滑桿會重開確認，選不到時送出前停止 |
| 最終回答邊界 | `src/response-dom.cjs`、`tests/response-dom.test.cjs` | 排除明確標記的思考摘要及其複製按鈕；無法辨識最終回答時停止擷取 |
| 回覆追蹤與完成判斷 | `src/response.rs` | 追蹤本次回答、內容穩定與正面完成訊號；保留仍有未知完成控制項的限制 |
| 逾時與 get | `src/main.rs` | 依實際時間等待、有限最後檢查、從原對話取回、不重送 |
| 部分結果與錯誤狀態 | `src/main.rs` | 部分回答另存、不覆蓋完整檔；逾時、擷取與指定輸出失敗為非零狀態 |
| 網頁結構驗證案例 | `tests/response-dom.test.cjs`、Rust 單元案例 | 檢查新舊結構、語系、串流、頁面切換與舊回答誤判 |
| 操作指引與使用說明 | `skills/ask-bridge/SKILL.md`、`README.md` | 區分送出與取回、避免重送與多 session 競爭，說明輸出狀態 |
| 既有 npm 調整 | `package.json`、`package-lock.json` | 保留使用者安裝的 `chrome-devtools-mcp ^1.10.1`；這不會更改 Rust 內的執行規格 |

## 驗證證據及已知限制

2026-09-27 的前一輪驗證紀錄：106 個 Rust 測試、27 個 Node 測試通過；fmt 與 Clippy 通過。ChatGPT 短答、搜尋、既有回答取回，以及 Gemini 新問答成功；短逾時和寫入失敗回傳 `1`，完整檔保留。

同日稍後的長篇 Fork 說明請求：網站已有回答，CLI 偵測 `generating=false`，但 `completion_signal=false`。等待 300 秒後與一次 `get` 均回傳 `1`，文字存為 partial。**這是尚未修復的完成辨識問題**，不得用先前成功案例或測試數宣稱全面修復。

2026-09-28：Rust 106 個測試、Node 33 個測試、Clippy、格式檢查與 skill 結構檢查通過。現行 ChatGPT 五段效能滑桿可由「即時」移到「Pro」；候選 CLI 未指定模型或推理旗標時，確認 Pro 後才送出一次短題，狀態 `0`、輸出僅有驗證字串。對該對話的安靜模式 `get` 也回傳 `0`，stdout 是回答加對話連結，Markdown 檔只有回答。這是短答及當前 UI 的證據；長篇完成辨識限制仍需另行修正。

對比官方基底及本次差異，瀏覽器控制仍由專用 Chrome 的 `9223` 埠與 `chrome-devtools-mcp@1.7.0` 執行；本次修改沒有換控制媒介。先前修正曾改動 MCP 呼叫的逾時與重設流程，不可稱所有 DevTools 相關程式碼完全沒有變動。CLI 將回答送到本次呼叫程序；共用 Chrome profile 並非其他程序無法看見網站對話的隔離機制。詳細原則見 `../../ask-bridge-session-contract/SKILL.md`。

Claude 因未登入，只完成離線結構案例；完整生成圖片下載尚未實測。此 skill 的建立與保存工作不等同於新增功能修正或重新通過上述測試。

## 本機部署（2026-09-28 歷史紀錄）

舊執行檔保留於 `~/.local/share/ask-bridge/releases/20260928-001647-5b6c42d-1e69c1979ddb/ask-bridge`，可用作回復點。全域 `~/.local/bin/ask-bridge` 經 `~/.local/share/ask-bridge/current/ask-bridge`，目前連到 `~/.local/share/ask-bridge/releases/20260928-160315-1ef35ef-52ac8bdd8e11/ask-bridge`；`ask` alias 經同一命令。

舊版保存時原始碼 commit 為 `5b6c42de59eb665252f73a5513850bd214f8a83d`、執行檔 SHA-256 為 `1e69c1979ddbaa123e37da71fa75430b8ef8ef736e494f23f251c8c1d6d26690`；這不宣稱是舊檔的可重現建置證明。目前使用的候選版從 `1ef35efc051a44f7cccfaa76ab45b78fae592cfc` 來源建置，SHA-256 為 `52ac8bdd8e1163cd14299d6aa46e23043221d630adf8ee0223d108083964d424`。版本號仍是 `0.2.13`，以來源 commit 和雜湊區分自訂版本。

`~/.local/share/ask-bridge/deployment.json` 是本機部署紀錄，包含目前及前一版位置、雜湊與操作 skill 備份。全域操作 skill 已同步到專案版本，舊版仍在原快照。下次候選建置使用 `target/candidate` 或獨立 checkout，不直接替換 current。

本機部署紀錄、執行檔、全域 skill 備份及瀏覽器輸出不納入 Git。維護時查本機命令的實際連結；本機環境與這份公開來源紀錄分開保存。

官方安裝、npm wrapper 與更新器仍含原作者下載來源。建立 Fork 不會讓它們自動改用 FarBarAI。未建立組織發布流程前，不把官方安裝指令當作這份修正版的安裝方式。
