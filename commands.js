/**
 * @fileoverview ユーザーからのメッセージ(コマンド)に応じた応答を生成するロジックです。
 */

/**
 * ユーザーメッセージに基づき、適切な返信メッセージオブジェクトを生成します。
 * @param {object} event - LINE Webhookイベントオブジェクト
 * @returns {Array<object>|null} 送信するメッセージオブジェクトの配列、またはnull
 */
function createReplyMessage(event) {
  const userMessage = event.message.text.trim();
  const userId = event.source.userId;

  try {
    let messages = null;

    switch (userMessage) {
      case '退会':
        messages = [_handleUnregistration(userId)];
        break;
      case 'リマインダー':
        messages = _handleReminder(userId);
        break;
      case '使い方':
      case 'ヘルプ':
        messages = [getHelpFlexMessage()];
        break;
      case '一覧':
        messages = _handleScheduleList(userId);
        break;
      default:
        // '今日', '明日' などのキーワード応答を処理
        messages = handleGarbageQuery(userMessage, userId);
        break;
    }

    if (messages) {
      return Array.isArray(messages) ? messages : [messages];
    }
    return null; // どのコマンドにも一致しない場合

  } catch (err) {
    writeLog('CRITICAL', `createReplyMessageで予期せぬエラー: ${err.stack}`, userId);
    return [{ type: 'text', text: MESSAGES.common.error }];
  }
}

/**
 * 「退会」コマンドを処理します。
 * @private
 * @param {string} userId - ユーザーID
 * @returns {object} 送信するメッセージオブジェクト
 */
function _handleUnregistration(userId) {
  try {
    updateUserStatus(userId, USER_STATUS.UNSUBSCRIBED);
    writeLog('INFO', 'ユーザー退会（論理削除）', userId);
    return { type: 'text', text: MESSAGES.unregistration.success };
  } catch (e) {
    writeLog('ERROR', `退会処理: ${e.message}`, userId);
    return { type: 'text', text: MESSAGES.common.error };
  }
}

/**
 * 「リマインダー」コマンドを処理します。
 * @private
 * @param {string} userId - ユーザーID
 * @returns {Array<object>} 送信するメッセージオブジェクトの配列
 */
function _handleReminder(userId) {
  // if (!isUserOnAllowlist(userId)) {
  //   return [{ type: 'text', text: '申し訳ありません。この機能は許可されたユーザーのみご利用いただけます。' }];
  // }

  const userRecord = getUserRecord(userId);
  if (!userRecord) {
    writeLog('ERROR', '「リマインダー」処理中にユーザーレコード取得失敗。', userId);
    return [{ type: 'text', text: 'ユーザー情報が見つかりませんでした。'}];
  }

  const { nightTime, morningTime } = getReminderTimes(userRecord.row);
  const flexMessage = getReminderManagementFlexMessage(nightTime, morningTime);
  return [flexMessage];
}

/**
 * 「一覧」コマンドを処理します。
 * @private
 * @param {string} userId - ユーザーID
 * @returns {Array<object>} 送信するメッセージオブジェクトの配列
 */
function _handleScheduleList(userId) {
  const carouselMessage = createScheduleFlexMessage(userId);
  if (carouselMessage && carouselMessage.type === 'flex') {
    const promptMessage = { type: 'text', text: MESSAGES.flex.schedulePrompt };
    return [carouselMessage, promptMessage];
  }
  // スケジュール未登録などの場合は、単一のメッセージオブジェクトが返る
  return [carouselMessage];
}

/**
 * 「今日」「明日」などのごみ出し日に関する問い合わせを処理します。
 * @param {string} command - ユーザーが入力したコマンド (例: '今日')
 * @param {string} userId - ユーザーID
 * @returns {Array<object>|null} 送信するメッセージオブジェクトの配列、またはnull
 */
