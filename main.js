// --- 設定項目 ---
const SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
const SHEET_NAME = 'test'; // あなたのシート名に合わせてください
const CHANNEL_ACCESS_TOKEN = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ACCESS_TOKEN');

/**
 * LINEからのWebhookを受け取るメイン関数
 */
function doPost(e) {
  const event = JSON.parse(e.postData.contents).events[0];
  const replyToken = event.replyToken;
  const userMessage = event.message.text;

  const replyMessage = createReplyMessage(userMessage);

  if (!replyMessage) {
    return;
  }

  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    'headers': {
      'Content-Type': 'application/json; charset=UTF-8',
      'Authorization': 'Bearer ' + CHANNEL_ACCESS_TOKEN,
    },
    'method': 'post',
    'payload': JSON.stringify({
      'replyToken': replyToken,
      'messages': [replyMessage],
    }),
  });
}

/**
 * ユーザーメッセージに応じて返信メッセージオブジェクトを生成する
 * @param {string} userMessage - ユーザーからのメッセージテキスト
 * @returns {object | null} - 送信するメッセージオブジェクト。返信不要の場合はnull
 */
function createReplyMessage(userMessage) {
  if (!userMessage.startsWith('@bot')) {
    return null;
  }

  const rawCommand = userMessage.replace('@bot', '').trim();
  const isDetailed = rawCommand.includes('詳細');
  const command = rawCommand.replace('詳細', '').trim();

  // Flex Messageを返すコマンド
  if (command === '全部') {
    return createScheduleFlexMessage(isDetailed);
  }
  if (command === '使い方' || command === 'ヘルプ') {
    return getHelpFlexMessage();
  }

  // スプレッドシートの列インデックスを定数として定義
  const COLUMN = {
    DAY_OF_WEEK: 0, // A列: 曜日
    SEARCH_KEY:  1, // B列: 検索キー
    GARBAGE_TYPE:2, // C列: ゴミの種類
    NOTES:       3  // D列: 注意事項
  };

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  // getLastRow()が0の場合や1の場合にエラーになるのを防ぐ
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
      // データがない場合の処理
      return { type: 'text', text: 'ゴミ出し情報がシートに登録されていません。' };
  }
  const data = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
  let replyText = '';

  // 「今日」または「きょう」のコマンド
  if (command === '今日' || command === 'きょう') {
    const today = new Date();
    const dayOfWeek = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'][today.getDay()];

    for (const row of data) {
      if (row[COLUMN.DAY_OF_WEEK] === dayOfWeek) {
        const garbageType = row[COLUMN.GARBAGE_TYPE];
        const notes = row[COLUMN.NOTES];
        replyText = `今日のゴミは【${garbageType}】です。`;
        if (isDetailed && notes && notes !== '-') {
          replyText += `\n📝 注意事項：${notes}`;
        }
        break;
      }
    }
    if (!replyText) {
      replyText = '今日のゴミ出し情報は見つかりませんでした。';
    }
  } 
  // コマンドが空文字でない場合のみ、特定の曜日を検索する
  else if (command) { 
    for (const row of data) {
      const searchKeys = row[1];
      if (searchKeys.includes(command)) {
        const dayName = row[0];
        const garbageType = row[2];
        const notes = row[3];
        replyText = `${dayName}のゴミは【${garbageType}】です。`;
        if (isDetailed && notes && notes !== '-') {
          replyText += `\n📝 注意事項：${notes}`;
        }
        break;
      }
    }
  }

  if (replyText) {
    return { type: 'text', text: replyText };
  }
  
  const fallbackText = 'すみません、コマンドが分かりませんでした。\n「@bot 使い方」でヘルプを表示します。';
  return { type: 'text', text: fallbackText };
}