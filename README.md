# return-billing-mcp-server

CCAR-F 認定試験の学習対策として作成した、**返品・請求問い合わせ振り分けサーバー**の
MCP (Model Context Protocol) サーバー実装です。ローカル JSON を「注文DB（+請求データ）」に
見立て、`lookup_order` / `check_return_eligibility` / `process_return` /
`get_billing_status` / `escalate_to_human` の5つのツールを提供します。

会話フロー（ユーザーID確認 → 返品/請求/それ以外への振り分け → オペレーター対応の
ターン数制御）そのものは MCP ツールの範囲外（呼び出し側 LLM エージェントの役割）のため、
[ORCHESTRATION.md](./ORCHESTRATION.md) に呼び出し側へ設定するシステムプロンプト例を
まとめています。

## セットアップ

```bash
npm install
npm run build
```

### 起動（stdio）

```bash
npm start
```

デモ用のダミー注文データは 2026年8月/7月/6月の1日に登録されている想定のため、
判定結果を本タスク記載の想定どおりに再現するには `MCP_TODAY` で「今日」を固定してください。

```bash
MCP_TODAY=2026-08-11 npm start
```

`MCP_TODAY` を指定しない場合は実際のシステム時刻が使われます。

### Claude Desktop などからの利用例

```json
{
  "mcpServers": {
    "return-billing": {
      "command": "node",
      "args": ["/absolute/path/to/return-billing-mcp-server/dist/index.js"],
      "env": {
        "MCP_TODAY": "2026-08-11"
      }
    }
  }
}
```

### 起動（Streamable HTTP・外部公開用）

stdio（ローカルプロセス起動）に加えて、通常のHTTPサーバーとして起動できる
Streamable HTTP transport 版のエントリポイントも用意しています。これを使うと、
`https://your-domain/mcp` のような **URLをエンドポイントに** MCPクライアントから
接続できます。

```bash
MCP_HTTP_TOKEN=<任意の秘密トークン> MCP_TODAY=2026-08-11 npm run start:http
```

- `MCP_HTTP_TOKEN` は必須です。未設定の場合、認証なしでの誤公開を防ぐため
  起動時にエラーで終了します。クライアント側は `Authorization: Bearer <token>`
  ヘッダーを付与してリクエストしてください。
- `PORT`（既定 `3000`）・`HOST`（既定 `0.0.0.0`）で待受先を変更できます。
- `GET /healthz` は認証不要のヘルスチェック用エンドポイントです（デプロイ先の
  ロードバランサ等からの疎通確認を想定）。
- セッション状態（`mcp-session-id` ごとの McpServer/Transport ペア）はプロセス内
  メモリで管理しています。複数インスタンスへスケールする場合は、ロードバランサの
  セッションアフィニティ設定、または外部ストアへの置き換えが必要です。

**注意**: このリポジトリのコードはHTTPサーバーとして起動できるようにするところ
までが範囲です。実際に「外部からアクセス可能なURL」にするには、どこかのサーバー・
PaaS（自前VM、Fly.io、Render 等）にこのプロセスをデプロイし、ドメインとTLS
（HTTPS）を用意する必要があります。ローカルで一時的に外部公開して試したいだけの
場合は、`ngrok http 3000` や Cloudflare Tunnel などのトンネリングツールで
`npm run dev:http` のプロセスを一時公開する方法が手軽です。

#### Claude Desktop などからの利用例（HTTP）

```json
{
  "mcpServers": {
    "return-billing-http": {
      "url": "https://your-domain.example.com/mcp",
      "headers": {
        "Authorization": "Bearer <MCP_HTTP_TOKENと同じ値>"
      }
    }
  }
}
```

### テスト

`@modelcontextprotocol/sdk` の Client / StdioClientTransport を使い、実際に
サーバープロセスを起動して5ツール全てを検証する統合テストを用意しています。

```bash
npm test
```

