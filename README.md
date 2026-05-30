# Gomoku Premium (五目並べゲーム)

高品質なビジュアルデザインと3段階のAI、さらにリアルタイム通信対戦を搭載した、ブラウザで動作するプレミアムな五目並べ（Gomoku）ゲームです。

---

## 🌟 特徴
- **3つの対戦モード**:
  - **ローカル2人対戦**: 1台の端末で交互に打つモード。
  - **VS コンピュータ (AI戦)**: 思考レベルの異なる3段階のAIと対戦するモード。
  - **オンライン対戦 (Firebase)**: ルームIDを共有することで、遠隔地のプレイヤーとリアルタイムで通信対戦ができるモード。
- **3段階のAI難易度**:
  - **簡単**: 候補マスの中から完全にランダムに配置。
  - **普通**: 1手評価（パターンスコア）に基づき、自分の連を伸ばし、相手の連をブロックするAI。
  - **難しい**: 防御と攻撃を高度にパターン認識し、さらに1手先読み（相手の対応も考慮）して最善手を選択する本格AI。
- **プレミアムデザイン**:
  - ガラスモフィズム（透過ガラススタイル）、3D効果、ポップイン配置アニメーションを完備。
  - 4種類の美しいテーマ（クラシックグリーン、ダークガラス、サイバーネオン、フォレストウッド）を搭載し、雰囲気に応じたカスタマイズが可能。
- **インタラクティブサウンド**:
  - Web Audio APIを使用して、石を置いた際の「パチッ」というリアルな打音を動的に合成して再生（外部音声ファイルのロードが不要）。
- **充実の便利機能**:
  - 1手戻す機能（Undo / AI戦ではプレイヤー・AIの2手分戻ります）。
  - ローカルストレージを使用した累計戦績の保存（対人、対AI、オンライン）。
  - 対局終了後の「棋譜再生」機能（一手ずつ進めたり、自動で振り返り再生を行うことができます）。

---

## 🚀 起動方法

本アプリケーションは HTML, CSS, JavaScript のみで構成されているため、特別なサーバー側のインストールは不要です。

1. このフォルダ内の `index.html` をダブルクリックするか、ブラウザにドラッグ＆ドロップします。
2. もしくは、ローカルサーバー（VS CodeのLive Server、または Python の `python -m http.server 8000` など）を起動してアクセスします。

---

## 🛠️ GitHubへの登録とインターネット公開手順

このゲームをGitHubにアップロード（登録）し、さらに誰でも遊べるようにインターネット上に公開（GitHub Pages）する手順です。

### 1. GitHub上で新しいリポジトリを作成
1. [GitHub](https://github.com/) にログインします。
2. 画面右上の「**+**」アイコンをクリックし、「**New repository**」を選択します。
3. **Repository name**（例: `gomoku-premium`）を入力します。
4. 説明（Description）に「HTML5 Gomoku Game with AI & Firebase」などと入力します。
5. 公開範囲を「**Public**（パブリック）」に設定します。（インターネット公開に必要です）
6. 「Initialize this repository with:」の項目はすべて**チェックを入れずに空欄のまま**にします。
7. 「**Create repository**」ボタンをクリックします。

### 2. リポジトリをGitHubに接続してプッシュする
GitHubリポジトリ作成後に表示される「…or push an existing repository from the command line」のコマンドをターミナル（PowerShellやBashなど）で実行します。

```bash
# 1. ブランチ名を main に設定
git branch -M main

# 2. リモートリポジトリ（GitHub）の登録
# ※URLをご自身のGitHubのものに置き換えてください
git remote add origin https://github.com/ご自身のユーザー名/gomoku-premium.git

# 3. GitHubへソースコードをアップロード
git push -u origin main
```

### 3. インターネット上に無料公開する（GitHub Pages）
GitHubにプッシュしたら、次の手順でゲームをウェブサイトとして公開できます。

1. GitHubのリポジトリページにアクセスします。
2. 上部タブの「**Settings**（設定）」をクリックします。
3. 左メニューの「Code and automation」カテゴリにある「**Pages**」をクリックします。
4. 「Build and deployment」の中の **Source** を「**Deploy from a branch**」にします。
5. **Branch** で `main` を選択し、「**Save**」をクリックします。
6. 数分待つと、画面上部に公開されたURL（例: `https://ユーザー名.github.io/gomoku-premium/`）が表示されます。このURLを友達に共有すれば、スマホや他のPCからオンライン対戦などを一緒に遊ぶことができます！

---

## 🌐 オンライン対戦（Firebase）のセットアップ

オンラインマルチプレイを使用するためには、Firebase Realtime Database の初期設定が必要です。
詳細な設定方法は [FIREBASE_SETUP.md](file:///c:/Users/user/Antigravity/FIREBASE_SETUP.md) をご覧ください。接続用設定値を `app.js` の先頭（`firebaseConfig`）に記述することで動作するようになります。
