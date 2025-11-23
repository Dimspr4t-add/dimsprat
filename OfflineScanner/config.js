// Konfigurasi Aplikasi
const CONFIG = {
  // URL Google Apps Script
  GAS_URL: 'https://script.google.com/macros/s/AKfycbyiFqaZL3D0MY5xfxQEiDy-OVP02EUGKvI95E0qiADP9cb1e7LVqNxoUndxT-IBZ6k/exec',
  
  // Nama sheet dan kolom (sesuaikan dengan spreadsheet Anda)
  SHEET_CONFIG: {
    TICKET_ID_COL: 'ID Tiket',
    STATUS_COL: 'Status',
    TIMESTAMP_COL: 'Waktu Check-in',
    NAME_COL: 'Nama',
    TYPE_COL: 'Tipe',
    EVENT_COL: 'Acara'
  },
  
  // Pengaturan offline
  OFFLINE: {
    ENABLED: true,
    SYNC_INTERVAL: 30000, // 30 detik
    MAX_RETRIES: 3
  }
};

// Ekspor konfigurasi
window.AppConfig = CONFIG;
