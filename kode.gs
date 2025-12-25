// Code.gs

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  // --- HEADER CORS (PENTING UNTUK LOCALHOST) ---
  // Kita tidak bisa memanipulasi header respons secara penuh di GAS,
  // tapi kita bisa menyusun output JSON yang bersih.
  
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    // 1. Cek parameter action
    var action = e.parameter.action;

    if (action == "login") {
      var data = JSON.parse(e.postData.contents);
      var kode = data.password;

      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = ss.getSheetByName('Admin');
      
      // Fallback if Admin sheet doesn't exist
      if (!sheet) return responseJSON({ status: 'failed', message: 'Sheet Admin tidak ditemukan' });

      var values = sheet.getDataRange().getValues();
      var header = values[0];
      var passColParam = -1;
      
      // Find 'Password' column index (case insensitive)
      for(var i=0; i<header.length; i++){
        if(header[i].toString().toLowerCase() === "password") {
          passColParam = i;
          break;
        }
      }

      if (passColParam === -1) {
         return responseJSON({ status: 'failed', message: 'Kolom Password tidak ditemukan' });
      }

      var found = false;
      for (var j = 1; j < values.length; j++) {
        // Strict equality might fail if sheet has numbers, loose equality is safer for simple codes
        if (values[j][passColParam] == kode) {
          found = true;
          break;
        }
      }

      if (found) {
        return responseJSON({ status: 'success' });
      } else {
        return responseJSON({ status: 'failed', message: 'Kode akses salah' });
      }

    } else if (action == "simpan") {
      // Ambil data dari body POST
      var data = JSON.parse(e.postData.contents);
      
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = ss.getSheetByName('Proposal');
      
      // ID-less Structure: [TGLP, TGLD, NPSN, NAMA, KEC, JUDUL]
      // We do NOT prepend ID.
      sheet.appendRow([
        data.tanggal,    // Col A: TGL PROPOSAL
        data.tanggalDiterima || "",  // Col B: TGL DITERIMA
        data.npsn || "",  // Col C: NPSN
        data.namaSekolah, // Col D: NAMA SEKOLAH
        data.kecamatan,   // Col E: KECAMATAN
        data.jenisBantuan // Col F: JUDUL PROPOSAL
      ]);
      
      return responseJSON({ status: 'success', message: 'Data Tersimpan' });

    } else if (action == "update") {
      var data = JSON.parse(e.postData.contents);
      var rowIndex = parseInt(data.id); // ID is Sheet Row Number
      
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = ss.getSheetByName('Proposal');
      
      var lastRow = sheet.getLastRow();
      
      if (rowIndex >= 2 && rowIndex <= lastRow) {
        // Update Columns A, B, C, D, E, F (Indices 1, 2, 3, 4, 5, 6)
        // [TGLP, TGLD, NPSN, NAMA, KEC, JUDUL]
        
        sheet.getRange(rowIndex, 1).setValue(data.tanggal);     // Col A: TGLP
        sheet.getRange(rowIndex, 2).setValue(data.tanggalDiterima); // Col B: TGLD
        sheet.getRange(rowIndex, 3).setValue(data.npsn);        // Col C: NPSN
        sheet.getRange(rowIndex, 4).setValue(data.namaSekolah); // Col D: NAMA
        sheet.getRange(rowIndex, 5).setValue(data.kecamatan);   // Col E: KEC
        sheet.getRange(rowIndex, 6).setValue(data.jenisBantuan); // Col F: JUDUL
        
        return responseJSON({ status: 'success', message: 'Data Diperbarui' });
      } else {
        return responseJSON({ status: 'failed', message: 'ID/Baris tidak ditemukan' });
      }

    } else if (action == "hapus") {
      var data = JSON.parse(e.postData.contents);
      var id = parseInt(data.id); // ID is now Sheet Row Index
      
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = ss.getSheetByName('Proposal');
      
      // Validate Row Index
      var lastRow = sheet.getLastRow();
      if (id >= 2 && id <= lastRow) {
         sheet.deleteRow(id);
         return responseJSON({ status: 'success', message: 'Data Dihapus' });
      } else {
         return responseJSON({ status: 'failed', message: 'ID tidak valid' });
      }

    } else if (action == "cari_npsn") {
       var npsn = e.parameter.npsn;
       if (!npsn) return responseJSON({ status: 'failed', message: 'NPSN kosong' });

       var ss = SpreadsheetApp.getActiveSpreadsheet();
       // Assuming the sheet name is 'Data Sekolah'
       var sheet = ss.getSheetByName('Data Sekolah');
       
       if (!sheet) return responseJSON({ status: 'failed', message: 'Sheet Data Sekolah tidak ditemukan' });

       // Get header and data
       var values = sheet.getDataRange().getValues();
       if (values.length < 2) return responseJSON({ status: 'failed', message: 'Data Sekolah kosong' });
       
       var header = values[0];
       
       // Dynamic Column Finding
       var colNpsn = -1, colNama = -1, colKec = -1;
       
       for (var i = 0; i < header.length; i++) {
         var h = String(header[i]).toLowerCase();
         if (h === 'npsn') colNpsn = i;
         else if (h.includes('nama') && h.includes('sekolah')) colNama = i;
         else if (h === 'kecamatan') colKec = i;
       }
       
       // Fallbacks if not found exactly (simple contains)
       if (colNama === -1) {
          for(var i=0; i<header.length; i++) { if(String(header[i]).toLowerCase().includes('nama')) { colNama = i; break; } }
       }

       if (colNpsn === -1 || colNama === -1 || colKec === -1) {
          return responseJSON({ status: 'failed', message: 'Kolom referensi (NPSN/Nama/Kecamatan) tidak lengkap di Data Sekolah' });
       }

       // Search
       var result = null;
       for (var i = 1; i < values.length; i++) {
          // Loose comparison for NPSN (string vs number)
          if (values[i][colNpsn] == npsn) {
             result = {
                namaSekolah: values[i][colNama],
                kecamatan: values[i][colKec]
             };
             break;
          }
       }

       if (result) {
         return responseJSON({ status: 'success', data: result });
       } else {
         return responseJSON({ status: 'not_found', message: 'NPSN tidak ditemukan' });
       }

    } else {
      // Default: Ambil Data
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = ss.getSheetByName('Proposal');
      // Use getDisplayValues to avoid Date Object issues and get exact text
      var data = sheet.getDataRange().getDisplayValues();
      
      // Hapus header
      data.shift(); 
      
      // Inject Row Index as ID at position 0
      // Original: [TGLP, TGLD, NAMA, KEC, JUDUL]
      // New: [ROW_INDEX, TGLP, TGLD, NAMA, KEC, JUDUL]
      var resultWithId = data.map(function(row, index) {
         // spreadsheet row index starts at 1, header is 1, data starts at 2.
         // data array index 0 corresponds to spreadsheet row 2.
         // Let's pass "spreadsheet row index" + 1 or just index?
         // We need unique ID. Let's use (index + 2) which is the actual Sheet Row Number.
         // Or simply index works for array logic, but for Update we need row number.
         var sheetRow = index + 2; 
         return [sheetRow].concat(row);
      });
      
      return responseJSON({ status: 'success', data: resultWithId });
    }

  } catch (error) {
    return responseJSON({ status: 'error', message: error.toString() });
  } finally {
    lock.releaseLock();
  }
}

function responseJSON(content) {
  return ContentService
    .createTextOutput(JSON.stringify(content))
    .setMimeType(ContentService.MimeType.JSON);
}