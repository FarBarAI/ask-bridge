# 維護狀態

更新日期：2026-09-28。這份紀錄保存來源、必要修正及驗證限制；每次維護完成後更新。實際 Git 狀態與本機部署另行查證。

## 來源與分支

- 官方來源：<https://github.com/doggy8088/ask-bridge>。
- 組織儲存庫：<https://github.com/FarBarAI/ask-bridge>，公開 GitHub Fork，parent 為 `doggy8088/ask-bridge`。
- `origin` 指向 `https://github.com/FarBarAI/ask-bridge.git`，`upstream` 指向原作者；本機預設推送遠端為 origin。
- 本次保存的官方基底：`477c15455da421fb626dc352ce9b59e32f2a839d`，版本 `0.2.13`。
- 已保存的套件調整：`e7c195d`；已保存的程式修正：`5b6c42d`。
- 官方來源分支：`main`。組織修正及組織預設分支：`codex/local-fixes`。
- 建立副本時先保存現有修改，不在同一工作中默默升級至最新 upstream。

## 個人修正清單

| 修正 | 位置 | 保留原因與官方更新時的檢查 |
|---|---|---|
| 輸入框與頁面就緒辨識 | `src/main.rs` | 舊輸入框結構可能已改變；核對實際送出與登入狀態 |
| 回覆定位與擷取 | `src/response-dom.cjs`、`src/main.rs` | 支援新舊回答結構、去重、綁定對話與回答、工具列複製及 Markdown 擷取 |
| 回覆追蹤與完成判斷 | `src/response.rs` | 追蹤本次回答、內容穩定與正面完成訊號；保留仍有未知完成控制項的限制 |
| 逾時與 get | `src/main.rs` | 依實際時間等待、有限最後檢查、從原對話取回、不重送 |
| 部分結果與錯誤狀態 | `src/main.rs` | 部分回答另存、不覆蓋完整檔；逾時、擷取與指定輸出失敗為非零狀態 |
| 網頁結構驗證案例 | `tests/response-dom.test.cjs`、Rust 單元案例 | 檢查新舊結構、語系、串流、頁面切換與舊回答誤判 |
| 操作指引與使用說明 | `skills/ask-bridge/SKILL.md`、`README.md` | 區分送出與取回、避免重送與多 session 競爭，說明輸出狀態 |
| 既有 npm 調整 | `package.json`、`package-lock.json` | 保留使用者安裝的 `chrome-devtools-mcp ^1.10.1`；這不會更改 Rust 內的執行規格 |

## 驗證證據及已知限制

2026-09-27 的前一輪驗證紀錄：106 個 Rust 測試、27 個 Node 測試通過；fmt 與 Clippy 通過。ChatGPT 短答、搜尋、既有回答取回，以及 Gemini 新問答成功；短逾時和寫入失敗回傳 `1`，完整檔保留。

同日稍後的長篇 Fork 說明請求：網站已有回答，CLI 偵測 `generating=false`，但 `completion_signal=false`。等待 300 秒後與一次 `get` 均回傳 `1`，文字存為 partial。**這是尚未修復的完成辨識問題**，不得用先前成功案例或測試數宣稱全面修復。

Claude 因未登入，只完成離線結構案例；完整生成圖片下載尚未實測。此 skill 的建立與保存工作不等同於新增功能修正或重新通過上述測試。

## 本機部署

已將原有執行檔逐位元保存到 `~/.local/share/ask-bridge/releases/20260928-001647-5b6c42d-1e69c1979ddb/ask-bridge`，全域 `~/.local/bin/ask-bridge` 連到 `~/.local/share/ask-bridge/current/ask-bridge`。`ask` alias 繼續透過同一命令。

保存時原始碼 commit 為 `5b6c42de59eb665252f73a5513850bd214f8a83d`；既有執行檔未重新編譯，這個 commit 不宣稱是可重現的建置證明。執行檔 SHA-256 為 `1e69c1979ddbaa123e37da71fa75430b8ef8ef736e494f23f251c8c1d6d26690`，保存前後一致。

`~/.local/share/ask-bridge/deployment.json` 是本機部署紀錄，包含原命令連結、保存位置、雜湊及操作 skill 備份。操作 skill 已保存於同次快照中，全域指引本身未被替換。下次候選建置使用 `target/candidate` 或獨立 checkout，不直接替換 current。

本機部署紀錄、執行檔、全域 skill 備份及瀏覽器輸出不納入 Git。維護時查本機命令的實際連結；本機環境與這份公開來源紀錄分開保存。

官方安裝、npm wrapper 與更新器仍含原作者下載來源。建立 Fork 不會讓它們自動改用 FarBarAI。未建立組織發布流程前，不把官方安裝指令當作這份修正版的安裝方式。
