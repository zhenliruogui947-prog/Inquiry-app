# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

**Inquiry-app** — 社員が日々の問い合わせ対応工数をカテゴリ別に記録・集計するWebアプリ。
GAS の WebApp として動作し、データは自動生成されるGoogleスプレッドシートに保存される。

## ファイル構成

| ファイル | 役割 |
|---|---|
| `Code.gs` | サーバーサイドロジック。スプレッドシートの初期化・CRUD・集計・Excel エクスポート |
| `index.html` | クライアントUI。`google.script.run` でサーバー関数を呼び出す |
| `appsscript.json` | GAS マニフェスト（タイムゾーン・OAuth スコープ・WebApp 設定） |

## 開発コマンド（clasp 使用）

```bash
npm install -g @google/clasp   # 初回のみ
clasp login                    # Google アカウント認証
clasp create --type webapp --title "Inquiry-app"  # 新規プロジェクト作成
clasp push                     # ローカル → GAS へ反映
clasp open                     # GAS エディタをブラウザで開く
```

デプロイ（WebApp として公開）はブラウザの GAS エディタ上で行う:  
「デプロイ」→「新しいデプロイ」→ 種類: **ウェブアプリ** → 実行ユーザー: **自分**、アクセス: **Googleアカウントを持つ全員**

## アーキテクチャ

```
[index.html]
  google.script.run.saveInquiry(category, minutes, memo)
  google.script.run.getSummary(startDate, endDate)
  google.script.run.exportToExcel(startDate, endDate)
        ↓
[Code.gs]
  getSpreadsheet_()  ─── PropertiesService に SPREADSHEET_ID を保存
        ↓
[Googleスプレッドシート（自動生成）]
  シート「ログ」       : 日時 | カテゴリ | 工数(分) | メモ
  シート「カテゴリ」   : カテゴリ名（マスタ）
  シート「集計結果」   : exportToExcel() 実行時に上書き生成
```

## データ設計

- **スプレッドシートの場所**: スクリプト実行者のGoogleドライブに自動生成される。IDは `Script Properties > SPREADSHEET_ID` に保存。
- **カテゴリ変更**: スプレッドシートの「カテゴリ」シートを直接編集すれば UI に反映される。
- **Excel エクスポート**: `exportToExcel()` が「集計結果」シートを上書きし、スプレッドシート全体を `.xlsx` でダウンロードするURLを返す。

## GitHub リポジトリ

https://github.com/zhenliruogui947-prog/Inquiry-app

## GAS 固有の制約

- 実行時間上限は **6分**。大量データの一括処理が必要な場合は分割を検討すること。
- `google.script.run` は非同期。必ず `withSuccessHandler` / `withFailureHandler` をセットで使う。
- `HtmlService` 経由のページは `<script>` 内で `fetch` や `XMLHttpRequest` でサーバー関数を呼べない。`google.script.run` のみ使用可。
- WebApp の URL は再デプロイしても変わらない（「デプロイを管理」→「新バージョン」で更新）。
