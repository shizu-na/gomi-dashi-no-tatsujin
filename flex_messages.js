/**
 * @fileoverview LINE Flex MessageのJSONオブジェクトを生成するための関数群です。
 */

/**
 * 「ヘルプ」コマンド用のFlex Messageオブジェクトを返します。
 * @returns {object} LINE送信用Flex Messageオブジェクト
 */
function getHelpFlexMessage() {
  return {
    "type": "flex",
    "altText": MESSAGES.flex.helpAltText,
    "contents": helpMessageContents 
  };
}

/**
 * 全曜日のスケジュール一覧Flex Messageを動的に生成します。
 * メモがある場合は、常に表示します。
 * @param {string} userId - 対象ユーザーのID
 * @returns {object} LINE送信用Flex Messageオブジェクト
 */
function createScheduleFlexMessage(userId) { 
  const data = getSchedulesByUserId(userId);
  if (data.length === 0) {
  return getMenuMessage(MESSAGES.query.sheetEmpty);
  }

  const sortedData = data.sort((a, b) =>
    WEEKDAYS_FULL.indexOf(a[COLUMNS_SCHEDULE.DAY_OF_WEEK]) - WEEKDAYS_FULL.indexOf(b[COLUMNS_SCHEDULE.DAY_OF_WEEK])
  );

  const bubbles = sortedData.map(row => {
    const day = row[COLUMNS_SCHEDULE.DAY_OF_WEEK];
    const item = row[COLUMNS_SCHEDULE.GARBAGE_TYPE] || '（未設定）';
    const note = row[COLUMNS_SCHEDULE.NOTES] || '';

    const bodyContents = [{ "type": "text", "text": item, "wrap": true, "weight": "bold", "size": "md" }];
    
    if (note && note !== '-') {
      bodyContents.push({ "type": "separator", "margin": "lg" });
      bodyContents.push({ "type": "text", "text": note, "wrap": true, "size": "sm", "color": "#666666" });
    }

    return {
      "type": "bubble",
      "size": "nano",
      "header": {
        "type": "box",
        "layout": "vertical",
        "contents": [{ "type": "text", "text": day.replace('曜日', ''), "weight": "bold", "size": "xl", "color": "#176FB8", "align": "center" }],
        "paddingAll": "10px",
        "backgroundColor": "#f0f8ff"
      },
      "body": {
        "type": "box",
        "layout": "vertical",
        "spacing": "md",
        "contents": bodyContents
      },
      "action": {
        "type": "postback",
        "label": "変更",
        "data": `action=startChange&day=${day}`
      }
    };
  });

  return {
    "type": "flex",
    "altText": MESSAGES.flex.scheduleAltText,
    "contents": {
      "type": "carousel",
      "contents": bubbles
    }
  };
}

/**
 * 使い方ガイドのFlex Messageコンテンツ。
 * @const {object}
 */
const helpMessageContents = {
  "type": "carousel",
  "contents": [
    {
      "type": "bubble",
      "size": "hecto",
      "header": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "text",
            "text": "📅 予定一覧・編集",
            "color": "#FFFFFF",
            "weight": "bold",
            "align": "center",
            "size": "lg"
          }
        ],
        "backgroundColor": "#176FB8",
        "paddingAll": "12px"
      },
      "body": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "text",
            "text": "1週間の予定をカード形式で表示。",
            "wrap": true,
            "size": "sm",
            "align": "center",
            "weight": "regular"
          },
          {
            "type": "text",
            "text": "そのカードをタップすると\n予定を編集できます。",
            "margin": "none",
            "wrap": true,
            "size": "sm",
            "align": "center",
            "weight": "bold"
          }
        ],
        "paddingAll": "15px"
      },
      "footer": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "button",
            "action": {
              "type": "message",
              "label": "「一覧」を送る",
              "text": "一覧"
            },
            "style": "primary",
            "height": "sm"
          }
        ],
        "paddingTop": "0px"
      }
    },
    {
      "type": "bubble",
      "size": "hecto",
      "header": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "text",
            "text": "🚮 今日のごみを確認",
            "color": "#FFFFFF",
            "weight": "bold",
            "align": "center",
            "size": "lg"
          }
        ],
        "backgroundColor": "#5A9E46",
        "paddingAll": "12px"
      },
      "body": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "text",
            "text": "今日のごみ出し予定と、\n登録したメモを\nすぐに確認できます。",
            "wrap": true,
            "size": "sm",
            "align": "center"
          }
        ],
        "paddingAll": "15px",
        "spacing": "sm"
      },
      "footer": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "button",
            "action": {
              "type": "message",
              "label": "「今日」を送る",
              "text": "今日"
            },
            "style": "primary",
            "color": "#5A9E46",
            "height": "sm"
          }
        ],
        "paddingTop": "0px"
      }
    },
    {
      "type": "bubble",
      "size": "hecto",
      "header": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "text",
            "text": "🗑️ 明日のごみを確認",
            "color": "#FFFFFF",
            "weight": "bold",
            "align": "center",
            "size": "lg"
          }
        ],
        "backgroundColor": "#5A9E46",
        "paddingAll": "12px"
      },
      "body": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "text",
            "text": "明日のごみ出し予定と、\n登録したメモを\nすぐに確認できます。",
            "wrap": true,
            "size": "sm",
            "align": "center"
          }
        ],
        "paddingAll": "15px",
        "spacing": "sm"
      },
      "footer": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "button",
            "action": {
              "type": "message",
              "label": "「明日」を送る",
              "text": "明日"
            },
            "style": "primary",
            "color": "#5A9E46",
            "height": "sm"
          }
        ],
        "paddingTop": "0px"
      }
    },
    {
      "type": "bubble",
      "size": "hecto",
      "header": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "text",
            "text": "⚙️ 利用の停止（退会）",
            "color": "#FFFFFF",
            "weight": "bold",
            "align": "center",
            "size": "lg"
          }
        ],
        "backgroundColor": "#6C757D",
        "paddingAll": "12px"
      },
      "body": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "text",
            "text": "利用を停止します。\nデータは一時的に保持され、\nいつでも利用を再開できます。",
            "wrap": true,
            "size": "sm",
            "align": "center"
          }
        ],
        "paddingAll": "15px",
        "spacing": "sm"
      },
      "footer": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "button",
            "action": {
              "type": "message",
              "label": "「退会」を送る",
              "text": "退会"
            },
            "style": "secondary",
            "height": "sm"
          }
        ],
        "paddingTop": "0px"
      }
    }
  ]
};