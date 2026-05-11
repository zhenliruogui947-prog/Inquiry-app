// ============================================================
// Inquiry-app — 問い合わせ工数集計ツール
// ============================================================

const SS_NAME = '問い合わせ工数集計データ';

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('問い合わせ工数集計')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ---- スプレッドシート初期化 ----

function getSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  let ssId = props.getProperty('SPREADSHEET_ID');

  if (ssId) {
    try {
      return SpreadsheetApp.openById(ssId);
    } catch (e) {
      props.deleteProperty('SPREADSHEET_ID');
    }
  }

  const ss = SpreadsheetApp.create(SS_NAME);
  ssId = ss.getId();
  props.setProperty('SPREADSHEET_ID', ssId);

  // ログシート
  const logSheet = ss.getActiveSheet().setName('ログ');
  logSheet.appendRow(['日時', 'カテゴリ', '工数(分)', 'メモ']);
  logSheet.getRange(1, 1, 1, 4)
    .setFontWeight('bold')
    .setBackground('#1a73e8')
    .setFontColor('#ffffff');
  logSheet.setFrozenRows(1);
  logSheet.setColumnWidth(1, 160);
  logSheet.setColumnWidth(2, 160);

  // カテゴリマスタシート
  const catSheet = ss.insertSheet('カテゴリ');
  catSheet.appendRow(['カテゴリ名']);
  catSheet.getRange(1, 1)
    .setFontWeight('bold')
    .setBackground('#1a73e8')
    .setFontColor('#ffffff');
  catSheet.getRange(2, 1, 5, 1).setValues([
    ['システムエラー対応'],
    ['操作方法の説明'],
    ['データ修正依頼'],
    ['アカウント管理'],
    ['その他'],
  ]);
  catSheet.setColumnWidth(1, 200);

  return ss;
}

// ---- API: カテゴリ一覧取得 ----

function getCategories() {
  const sheet = getSpreadsheet_().getSheetByName('カテゴリ');
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, 1, lastRow - 1, 1).getValues()
    .map(r => r[0])
    .filter(v => v !== '');
}

// ---- API: 工数を記録 ----

function saveInquiry(category, minutes, memo) {
  const sheet = getSpreadsheet_().getSheetByName('ログ');
  sheet.appendRow([new Date(), category, Number(minutes), memo || '']);
  SpreadsheetApp.flush();
  return { success: true };
}

// ---- API: 集計データ取得 ----

function getSummary(startDate, endDate) {
  const sheet = getSpreadsheet_().getSheetByName('ログ');
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const data = sheet.getRange(2, 1, lastRow - 1, 4).getValues();

  const start = startDate ? parseLocalDate_(startDate) : null;
  const end   = endDate   ? parseLocalDate_(endDate, true) : null;

  const map = {};
  data.forEach(row => {
    const ts  = new Date(row[0]);
    const cat = String(row[1]);
    const min = Number(row[2]);
    if (!cat || isNaN(min) || min <= 0) return;
    if (start && ts < start) return;
    if (end   && ts > end)   return;

    if (!map[cat]) map[cat] = { count: 0, minutes: 0 };
    map[cat].count++;
    map[cat].minutes += min;
  });

  return Object.entries(map)
    .map(([category, v]) => ({ category, count: v.count, minutes: v.minutes }))
    .sort((a, b) => b.minutes - a.minutes);
}

// ---- API: Excel エクスポート ----

function exportToExcel(startDate, endDate) {
  const ss = getSpreadsheet_();
  const summaryData = getSummary(startDate, endDate);

  let sheet = ss.getSheetByName('集計結果');
  if (sheet) {
    sheet.clearContents();
  } else {
    sheet = ss.insertSheet('集計結果');
  }

  const period = buildPeriodLabel_(startDate, endDate);
  sheet.appendRow([`集計期間: ${period}`]);
  sheet.getRange(1, 1).setFontSize(11).setFontWeight('bold');
  sheet.appendRow([]);
  sheet.appendRow(['カテゴリ', '件数', '合計工数(分)', '合計工数(時間)']);
  sheet.getRange(3, 1, 1, 4)
    .setFontWeight('bold')
    .setBackground('#1a73e8')
    .setFontColor('#ffffff');

  if (summaryData.length > 0) {
    const rows = summaryData.map(d => [
      d.category,
      d.count,
      d.minutes,
      Math.round(d.minutes / 60 * 10) / 10,
    ]);
    sheet.getRange(4, 1, rows.length, 4).setValues(rows);

    const totalRow = 4 + rows.length;
    const total = summaryData.reduce(
      (acc, d) => ({ count: acc.count + d.count, minutes: acc.minutes + d.minutes }),
      { count: 0, minutes: 0 }
    );
    sheet.getRange(totalRow, 1, 1, 4)
      .setValues([['合計', total.count, total.minutes, Math.round(total.minutes / 60 * 10) / 10]])
      .setFontWeight('bold')
      .setBackground('#e8f0fe');
  }

  sheet.autoResizeColumns(1, 4);
  SpreadsheetApp.flush();

  return `https://docs.google.com/spreadsheets/d/${ss.getId()}/export?format=xlsx`;
}

// ---- ユーティリティ ----

function parseLocalDate_(dateStr, endOfDay) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return endOfDay
    ? new Date(y, m - 1, d, 23, 59, 59, 999)
    : new Date(y, m - 1, d, 0, 0, 0, 0);
}

function buildPeriodLabel_(startDate, endDate) {
  if (startDate && endDate) return `${startDate} ～ ${endDate}`;
  if (startDate) return `${startDate} 以降`;
  if (endDate)   return `${endDate} まで`;
  return '全期間';
}