HTTP transport 版の簡易疎通確認用スクリプトも用意しています
（サーバーを別途起動した状態で実行してください）。

```bash
MCP_HTTP_TOKEN=test-secret-token PORT=3917 npm run start:http &
node tests/http.smoke.mjs http://127.0.0.1:3917/mcp test-secret-token
```

## ディレクトリ構成

```
data/orders.json      注文DB（ユーザー・製品・注文+請求ステータスのダミーデータ）
src/db.ts              JSON読み込み・検索・返品期限計算などのデータアクセス層
src/errors.ts           構造化エラー（AppError / エラー分類）
src/returnEligibility.ts 返品可否判定ロジック（check_return_eligibility / process_return共通）
src/escalation.ts        エスカレーション・セッションのターン数管理
src/mail.ts               返品通知メール送信のシミュレーション（メモリ上にログ）
src/tools/*.ts            5つのMCPツールの実装
src/server.ts             McpServer 定義・起動（stdio/HTTP共通）
src/index.ts               エントリポイント（stdio）
src/httpServer.ts           エントリポイント（Streamable HTTP・Bearer認証付き）
tests/integration.test.mjs 統合テスト（stdio）
tests/http.smoke.mjs        HTTP transport の簡易疎通確認スクリプト
ORCHESTRATION.md            呼び出し側エージェント向けシステムプロンプト例
```

## ダミーデータ

### ユーザー

| ユーザーID (メールアドレス) | 氏名 |
|---|---|
| Ami.Muratsubaki@protiviti.com | Ami Muratsubaki |
| goshi.tanaka@protiviti.com | Goshi Tanaka |
| takeharu.mokudai@protiviti.com | Takeharu Mokudai |
| amigo.murata@protiviti.com | Amigo Murata |
| takehiro.mokujai@protiviti.com | Mokujyai Takehiro |

`lookup_order` / `get_billing_status` はユーザーIDを大文字小文字を無視して完全一致で照合します
（似た別アドレスへの誤入力を検出できるよう、あえて紛らわしいアドレスを含めています）。

### 製品

- コカ・コーラ(500ml) 12本入りパック（¥1,800）
- 爽健美茶(350ml) 24本入りパック（¥2,400）
- 吉野家牛丼お得パック 18個入り（¥5,400）

### 注文

各ユーザーにつき、2026/8/1・2026/7/1・2026/6/1 の3件の注文を用意し（`data/orders.json`
生成元: `scripts/gen-data.mjs`）、製品と請求ステータス（未払い/支払い済み）を組み合わせて
バリエーションを持たせています。`MCP_TODAY=2026-08-11` で実行した場合:

- 2026/8/1 の注文 → 注文日から1ヶ月以内のため返品可能
- 2026/7/1・2026/6/1 の注文 → 1ヶ月を超過しているため返品不可

## ツール仕様

### 1. `lookup_order`

ユーザーIDから注文一覧を取得する。問い合わせ対応の最初のステップ（本人確認）として使用。

- 入力: `{ user_id: string }`
- 成功時出力: `{ user: {user_id, name}, order_count, orders: [{order_id, product_name, quantity, unit_price_jpy, order_date, billing_status, returned}] }`
- エラー: `USER_NOT_FOUND`

### 2. `check_return_eligibility`

注文IDを指定し、返品可否（注文日から1ヶ月以内か）を判定する。

- 入力: `{ order_id: string }`
- 出力: `{ order_id, order_date, deadline_date, days_elapsed, already_returned, eligible, reason: "OK"|"EXPIRED"|"ALREADY_RETURNED", message }`
- エラー: `ORDER_NOT_FOUND`

期限切れ・返品済みは「エラー」ではなく `eligible: false` の正常応答として返す設計です
（下記「エラー応答の分類」を参照）。

### 3. `process_return`

