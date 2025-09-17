/**
 * @fileoverview Botがユーザーに送信するすべてのメッセージテキストと、メッセージオブジェクトを管理します。
 */

/**
 * Botがユーザーに送信するすべてのメッセージを管理するオブジェクト
 * @const
 */
const MESSAGES = {
  // 共通
  common: {
    cancel: '操作をキャンセルしました。',
    error: 'エラーが発生しました。時間をおいて再度お試しください。',
  },
  // イベント（友だち追加時）
  event: {
    follow_new: [
      '友だち追加ありがとうございます！🙌',
      'ここでは、ごみ出しの予定を管理・確認することができます。',
      'まずは「はじめる」を押して、ご利用を開始しましょう！'
    ],
    follow_welcome_back: 'おかえりなさい！\n引き続き、ごみ出し予報をご利用いただけます。',
    follow_rejoin_prompt: 'おかえりなさい！\n以前のスケジュールが保存されています。ご利用を再開しますか？',
  },
  // 登録
  registration: {
    success: [
      '✅ ありがとうございます。',
      '早速、「一覧」を押してみてください！予定やメモを確認できます。',
      '今はまだ、ごみの品目やメモが書かれていないと思います。'
    ],
    prompt: 'ご利用には、まず「はじめる」を押してから開始してください。',
  },
  // 退会・再開
  unregistration: {
    success: 'ご利用ありがとうございました。\nまた使いたくなったら、いつでも話しかけてください！',
    unsubscribed: '現在、機能が停止されています。利用を再開しますか？',
    reactivate: '✅ 利用を再開しました！',
  },
  // 変更（対話）
  modification: {
    askItem: '【{0}】の品目を何と変更しますか？入力してください。\n\nそのままにするなら「スキップ」、変更をやめるなら「キャンセル」を押してください。',
    askNote: 'メモを何と変更しますか？入力してください。\n\nそのままにするなら「スキップ」、これまでの変更を取り消すなら「キャンセル」を押してください。',
    success: '✅【{0}】の予定を更新しました。\n《品目》\n{1}\n《メモ》\n{2}',
    itemTooLong: '⚠️ 品名は{0}文字以内で入力してください。',
    noteTooLong: '⚠️ メモは{0}文字以内で入力してください。',
  },
  // ごみ出し日問い合わせ
  query: {
    todayResult: '【{0}】',
    tomorrowResult: '【{0}】',
    notes: '\n{0}',
    notFound: '{0}のごみ出し情報は見つかりませんでした。',
    sheetEmpty: 'ごみ出し情報が登録されていません。「一覧」と送信してスケジュールを登録してください。',
  },
  // エラー・状態
  error: {
    timeout: '操作が中断されたか、時間切れになりました。\nもう一度やり直してください。',
    updateFailed: 'エラーにより予定の更新に失敗しました。',
  },
  // Flex Message
  flex: {
    helpAltText: '使い方ガイド',
    scheduleAltText: 'ごみ出しスケジュール一覧',
    schedulePrompt: '変更したい曜日があれば、カードをタップして編集できます（数秒お待ち下さい！）',
  },
};

// =================================================================
// メッセージ生成ヘルパー関数
// =================================================================

/**
 * メッセージのプレースホルダーを動的な値に置き換えます。
 * @param {string} text - フォーマット対象のテキスト
 * @param {...string} args - 埋め込む値
 * @returns {string} フォーマット後のテキスト
 */
function formatMessage(text, ...args) {
  return args.reduce((acc, val, i) => acc.replace(`{${i}}`, val), text);
}

/**
 * 未認識のコマンドに対するフォールバックメッセージ（クイックリプライ付き）を生成します。
 * @returns {object} LINE送信用メッセージオブジェクト
 */
function getFallbackMessage() {
  return {
    'type': 'text',
    'text': 'ご用件が分かりませんでした。\n下のボタンから操作を選んでください。',
    'quickReply': {
      'items': [
        { 'type': 'action', 'action': { 'type': 'message', 'label': '一覧', 'text': '一覧' } },
        { 'type': 'action', 'action': { 'type': 'message', 'label': '今日', 'text': '今日' } },
        { 'type': 'action', 'action': { 'type': 'message', 'label': '明日', 'text': '明日' } },
        { 'type': 'action', 'action': { 'type': 'message', 'label': 'ヘルプ', 'text': 'ヘルプ' } },
      ]
    }
  };
}

/**
 * 指定したテキストに、共通のクイックリप्लाईメニューを付けて返します。
 * @param {string} text - 表示したいメッセージ本文
 * @returns {object} LINE送信用メッセージオブジェクト
 */
function getMenuMessage(text) {
  return {
    'type': 'text',
    'text': text,
    'quickReply': {
      'items': [
        { 'type': 'action', 'action': { 'type': 'message', 'label': '一覧', 'text': '一覧' } },
        { 'type': 'action', 'action': { 'type': 'message', 'label': '今日', 'text': '今日' } },
        { 'type': 'action', 'action': { 'type': 'message', 'label': '明日', 'text': '明日' } },
        { 'type': 'action', 'action': { 'type': 'message', 'label': 'ヘルプ', 'text': 'ヘルプ' } },
      ]
    }
  };
}

/**
 * 利用再開を促すメッセージ（クイックリプライ付き）を生成します。
 * @param {string} text - 表示するテキスト
 * @returns {object} LINE送信用メッセージオブジェクト
 */
function getReactivationPromptMessage(text) {
  return {
    'type': 'text',
    'text': text,
    'quickReply': {
      'items': [
        { 'type': 'action', 'action': { 'type': 'message', 'label': '利用を再開する', 'text': '利用を再開する' } }
      ]
    }
  };
}

/**
 * [対話] 品目を尋ねるメッセージを生成します。
 * @param {string} day - 変更対象の曜日
 * @param {string} currentItem - 現在の品目
 * @returns {object} LINE送信用メッセージオブジェクト
 */
function getModificationItemPromptMessage(day, currentItem) {
  return {
    'type': 'text',
    'text': formatMessage(MESSAGES.modification.askItem, day),
    'quickReply': {
      'items': [
        { 'type': 'action', 'action': { 'type': 'message', 'label': 'スキップ', 'text': 'スキップ' } },
        { 'type': 'action', 'action': { 'type': 'message', 'label': 'キャンセル', 'text': 'キャンセル' } }
      ]
    }
  };
}

/**
 * [対話] メモを尋ねるメッセージを生成します。
 * @param {string} currentNote - 現在のメモ
 * @returns {object} LINE送信用メッセージオブジェクト
 */
function getModificationNotePromptMessage(currentNote) {
  return {
    'type': 'text',
    'text': formatMessage(MESSAGES.modification.askNote),
    'quickReply': {
      'items': [
        { 'type': 'action', 'action': { 'type': 'message', 'label': 'スキップ', 'text': 'スキップ' } },
        { 'type': 'action', 'action': { 'type': 'message', 'label': 'キャンセル', 'text': 'キャンセル' } }
      ]
    }
  };
}

/**
 * 登録を促すメッセージ（クイックリプライ付き）を生成します。
 * @param {string} text - 表示するテキスト
 * @returns {object} LINE送信用メッセージオブジェクト
 */
function getRegistrationPromptMessage(text) {
  return {
    'type': 'text',
    'text': text,
    'quickReply': {
      'items': [
        { 'type': 'action', 'action': { 'type': 'message', 'label': 'はじめる', 'text': 'はじめる' } }
      ]
    }
  };
}