function handleGarbageQuery(command, userId) {
  const data = getSchedulesByUserId(userId);
  if (data.length === 0) {
    return [getMenuMessage(MESSAGES.query.sheetEmpty)];
  }

  const todayJST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  let targetDay;
  let title;

  if (command === '今日' || command === 'きょう') {
    const dayOfWeek = todayJST.getDay(); // 元の日曜=0, 月曜=1...
    const targetDayIndex = (dayOfWeek === 0) ? 6 : dayOfWeek - 1; // 月曜=0, ..., 日曜=6 に変換
    targetDay = WEEKDAYS_FULL[targetDayIndex];
    title = '今日のごみ🗑️';
  } else if (command === '明日' || command === 'あした') {
    const tomorrowJST = new Date(todayJST);
    tomorrowJST.setDate(tomorrowJST.getDate() + 1);
    const dayOfWeek = tomorrowJST.getDay(); // 元の日曜=0, 月曜=1...
    const targetDayIndex = (dayOfWeek === 0) ? 6 : dayOfWeek - 1; // 月曜=0, ..., 日曜=6 に変換
    targetDay = WEEKDAYS_FULL[targetDayIndex];
    title = '明日のごみ🗑️';
  }

  if (!targetDay) return null; // '今日' '明日' 以外のメッセージ

  const foundRow = data.find(row => row[COLUMNS_SCHEDULE.DAY_OF_WEEK] === targetDay);
  if (!foundRow) {
    return [getMenuMessage(formatMessage(MESSAGES.query.notFound, command))];
  }

  const item = foundRow[COLUMNS_SCHEDULE.GARBAGE_TYPE];
  const note = foundRow[COLUMNS_SCHEDULE.NOTES];
  const altText = `${targetDay}のごみは「${item}」です。`;

  const flexMessage = createSingleDayFlexMessage(title, targetDay, item, note, altText, true);
  return [flexMessage];
}

// --- 予定変更フロー -----------------------------------------------------------

/**
 * 予定変更フローを開始します。
 * @param {string} replyToken - リプライトークン
 * @param {string} userId - ユーザーID
 * @param {string} dayToModify - 変更対象の曜日
 */
function startModificationFlow(replyToken, userId, dayToModify) {
  const schedules = getSchedulesByUserId(userId);
  const foundRow = schedules.find(row => row[COLUMNS_SCHEDULE.DAY_OF_WEEK] === dayToModify);
  const currentItem = foundRow ? foundRow[COLUMNS_SCHEDULE.GARBAGE_TYPE] : '（未設定）';
  const currentNote = foundRow ? foundRow[COLUMNS_SCHEDULE.NOTES] : '（未設定）';

  const state = {
    step: MODIFICATION_FLOW.STEPS.WAITING_FOR_ITEM,
    day: dayToModify,
    currentItem: currentItem,
    currentNote: currentNote,
  };
  const cache = CacheService.getUserCache();
  cache.put(userId, JSON.stringify(state), MODIFICATION_FLOW.CACHE_EXPIRATION_SECONDS);

  replyToLine(replyToken, [getModificationItemPromptMessage(dayToModify, currentItem)]);
}

/**
 * 予定変更フローの対話を継続します。
 * @param {string} replyToken - リプライトークン
 * @param {string} userId - ユーザーID
 * @param {string} userMessage - ユーザーからの入力メッセージ
 * @param {string} cachedState - キャッシュされている対話状態
 */
function continueModification(replyToken, userId, userMessage, cachedState) {
  const state = JSON.parse(cachedState);
  const cache = CacheService.getUserCache();

  if (userMessage === 'キャンセル') {
    cache.remove(userId);
    replyToLine(replyToken, [getMenuMessage(MESSAGES.common.cancel)]);
    return;
  }

  switch (state.step) {
    case MODIFICATION_FLOW.STEPS.WAITING_FOR_ITEM:
      _handleItemInput(replyToken, userId, userMessage, state, cache);
      break;
    case MODIFICATION_FLOW.STEPS.WAITING_FOR_NOTE:
      _handleNoteInput(replyToken, userId, userMessage, state, cache);
      break;
    default:
      cache.remove(userId);
      replyToLine(replyToken, [getMenuMessage(MESSAGES.error.timeout)]);
      break;
  }
}

/**
 * 予定変更フロー：品目入力の処理
 * @private
 */
function _handleItemInput(replyToken, userId, newItem, state, cache) {
  if (newItem !== 'スキップ' && newItem.length > VALIDATION_LIMITS.ITEM_MAX_LENGTH) {
    const errorMessage = getModificationItemPromptMessage(state.day, state.currentItem);
    errorMessage.text = formatMessage(MESSAGES.modification.itemTooLong, VALIDATION_LIMITS.ITEM_MAX_LENGTH);
    replyToLine(replyToken, [errorMessage]);
    return;
  }

  state.step = MODIFICATION_FLOW.STEPS.WAITING_FOR_NOTE;
  if (newItem !== 'スキップ') {
    state.newItem = newItem;
  }
  cache.put(userId, JSON.stringify(state), MODIFICATION_FLOW.CACHE_EXPIRATION_SECONDS);
  replyToLine(replyToken, [getModificationNotePromptMessage(state.currentNote)]);
}

/**
 * 予定変更フロー：メモ入力の処理
 * @private
 */
