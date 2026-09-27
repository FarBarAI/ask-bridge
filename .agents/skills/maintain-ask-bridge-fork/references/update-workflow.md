# 更新、驗證與版本切換

## 官方更新的候選工作

1. 查 working tree、staged 內容、目前分支及命令連結；有既有工作時先保存或在獨立 checkout 準備候選，不直接清除修改。
2. 確認組織 origin 與原作者 upstream，fetch upstream；查官方 main 和本機基底的差異。fetch 只是取得遠端紀錄，不等於部署。
3. 從目前組織修正版本建立 `codex/` 候選分支，再整合官方更新。候選分支 SHA、官方基底 SHA 與日期要能追蹤。
4. 逐項比較維護狀態中的修正與官方行為。保留必要差異；移除官方已取代的實作。實際衝突由代理人讀程式處理；不同檔案也可能有行為衝突。
5. 候選建置使用獨立目錄，例如 `CARGO_TARGET_DIR=target/candidate cargo build --release --locked --bin ask-bridge`。若在獨立 checkout 建置，仍查它是否會覆寫使用中的執行檔。
6. 依授權執行必要驗證，確認後推送候選／修正分支，再依部署授權切換。尚未通過時保留現用版本，報告具體失敗。

`main` 維持官方來源，`codex/local-fixes` 保存組織版本。Fork 與組織副本的預設分支可指向修正分支，讓使用者取得此版本。不要 force sync 帶有個人修正的分支。

## 功能驗證範圍

需要驗證更新相容性時，可依改動選用以下項目，報告實際執行範圍：

- 格式化：`cargo fmt --all -- --check`。
- Rust、Node 案例及建置：`cargo test --locked`、`npm test`、候選 release 建置。
- 原對話取回：確認 URL／回答身分，完整回答輸出與狀態 `0`。
- 新短答與搜尋：確認本次回答，不接受舊回答或其他分頁。
- 長篇回答與不同介面語系：停止生成後確實有完成證據；特別保留目前 completion signal 缺失的案例。
- 短逾時：狀態 `1`、partial 獨立保存、原完整檔未被覆蓋、不重送問題。
- 指定輸出與圖片失敗：非零狀態與對話連結，不能冒稱輸出完成。
- Claude／圖片：只有已登入且有需求時驗證，沒有執行就列為未驗證。

網站驗證會發送內容並使用網站額度；使用低風險短題，按本次授權範圍執行。所有 ask-bridge 命令共用 Chrome profile 與 port 9223，必須串行。失敗點可能已送出時，先核對原對話；至多一次明確的讀取恢復，不重送生成請求。

## 本機保存與切換

可使用使用者資料目錄下的 `ask-bridge/releases/<建置識別>/` 保存執行檔，搭配 `current` 連結指向選定版本；全域命令連到 `current/ask-bridge`。建置識別包含來源 commit，部署紀錄另存完整 SHA-256，版本號只供辨識上游版本。

首次遷移時逐位元複製現用執行檔，不藉遷移偷換新版。保存原命令連結和全域 skill，再切換新連結並檢查實際路徑、雜湊與版本輸出。已知功能缺陷繼續列在紀錄中。

候選採用時保存舊 current 目標，複製新執行檔到新目錄，更新部署紀錄後切換 current。多個 session 不可同時部署；切換期間確認沒有依賴該檔案的執行程序。失敗時回到先前目標和對應操作 skill。

回復亦包含 skill：先比較全域指引是否有新修改，備份後再還原版本。不要回復 Chrome profile、cookie 或對話資料作為程式降版的一部分。

## 發布與自動流程

本專案既有 workflow 包含 CI、Pages、Release、npm Publish。只保存分支時不推送所有 tags，也不觸發 Release、npm Publish 或 Pages。Fork 的 Actions 狀態、分支觸發條件與實際 run 都要查證。

若需要組織發布，先檢查安裝器、更新器、npm wrapper、release skill 中的原作者來源，以及 npm 套件名稱與發布權限；依使用者要求調整具體發布範圍。不要只更換 origin 就聲稱發布流程已改成組織版本。

## 官方文件

- [Fork 的角色與可見性](https://docs.github.com/en/pull-requests/reference/forks)
- [建立 Fork](https://docs.github.com/en/pull-requests/how-tos/work-with-forks/fork-a-repo)
- [同步官方更新](https://docs.github.com/en/pull-requests/how-tos/work-with-forks/syncing-a-fork)
