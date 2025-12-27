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
      
      // ID-less Structure: [TGLP, TGLD, NPSN, NAMA, KEC, JUDUL, KATEGORI]
      // We do NOT prepend ID.
      sheet.appendRow([
        data.tanggal,    // Col A: TGL PROPOSAL
        data.tanggalDiterima || "",  // Col B: TGL DITERIMA
        data.npsn || "",  // Col C: NPSN
        data.namaSekolah, // Col D: NAMA SEKOLAH
        data.kecamatan,   // Col E: KECAMATAN
        data.judulProposal, // Col F: JUDUL PROPOSAL (Was jenisBantuan)
        data.kategoriBantuan || "" // Col G: JENIS BANTUAN (New Manual Input)
      ]);
      
      return responseJSON({ status: 'success', message: 'Data Tersimpan' });

    } else if (action == "update") {
      var data = JSON.parse(e.postData.contents);
      var rowIndex = parseInt(data.id); // ID is Sheet Row Number
      
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = ss.getSheetByName('Proposal');
      
      var lastRow = sheet.getLastRow();
      
      if (rowIndex >= 2 && rowIndex <= lastRow) {
        // Update Columns A, B, C, D, E, F, G (Indices 1 to 7)
        // [TGLP, TGLD, NPSN, NAMA, KEC, JUDUL, KATEGORI]
        
        sheet.getRange(rowIndex, 1).setValue(data.tanggal);     // Col A
        sheet.getRange(rowIndex, 2).setValue(data.tanggalDiterima); // Col B
        sheet.getRange(rowIndex, 3).setValue(data.npsn);        // Col C
        sheet.getRange(rowIndex, 4).setValue(data.namaSekolah); // Col D
        sheet.getRange(rowIndex, 5).setValue(data.kecamatan);   // Col E
        sheet.getRange(rowIndex, 6).setValue(data.judulProposal); // Col F
        sheet.getRange(rowIndex, 7).setValue(data.kategoriBantuan); // Col G
        
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

    } else if (action == "get_jenis_bantuan") {
       var ss = SpreadsheetApp.getActiveSpreadsheet();
       // Try 'Jenis Bantuan' or 'Data Jenis Bantuan' or similar if exact name not guaranteed, but requirement said "Jenis Bantuan"
       var sheet = ss.getSheetByName('Jenis Bantuan');
       
       if (!sheet) {
          // Fallback if sheet not created yet, return empty list or specific error
          return responseJSON({ status: 'failed', message: 'Sheet Jenis Bantuan tidak ditemukan' });
       }
       
       var values = sheet.getDataRange().getValues();
       if (values.length < 2) return responseJSON({ status: 'success', data: [] }); // Header only or empty
       
       var header = values[0];
       var colIdx = -1;
       
       // Find "Jenis Bantuan" column
       for(var i=0; i<header.length; i++) {
          if (String(header[i]).toLowerCase().includes('jenis bantuan')) {
             colIdx = i;
             break;
          }
       }
       
       // Default to first column if not found explicitly but sheet exists (common convention)
       if (colIdx === -1) colIdx = 0;
       
       var uniqueTypes = {};
       var list = [];
       
       for(var i=1; i<values.length; i++) {
          var val = values[i][colIdx];
          if (val && String(val).trim() !== '') {
             var v = String(val).trim();
             if (!uniqueTypes[v]) {
                uniqueTypes[v] = true;
                list.push(v);
             }
          }
       }
       
       
       return responseJSON({ status: 'success', data: list.sort() });

    } else if (action == "get_data_bantuan") {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = ss.getSheetByName('Bantuan');
      
      if (!sheet) {
        return responseJSON({ status: 'failed', message: 'Sheet Bantuan tidak ditemukan' });
      }
      
      // Get all data
      var values = sheet.getDataRange().getDisplayValues();
      if (values.length < 2) return responseJSON({ status: 'success', data: [] });
      
      var header = values[0];
      
      // Dynamic Column Finding
      // Need: Sumber Dana, NPSN, Nama Sekolah, Kecamatan, Kegiatan
      var colSumber = -1, colNpsn = -1, colNama = -1, colKec = -1, colKegiatan = -1;
      
      for(var i=0; i<header.length; i++) {
        var h = String(header[i]).toLowerCase();
        if (h.includes('sumber') && h.includes('dana')) colSumber = i;
        else if (h === 'npsn') colNpsn = i;
        else if (h.includes('nama') && h.includes('sekolah')) colNama = i;
        else if (h === 'kecamatan') colKec = i;
        else if (h === 'kegiatan') colKegiatan = i;
      }
      
      // Secondary check if specific names failed
      if (colNama === -1) {
         for(var i=0; i<header.length; i++) { if(String(header[i]).toLowerCase().includes('nama')) { colNama = i; break; } }
      }
      
      // Fallbacks (indices based on request order if header detection fails: Sumber Dana, NPSN, Nama Sekolah, Kecamatan, Kegiatan)
      if (colSumber === -1) colSumber = 0;
      if (colNpsn === -1) colNpsn = 1;
      if (colNama === -1) colNama = 2;
      if (colKec === -1) colKec = 3;
      if (colKegiatan === -1) colKegiatan = 4;
      
      var result = [];
      for(var i=1; i<values.length; i++) {
        var npsn = values[i][colNpsn];
        var sumber = (colSumber !== -1) ? values[i][colSumber] : "";
        var nama = (colNama !== -1) ? values[i][colNama] : "";
        var kec = (colKec !== -1) ? values[i][colKec] : "";
        var kegiatan = (colKegiatan !== -1) ? values[i][colKegiatan] : "";
        
        // Push even if empty? Usually yes for a list. Or filter by NPSN? 
        // Let's include everything that has at least some content
        if (npsn || nama) {
           result.push({
             sumberDana: sumber,
             npsn: String(npsn).trim(),
             namaSekolah: nama,
             kecamatan: kec,
             kegiatan: kegiatan
           });
        }
      }
      
      return responseJSON({ status: 'success', data: result });

    } else if (action == "get_data_kerusakan") {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = ss.getSheetByName('Kerusakan');
      
      if (!sheet) {
        return responseJSON({ status: 'failed', message: 'Sheet Kerusakan tidak ditemukan' });
      }
      
      var values = sheet.getDataRange().getDisplayValues();
      if (values.length < 2) return responseJSON({ status: 'success', data: [] });
      
      var header = values[0];
      
      // Columns: TGL SURAT, TGL DITERIMA, TGL KEJADIAN, NPSN, NAMA SEKOLAH, KECAMATAN, DAMPAK KERUSAKAN
      var colSurat = -1, colTerima = -1, colKejadian = -1;
      var colNpsn = -1, colNama = -1, colKec = -1, colDampak = -1;
      
      for(var i=0; i<header.length; i++) {
        var h = String(header[i]).toLowerCase();
        if (h.includes('tgl') && h.includes('surat')) colSurat = i;
        else if (h.includes('tgl') && h.includes('diterima')) colTerima = i;
        else if (h.includes('tgl') && h.includes('kejadian')) colKejadian = i;
        else if (h === 'npsn') colNpsn = i;
        else if (h.includes('nama') && h.includes('sekolah')) colNama = i;
        else if (h === 'kecamatan') colKec = i;
        else if (h.includes('dampak') && h.includes('kerusakan')) colDampak = i;
      }
      
      // Fallback Search for Nama
      if (colNama === -1) {
         for(var i=0; i<header.length; i++) { if(String(header[i]).toLowerCase().includes('nama')) { colNama = i; break; } }
      }
      
      var result = [];
      for(var i=1; i<values.length; i++) {
        var npsn = (colNpsn !== -1) ? values[i][colNpsn] : "";
        var nama = (colNama !== -1) ? values[i][colNama] : "";
        
        if (npsn || nama) {
           result.push({
             tglSurat: (colSurat !== -1) ? values[i][colSurat] : "",
             tglDiterima: (colTerima !== -1) ? values[i][colTerima] : "",
             tglKejadian: (colKejadian !== -1) ? values[i][colKejadian] : "",
             npsn: String(npsn).trim(),
             namaSekolah: nama,
             kecamatan: (colKec !== -1) ? values[i][colKec] : "",
             dampakKerusakan: (colDampak !== -1) ? values[i][colDampak] : ""
           });
        }
      }
      
      return responseJSON({ status: 'success', data: result });

    } else if (action == "baca" || action == "read") {
       // Default: Ambil Data (BACA)
       var ss = SpreadsheetApp.getActiveSpreadsheet();
       var sheet = ss.getSheetByName('Proposal');
       var data = sheet.getDataRange().getDisplayValues();
       
       data.shift(); // Hapus header
       
       // Inject Row Index as ID at position 0
       var resultWithId = data.map(function(row, index) {
          var sheetRow = index + 2; 
          return [sheetRow].concat(row);
       });
       
       return responseJSON({ status: 'success', data: resultWithId });

    } else {
       // 404 Not Found Handling
       return responseJSON({ 
         status: 'error', 
         message: 'Endpoint or Action not found (404)',
         code: 404 
       });
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