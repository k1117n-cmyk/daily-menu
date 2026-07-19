# 献立記録

Google Sheets と Google Apps Script で動く、毎日の献立記録システムです。
iPhone と Android のブラウザからアクセスして、献立の登録・検索・編集・削除ができます。

iPhone 13 mini の閲覧画面は本文30px、入力欄34pxを基準にしています。管理画面はパソコン入力向けの通常サイズです。
管理画面と閲覧画面の入力・検索メニューは、スマホで見やすいように縦並びを基本にしています。

## 構成

- `Code.gs`: Apps Script のサーバー側コード
- `admin.html`: 管理画面。献立の登録・編集・削除に使います。
- `view.html`: ユーザー閲覧画面。献立の検索・閲覧に使います。
- `appsscript.json`: Apps Script の設定

データは連携したスプレッドシート内の `Meals` シートに保存されます。
写真はスプレッドシートと同じ場所に作成される `Meal Photos` フォルダに保存され、閲覧画面で表示されます。

## Google Drive での設置手順

1. Google Drive で新しいスプレッドシートを作成します。
2. スプレッドシートで `拡張機能` > `Apps Script` を開きます。
3. Apps Script エディタで次の4ファイルを作ります。`appsscript.json` が見えない場合は、プロジェクト設定で `「appsscript.json」マニフェスト ファイルをエディタで表示する` を有効にします。
   - `Code.gs`
   - `admin.html`
   - `view.html`
   - `appsscript.json`
4. このディレクトリ内の同名ファイルの内容を貼り付けます。
5. Apps Script エディタ右上の `デプロイ` > `新しいデプロイ` を選びます。
6. 種類は `ウェブアプリ` を選び、次の設定にします。
   - 実行ユーザー: `自分`
   - アクセスできるユーザー: 必要に応じて `全員` または `リンクを知っている全員`
7. 表示されたウェブアプリURLを iPhone / Android のブラウザで開きます。

## URL

ウェブアプリURLが次の形式だとします。

```text
https://script.google.com/macros/s/デプロイID/exec
```

ユーザー閲覧画面:

```text
https://script.google.com/macros/s/デプロイID/exec
```

または:

```text
https://script.google.com/macros/s/デプロイID/exec?page=view
```

管理画面:

```text
https://script.google.com/macros/s/デプロイID/exec?page=admin
```

ページロックは実装していません。URLを知っている人がアクセスできる公開設定にする場合は、個人情報を書かない運用を推奨します。

## できること

- 日付、食事区分、献立、メモ、タグを保存
- 写真をアップロードしてログに表示
- 期間、食事区分、キーワードで検索
- 管理画面と閲覧画面を別URLで表示
- 既存記録の編集
- 不要な記録の削除

## レンタルサーバーで使う場合

この実装は Google Apps Script 前提です。レンタルサーバーで使う場合は、PHP + SQLite または PHP + MySQL に置き換えるのが現実的です。
複数端末から同じ記録を見返すには、ブラウザのローカル保存ではなくサーバー側DBが必要です。

## 写真について

iPhone の高解像度写真はアップロードに時間がかかるため、管理画面側で長辺1000px程度のJPEGへ縮小してから保存します。
それでも遅い場合は、写真アプリでスクリーンショット化した画像や、少し小さめに編集した画像を選ぶと安定します。
