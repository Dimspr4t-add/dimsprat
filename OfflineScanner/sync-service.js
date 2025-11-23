// sync-service.js
class SyncService {
  constructor() {
    this.dbName = 'OfflineScannerDB';
    this.dbVersion = 4; // Versi database
    this.lastSyncTime = null;
    this.syncInProgress = false;
  }

  // Inisialisasi service
  async init() {
    // Daftarkan background sync
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.sync.register('sync-database');
        console.log('Background sync terdaftar');
      } catch (e) {
        console.warn('Gagal mendaftarkan background sync', e);
      }
    }
    
    // Muat waktu sinkronisasi terakhir
    this.lastSyncTime = localStorage.getItem('lastSyncTime');
    return this.checkForUpdates();
  }

  // Periksa pembaruan
  async checkForUpdates() {
    if (this.syncInProgress || !navigator.onLine) return;
    
    try {
      this.syncInProgress = true;
      const response = await fetch(`${window.AppConfig.GAS_URL}?action=checkForUpdates&lastSync=${this.lastSyncTime || ''}`);
      const data = await response.json();
      
      if (data.needsUpdate) {
        await this.downloadDatabase();
        this.lastSyncTime = new Date().toISOString();
        localStorage.setItem('lastSyncTime', this.lastSyncTime);
        this.triggerUpdateEvent('databaseUpdated', { lastSync: this.lastSyncTime });
      }
    } catch (error) {
      console.error('Gagal memeriksa pembaruan:', error);
      this.triggerUpdateEvent('syncError', { error: error.message });
    } finally {
      this.syncInProgress = false;
    }
  }

  // Unduh database dari server
  async downloadDatabase() {
    try {
      const [tickets, otsTickets] = await Promise.all([
        this.fetchData('getTickets'),
        this.fetchData('getOtsTickets')
      ]);

      await this.updateLocalDatabase({
        tickets: tickets.data,
        otsTickets: otsTickets.data
      });

      return true;
    } catch (error) {
      console.error('Gagal mengunduh database:', error);
      throw error;
    }
  }

  // Ambil data dari server
  async fetchData(action) {
    const response = await fetch(`${window.AppConfig.GAS_URL}?action=${action}`);
    if (!response.ok) throw new Error('Gagal mengambil data');
    return response.json();
  }

  // Perbarui database lokal
  async updateLocalDatabase(data) {
    const db = await this.openDatabase();
    const tx = db.transaction(['tickets', 'otsTickets'], 'readwrite');
    
    // Hapus data lama
    await Promise.all([
      tx.objectStore('tickets').clear(),
      tx.objectStore('otsTickets').clear()
    ]);

    // Tambahkan data baru
    await Promise.all([
      ...data.tickets.map(ticket => 
        tx.objectStore('tickets').put(ticket)
      ),
      ...data.otsTickets.map(ticket => 
        tx.objectStore('otsTickets').put(ticket)
      )
    ]);

    return tx.complete;
  }

  // Buka koneksi database
  openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Buat store untuk tiket
        if (!db.objectStoreNames.contains('tickets')) {
          const store = db.createObjectStore('tickets', { keyPath: 'id' });
          store.createIndex('status', 'status', { unique: false });
        }
        
        // Buat store untuk tiket OTS
        if (!db.objectStoreNames.contains('otsTickets')) {
          const store = db.createObjectStore('otsTickets', { keyPath: 'id' });
          store.createIndex('status', 'status', { unique: false });
        }

        // Buat store untuk antrian sinkronisasi
        if (!db.objectStoreNames.contains('syncQueue')) {
          db.createObjectStore('syncQueue', { 
            keyPath: 'id',
            autoIncrement: true 
          });
        }
      };

      request.onsuccess = (event) => resolve(event.target.result);
      request.onerror = (event) => reject(event.target.error);
    });
  }

  // Validasi tiket offline
  async validateTicketOffline(ticketId) {
    try {
      const db = await this.openDatabase();
      const tx = db.transaction(['tickets'], 'readonly');
      const store = tx.objectStore('tickets');
      const ticket = await store.get(ticketId);
      
      if (ticket) {
        return {
          valid: true,
          data: ticket,
          status: 'offline',
          message: 'Data dari cache offline'
        };
      }
      return { 
        valid: false, 
        status: 'offline', 
        message: 'Tiket tidak ditemukan' 
      };
    } catch (error) {
      console.error('Error validasi offline:', error);
      return { 
        valid: false, 
        status: 'error', 
        message: 'Gagal memvalidasi tiket' 
      };
    }
  }

  // Tandai tiket sebagai digunakan (offline)
  async markTicketAsUsedOffline(ticketId) {
    try {
      const db = await this.openDatabase();
      const tx = db.transaction(['tickets', 'syncQueue'], 'readwrite');
      
      // Update status tiket
      const ticket = await tx.objectStore('tickets').get(ticketId);
      if (ticket) {
        ticket.status = 'used';
        ticket.usedAt = new Date().toISOString();
        await tx.objectStore('tickets').put(ticket);
      }
      
      // Tambahkan ke antrian sinkronisasi
      await tx.objectStore('syncQueue').add({
        action: 'markTicketUsed',
        data: { ticketId },
        timestamp: new Date().getTime(),
        status: 'pending'
      });

      return true;
    } catch (error) {
      console.error('Gagal menandai tiket:', error);
      throw error;
    }
  }

  // Sinkronkan antrian
  async processSyncQueue() {
    if (!navigator.onLine) return false;
    
    try {
      const db = await this.openDatabase();
      const tx = db.transaction(['syncQueue'], 'readwrite');
      const queue = tx.objectStore('syncQueue');
      const items = await queue.getAll();
      
      for (const item of items) {
        try {
          // Kirim ke server
          const response = await fetch(window.AppConfig.GAS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: item.action,
              ...item.data
            })
          });
          
          if (response.ok) {
            // Hapus dari antrian jika berhasil
            await queue.delete(item.id);
          }
        } catch (error) {
          console.error('Gagal memproses item sinkronisasi:', error);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Gagal memproses antrian sinkronisasi:', error);
      return false;
    }
  }

  // Event handling
  on(event, callback) {
    document.addEventListener(`sync:${event}`, (e) => callback(e.detail));
  }

  triggerUpdateEvent(eventName, detail) {
    document.dispatchEvent(new CustomEvent(`sync:${eventName}`, { detail }));
  }
}

// Inisialisasi dan ekspos service
window.syncService = new SyncService();