function _handleNoteInput(replyToken, userId, newNote, state, cache) {
  if (newNote !== 'スキップ' && newNote !== 'なし' && newNote.length > VALIDATION_LIMITS.NOTE_MAX_LENGTH) {
    const errorMessage = getModificationNotePromptMessage(state.currentNote);
    errorMessage.text = formatMessage(MESSAGES.modification.noteTooLong, VALIDATION_LIMITS.NOTE_MAX_LENGTH);
    replyToLine(replyToken, [errorMessage]);
    return;
  }

  const finalItem = state.newItem || state.currentItem;
  let finalNote = state.currentNote;
  if (newNote !== 'スキップ') {
    finalNote = (newNote === 'なし') ? '-' : newNote;
  }

  const sanitizedItem = _sanitizeInput(finalItem);
  const sanitizedNote = _sanitizeInput(finalNote);
  const success = updateSchedule(userId, state.day, sanitizedItem, sanitizedNote);
  cache.remove(userId);

  if (success) {
    const title = '✅ 予定を更新しました';
    const altText = `【${state.day}】の予定を「${finalItem}」に更新しました。`;
    const flexMessage = createSingleDayFlexMessage(title, state.day, finalItem, finalNote, altText, true);
    replyToLine(replyToken, [flexMessage]);
  } else {
    replyToLine(replyToken, [getMenuMessage(MESSAGES.error.updateFailed)]);
  }
}

// --- リマインダー送信 ---------------------------------------------------------

/**
 * 設定された時刻にリマインダーを送信します。（トリガー実行用）
 */
function sendReminders() {
  try {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
    const allUsersData = getActiveUsers();
    if (!allUsersData || allUsersData.length === 0) {
      return;
    }

    const allSchedules = getAllSchedules();
    if (!allSchedules) return;

    allUsersData.forEach(userRow => {
      const userId = userRow[COLUMNS_USER.USER_ID];
      const userSchedules = allSchedules.filter(row => row[COLUMNS_SCHEDULE.USER_ID] === userId);

      const reminderTimeNight = userRow[COLUMNS_USER.REMINDER_TIME_NIGHT];

      if (_isTimeToSend(now, reminderTimeNight)) {
        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);
        const dayOfWeek = tomorrow.getDay();
        const targetDayIndex = (dayOfWeek === 0) ? 6 : dayOfWeek - 1;
        const targetDay = WEEKDAYS_FULL[targetDayIndex];
        _sendReminderMessage(userId, userSchedules, targetDay, 'night');
      }

      const reminderTimeMorning = userRow[COLUMNS_USER.REMINDER_TIME_MORNING];

      if (_isTimeToSend(now, reminderTimeMorning)) {
        const dayOfWeek = now.getDay();
        const targetDayIndex = (dayOfWeek === 0) ? 6 : dayOfWeek - 1;
        const targetDay = WEEKDAYS_FULL[targetDayIndex];
        _sendReminderMessage(userId, userSchedules, targetDay, 'morning');
      }
    });
  } catch (err) {
    writeLog('CRITICAL', `sendRemindersでエラーが発生: ${err.stack}`, 'SYSTEM');
  }
}

/**
 * 現在時刻が指定された通知時刻（±トリガー間隔）であるか判定します。
 * @private
 */
function _isTimeToSend(now, timeString) {
  if (typeof timeString !== 'string' || !/^\d{1,2}:\d{2}$/.test(timeString)) {
    return false;
  }
  const [hour, minute] = timeString.split(':');
  const targetDate = new Date(now);
  targetDate.setHours(parseInt(hour, 10), parseInt(minute, 10), 0, 0);
  
  const timeDiff = now.getTime() - targetDate.getTime();
  const shouldSend = timeDiff >= 0 && timeDiff < TRIGGER_INTERVAL_MINUTES * 60 * 1000;

  return shouldSend;
}

/**
 * リマインダーメッセージを送信するヘルパー関数
 * @private
 */
function _sendReminderMessage(userId, userSchedules, targetDay, type) {
  const schedule = userSchedules.find(row => row[COLUMNS_SCHEDULE.DAY_OF_WEEK] === targetDay);
  if (!schedule) {
    return;
  }

  const item = schedule[COLUMNS_SCHEDULE.GARBAGE_TYPE];
  const note = schedule[COLUMNS_SCHEDULE.NOTES];
  
  let title, dayText;
  if (type === 'night') {
    title = 'リマインダー🔔 (夜)';
    dayText = `明日のごみ (${targetDay})`;
  } else {
    title = 'リマインダー☀️ (朝)';
    dayText = `今日のごみ (${targetDay})`;
  }

  const altText = `【リマインダー】${dayText.split(' ')[0]}のごみは「${item}」です。`;
  const flexMessage = createSingleDayFlexMessage(title, dayText, item, note, altText, true);
  
  pushToLine(userId, [flexMessage]);
  writeLog('INFO', `${type === 'night' ? '夜' : '朝'}リマインダー送信`, userId);
}