返品可能な注文について、返品理由を受け取り返品を確定する。処理後、ユーザーの登録
メールアドレス宛に返品受付通知メールを送信する（本サンプルでは実送信せず、内容を
そのままレスポンスに含めることでシミュレートしています）。

- 入力: `{ order_id: string, reason: string }`
- 成功時出力: `{ return_id, order_id, reason, processed_at, notification: {to, subject, body, sent_at} }`
- エラー: `ORDER_NOT_FOUND`, `RETURN_NOT_ELIGIBLE`（`details.reason` が `EXPIRED` または `ALREADY_RETURNED`）

`check_return_eligibility` を経由せず直接呼ばれた場合に備え、サーバー側でも
返品可否を再検証してから処理します。

### 4. `get_billing_status`

ユーザーの全注文について請求ステータス一覧を取得する。未払いの注文には振込先情報が
付与される。

- 入力: `{ user_id: string }`
- 出力: `{ user: {user_id, name}, unpaid_count, billing: [{order_id, product_name, order_date, amount_jpy, billing_status, payment_instructions}] }`
- エラー: `USER_NOT_FOUND`

`payment_instructions`（未払いの場合のみ）: テストサイトのため固定のダミー口座を返します。

```
XX株式会社 〇〇銀行 ××支店 普通 XXXXXXX
```

### 5. `escalate_to_human`

返品・請求のいずれにも該当しない問い合わせを有人オペレーターに引き継ぐ際の、
会話セッションのターン数管理を行う。オペレーターの回答文そのものは生成しない
（MCP ツールは LLM を呼び出せないため、呼び出し側エージェントが一般的なオペレーターとして
応答内容を作成する前提）。

- 入力: `{ session_id: string, user_message: string }`
- 出力: `{ session_id, turn_count, status: "active"|"confirm_close"|"force_closed", guidance, received_message }`
- エラー: `SESSION_CLOSED`（`force_closed` 後に同じ `session_id` で再度呼び出した場合）

ターン数のルール:

| turn_count | status | 呼び出し側エージェントの振る舞い |
|---|---|---|
| 1〜4 | `active` | オペレーターとして回答する |
| 5 | `confirm_close` | 回答した上で、終了してよいか確認する |
| 6〜9 | `active` | 継続を選んだ場合、通常どおり応答する |
| 10 | `force_closed` | 強制終了。新しい問い合わせの起票を依頼する |
| 11以降 | — | `SESSION_CLOSED` エラー |

## エラー応答の分類と構造化

すべてのツールは、例外発生時に生の例外を投げるのではなく、`isError: true` とともに
以下の構造化された JSON を返します（`src/errors.ts`）。

```json
{
  "error": {
    "code": "USER_NOT_FOUND",
    "category": "NOT_FOUND",
    "message": "ユーザーID「...」に該当する顧客情報が見つかりませんでした。...",
    "details": { "user_id": "..." }
  }
}
```

| category | 意味 | 該当する code |
|---|---|---|
| `NOT_FOUND` | 対象データが存在しない | `USER_NOT_FOUND`, `ORDER_NOT_FOUND` |
| `VALIDATION` | 入力値が不正 | `INVALID_INPUT` |
| `BUSINESS_RULE` | 業務ルール上、要求を実行できない | `RETURN_NOT_ELIGIBLE` |
| `STATE_CONFLICT` | 現在の状態と矛盾する要求 | `SESSION_CLOSED` |
| `INTERNAL` | 想定外の内部エラー | `INTERNAL_ERROR` |

**設計上の方針**: 「返品期限切れ」「返品済み」のようにビジネス上ありうる結果は
`check_return_eligibility` の正常応答（`eligible: false` + `reason`）として扱い、
「そもそも処理を実行できない異常系」（対象が存在しない、状態が矛盾している等）のみを
構造化エラーとして分離しています。これにより、呼び出し側エージェントは
`isError` の有無だけで「例外的な失敗」と「業務上の正常な分岐」を区別できます。
