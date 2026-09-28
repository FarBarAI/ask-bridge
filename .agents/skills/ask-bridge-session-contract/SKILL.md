---
name: ask-bridge-session-contract
description: "檢查與維護 ask-bridge 的瀏覽器控制、呼叫端回傳和最終回答輸出原則。修改 ChatGPT 預設 Pro 選擇、Chrome DevTools MCP 連線、回覆定位或輸出流程時使用；一般向網站 AI 提問使用 ask-bridge skill。"
---

# ask-bridge 會話與輸出原則

此 skill 用於修改或審查這份專案的模型、瀏覽器及回覆流程。對實際行為做程式與驗證案例檢查；不能因寫了原則就宣稱網站介面永遠不變。

## 瀏覽器控制

- 正常問答仍由 Rust CLI 啟動或重用專用 Chrome，連接遠端除錯埠 `9223`，透過 `chrome-devtools-mcp` 的 stdio MCP 工具操作頁面。維護模型或回覆邏輯時，保留這條控制路徑，不自行改用另一個瀏覽器、Playwright、網站 API 或跨 session 的 UI 控制。
- 先核對 `src/main.rs` 的 MCP 套件規格、設定、連線和 `call_mcp_tool`；模型選單選取、回覆讀取則仍經由 `evaluate_script` 等既有 MCP 工具。先前修正確實調整了連線與呼叫逾時、重設和回答擷取，故只可說「控制媒介及 Chrome profile／port 沒換」，不可說整個 DevTools 呼叫實作完全沒改。
- 連線失敗或選頁狀態不明時不重播可能已送出的 prompt。共享 profile／port 的命令依序執行；不同代理人 session 不能同時控制同一個目前頁籤。

## 只把最終回答交回呼叫端

- CLI 的一般回傳管道是此次呼叫程序的 stdout；指定 `--output` 時另存本機檔案。代理人只在目前呼叫它的 task 中使用結果，不主動轉送到其他 task、對話、訊息系統或外部服務。
- 回答必須綁定本次請求、正確對話 URL 和完成狀態。擷取 ChatGPT 時只選 assistant 的**最終回答內容**及其回答操作列；思考面板、過程摘要、停止狀態、工具日誌和部分生成內容不是完成回答。若網頁結構無法分清兩者，回報擷取未確認，不能拿思考摘要填作結果。
- `--verbose` 的瀏覽器／MCP 診斷只用來除錯，不作為模型回覆。網站對話仍在共用的 ChatGPT 帳號／Chrome profile 中，其他有相同瀏覽器存取權的人可能看得到；stdout 只回到本次呼叫程序不等於帳號或瀏覽器的存取隔離。
- 不讀取或聲稱能取得模型隱藏的內部思考。可見的思考摘要也不納入輸出；需要檢查 `src/response-dom.cjs` 的回答本體選擇、複製按鈕範圍及 DOM 備援，不能只檢查終端機文字。

## ChatGPT 預設 Pro

- 一般 ChatGPT prompt 若沒有指定 `--reasoning`，在送出前明確選取介面上的 `Pro`。保留 `--reasoning instant|medium|high|auto|pro` 明確覆蓋；`--model` 選模型系列，兩個選擇維持獨立。
- `Pro` 是使用者指定的介面選項，所用模型系列與可用額度依網頁帳號而定；不把它假定成某個固定版本，也不在選取或驗證失敗後默默退回「即時」並送出。
- Gemini 與 Claude 的既有預設不因 ChatGPT 的 Pro 需求改變。登入、`get`、`open` 等非提問流程不為了此預設送出新問題。

## 驗證與回報

對涉及這些流程的改動，檢查 Git 差異與實際執行檔來源；依本次授權驗證選單成功／不可用時停止、明確覆蓋、只回傳當次最終回答，以及思考摘要位於最終回答之前的案例。原始碼修改需依 AGENTS.md 進行 Rust 格式化驗證。

回報「控制媒介未更換」與「逾時或擷取實作有改」的精確邊界，以及是否有實際網頁驗證。若只能證明 CLI 沒有跨 task 發送，須明說共享 Chrome profile 的可見性限制，不宣稱已做到真正的私有 session 隔離。
