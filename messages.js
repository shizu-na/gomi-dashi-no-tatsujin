/**
 * @fileoverview Botがユーザーに送信するすべてのメッセージテキストを管理します。
 * [変更] 新しい変更フローに合わせてメッセージ定義と生成関数を修正。
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
    // パターン1: 全くの新規ユーザー向け
    follow_new: '友だち追加ありがとうございます！\n\nここでは、ゴミ出しの予定を管理・確認することができます。\n\n「はじめる」を押して、ご利用を開始しましょう！',
    // パターン2: 登録済みでアクティブなユーザー向け
    follow_welcome_back: 'おかえりなさい！\n引き続き、ごみ出し予報をご利用いただけます。',
    // パターン3: 退会済みのユーザー向け
    follow_rejoin_prompt: 'おかえりなさい！\n以前のスケジュールが保存されています。ご利用を再開しますか？',
  },
  // 登録
  registration: {
    // ★ 変更: 登録後の案内メッセージを新しいフローに合わせる
    success: '✅ ありがとうございます。早速、「一覧」と送ってください！\n\nすると、予定を確認できます。そこから情報を変更することができます。\n\n使い方が分からない時は「ヘルプ」と送信してください。',
    // [追加] 未登録ユーザーに登録を促すメッセージ
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
    askNote: '注意事項を何と変更しますか？入力してください。\n\nそのままにするなら「スキップ」、これまでの変更を取り消すなら「キャンセル」を押してください。',
    success: '✅【{0}】の予定を更新しました。\n\n品目: {1}\n注意事項: {2}',
    itemTooLong: '⚠️ 品名は20文字以内で入力してください。',
    noteTooLong: '⚠️ 注意事項は100文字以内で入力してください。',
  },
  // ゴミ出し日問い合わせ
  query: {
    todayResult: '今日のゴミは【{0}】です。',
    tomorrowResult: '明日のゴミは【{0}】です。', // [追加]
    dayResult: '{0}のゴミは【{1}】です。', // このメッセージは現在使われませんが、将来の拡張のために残しておいても良いでしょう
    notes: '\n📝 注意事項：{0}',
    notFound: '{0}のゴミ出し情報は見つかりませんでした。', // [変更]
    sheetEmpty: 'ゴミ出し情報が登録されていません。「一覧」と送信してスケジュールを登録してください。',
  },
  // エラー・状態
  error: {
    timeout: '操作が中断されたか、時間切れになりました。\nもう一度やり直してください。',
    updateFailed: 'エラーにより予定の更新に失敗しました。',
  },
  // Flex Message
  flex: {
    helpAltText: '使い方ガイド',
    scheduleAltText: 'ゴミ出しスケジュール一覧',
    schedulePrompt: '変更したい曜日があれば、カードをタップして編集できます。',
  },
};

// =================================================================
// メッセージ生成ヘルパー関数
// =================================================================

/**
 * メッセージのプレースホルダーを動的な値に置き換える
 */
function formatMessage(text, ...args) {
  return args.reduce((acc, val, i) => acc.replace(`{${i}}`, val), text);
}

/**
 * ★ 変更: フォールバックメッセージのクイックリプライから「予定を変更」を削除
 * @returns {object}
 */
function getFallbackMessage() {
  return {
    'type': 'text',
    'text': 'ご用件が分かりませんでした。\n下のボタンから操作を選ぶか、メッセージを送信してください。',
    'quickReply': {
      'items': [
        { 'type': 'action', 'action': { 'type': 'message', 'label': '一覧', 'text': '一覧' } },
        { 'type': 'action', 'action': { 'type': 'message', 'label': '今日', 'text': '今日' } },
        { 'type': 'action', 'action': { 'type': 'message', 'label': '明日', 'text': '明日' } },
        { 'type': 'action', 'action': { 'type': 'message', 'label': '使い方', 'text': '使い方' } },
      ]
    }
  };
}

/**
 * [変更] 利用再開を促すメッセージを生成（テキストを引数で受け取れるように）
 * @param {string} text - 表示するテキスト
 * @returns {object}
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
 * [対話] 品目を尋ねるメッセージを生成
 */
function getModificationItemPromptMessage(day, currentItem) {
  return {
    'type': 'text',
    'text': formatMessage(MESSAGES.modification.askItem, day, currentItem),
    'quickReply': {
      'items': [
        { 'type': 'action', 'action': { 'type': 'message', 'label': 'スキップ', 'text': 'スキップ' } },
        { 'type': 'action', 'action': { 'type': 'message', 'label': 'キャンセル', 'text': 'キャンセル' } }
      ]
    }
  };
}

/**
 * [対話] 注意事項を尋ねるメッセージを生成
 */
function getModificationNotePromptMessage(currentNote) {
  return {
    'type': 'text',
    'text': formatMessage(MESSAGES.modification.askNote, currentNote),
    'quickReply': {
      'items': [
        { 'type': 'action', 'action': { 'type': 'message', 'label': 'スキップ', 'text': 'スキップ' } },
        { 'type': 'action', 'action': { 'type': 'message', 'label': 'キャンセル', 'text': 'キャンセル' } }
      ]
    }
  };
}

/**
 * [追加] 登録を促すメッセージ（クイックリプライ付き）を生成
 * @param {string} text - 表示するテキスト
 * @returns {object}
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