const SHEET_NAME = 'Meals';
const PHOTO_FOLDER_NAME = 'Meal Photos';
const HEADERS = ['id', 'date', 'meal', 'dish', 'notes', 'tags', 'createdAt', 'updatedAt', 'photoFileId', 'photoUrl'];

function doGet(e) {
  ensureSheet_();
  const page = String((e && e.parameter && e.parameter.page) || 'view').toLowerCase();
  const fileName = page === 'admin' ? 'admin' : 'view';
  const title = page === 'admin' ? '献立管理' : '献立を見る';
  const template = HtmlService.createTemplateFromFile(fileName);
  template.appUrl = ScriptApp.getService().getUrl();

  return template
    .evaluate()
    .setTitle(title)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}


function getMeals(filters) {
  const sheet = ensureSheet_();
  const rows = sheet.getDataRange().getValues();
  const query = normalizeFilters_(filters || {});
  const data = rows.slice(1).map(rowToMeal_).filter(Boolean);

  return data
    .filter(meal => {
      if (query.from && meal.date < query.from) return false;
      if (query.to && meal.date > query.to) return false;
      if (query.meal && meal.meal !== query.meal) return false;
      if (query.search) {
        const haystack = `${meal.dish} ${meal.notes} ${meal.tags}`.toLowerCase();
        if (!haystack.includes(query.search)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (a.date === b.date) return mealOrder_(b.meal) - mealOrder_(a.meal);
      return a.date < b.date ? 1 : -1;
    });
}

function saveMeal(input) {
  const sheet = ensureSheet_();
  const meal = sanitizeMeal_(input);
  const now = new Date().toISOString();
  const photo = savePhoto_(meal.photoDataUrl, meal.photoName);

  if (meal.id) {
    const rowNumber = findRowById_(sheet, meal.id);
    if (rowNumber) {
      const current = rowToMeal_(sheet.getRange(rowNumber, 1, 1, HEADERS.length).getValues()[0]);
      if ((photo.fileId || meal.removePhoto) && current.photoFileId) trashPhoto_(current.photoFileId);
      const updated = {
        id: meal.id,
        date: meal.date,
        meal: meal.meal,
        dish: meal.dish,
        notes: meal.notes,
        tags: meal.tags,
        photoFileId: photo.fileId || (meal.removePhoto ? '' : current.photoFileId),
        photoUrl: photo.url || (meal.removePhoto ? '' : current.photoUrl),
        createdAt: current.createdAt || now,
        updatedAt: now
      };
      sheet.getRange(rowNumber, 1, 1, HEADERS.length).setValues([mealToRow_(updated)]);
      return updated;
    }
  }

  const created = {
    id: Utilities.getUuid(),
    date: meal.date,
    meal: meal.meal,
    dish: meal.dish,
    notes: meal.notes,
    tags: meal.tags,
    photoFileId: photo.fileId,
    photoUrl: photo.url,
    createdAt: now,
    updatedAt: now
  };
  sheet.appendRow(mealToRow_(created));
  return created;
}

function deleteMeal(id) {
  if (!id) throw new Error('削除対象が指定されていません。');
  const sheet = ensureSheet_();
  const rowNumber = findRowById_(sheet, id);
  if (!rowNumber) throw new Error('対象の記録が見つかりません。');
  sheet.deleteRow(rowNumber);
  return true;
}

function getInitialData() {
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const week = getWeekRange_(new Date());
  return {
    today,
    meals: getMeals({ from: week.from, to: week.to })
  };
}

function getWeekRange_(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = start.getDay();
  start.setDate(start.getDate() - ((day + 6) % 7));
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  end.setDate(end.getDate() + 6);
  return {
    from: Utilities.formatDate(start, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
    to: Utilities.formatDate(end, Session.getScriptTimeZone(), 'yyyy-MM-dd')
  };
}

function ensureSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(SHEET_NAME);

  const currentHeaders = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const needsHeaders = HEADERS.some((header, index) => currentHeaders[index] !== header);
  if (needsHeaders) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function normalizeFilters_(filters) {
  return {
    from: String(filters.from || '').trim(),
    to: String(filters.to || '').trim(),
    meal: String(filters.meal || '').trim(),
    search: String(filters.search || '').trim().toLowerCase()
  };
}

function sanitizeMeal_(input) {
  const meal = input || {};
  const date = String(meal.date || '').trim();
  const dish = String(meal.dish || '').trim();
  const mealType = String(meal.meal || '').trim();

  if (!date) throw new Error('日付を入力してください。');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('日付の形式が正しくありません。');
  if (!['朝食', '昼食', '夕食', '間食', 'その他'].includes(mealType)) {
    throw new Error('食事区分を選択してください。');
  }
  if (!dish) throw new Error('献立を入力してください。');

  return {
    id: String(meal.id || '').trim(),
    date,
    meal: mealType,
    dish,
    notes: String(meal.notes || '').trim(),
    tags: String(meal.tags || '').trim(),
    photoDataUrl: String(meal.photoDataUrl || ''),
    photoName: String(meal.photoName || '').trim(),
    removePhoto: Boolean(meal.removePhoto)
  };
}

function rowToMeal_(row) {
  if (!row[0]) return null;
  return {
    id: String(row[0]),
    date: formatDateValue_(row[1]),
    meal: String(row[2] || ''),
    dish: String(row[3] || ''),
    notes: String(row[4] || ''),
    tags: String(row[5] || ''),
    createdAt: String(row[6] || ''),
    updatedAt: String(row[7] || ''),
    photoFileId: String(row[8] || ''),
    photoUrl: String(row[9] || '')
  };
}

function mealToRow_(meal) {
  return HEADERS.map(header => meal[header] || '');
}

function findRowById_(sheet, id) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  const index = values.findIndex(row => String(row[0]) === String(id));
  return index === -1 ? null : index + 2;
}

function mealOrder_(meal) {
  const order = {
    '朝': 0,
    '朝食': 0,
    '昼': 1,
    '昼食': 1,
    '夜': 2,
    '夕食': 2,
    '晩': 2,
    '晩ごはん': 2,
    '間食': 3,
    'その他': 4
  };
  return Object.prototype.hasOwnProperty.call(order, meal) ? order[meal] : 99;
}

function formatDateValue_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(value || '');
}

function savePhoto_(dataUrl, originalName) {
  if (!dataUrl) return { fileId: '', url: '' };

  const match = String(dataUrl).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) throw new Error('写真の形式が正しくありません。');

  const mimeType = match[1];
  const bytes = Utilities.base64Decode(match[2]);
  const safeName = String(originalName || 'meal-photo.jpg').replace(/[\\/:*?"<>|]/g, '_');
  const fileName = `${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss')}-${safeName}`;
  const blob = Utilities.newBlob(bytes, mimeType, fileName);
  const folder = getPhotoFolder_();
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return {
    fileId: file.getId(),
    url: getPhotoUrl_(file.getId())
  };
}

function getPhotoFolder_() {
  const spreadsheetFile = DriveApp.getFileById(SpreadsheetApp.getActiveSpreadsheet().getId());
  const parentFolders = spreadsheetFile.getParents();
  const parent = parentFolders.hasNext() ? parentFolders.next() : DriveApp.getRootFolder();
  const folders = parent.getFoldersByName(PHOTO_FOLDER_NAME);
  return folders.hasNext() ? folders.next() : parent.createFolder(PHOTO_FOLDER_NAME);
}

function getPhotoUrl_(fileId) {
  return fileId ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w1200` : '';
}

function trashPhoto_(fileId) {
  try {
    DriveApp.getFileById(fileId).setTrashed(true);
  } catch (error) {
    // The meal record should still save if the old file was already removed.
  }
}
