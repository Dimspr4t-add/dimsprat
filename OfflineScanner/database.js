// Database configuration
const DB_NAME = 'OfflineScannerDB';
const DB_VERSION = 1;
const STORE_TICKETS = 'tickets';
const STORE_SYNC_QUEUE = 'syncQueue';

let db = null;

// Initialize the database
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('Error opening database:', event.target.error);
      reject('Database error: ' + event.target.error);
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      console.log('Database initialized successfully');
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create object stores if they don't exist
      if (!db.objectStoreNames.contains(STORE_TICKETS)) {
        const ticketStore = db.createObjectStore(STORE_TICKETS, { keyPath: 'ticketId' });
        ticketStore.createIndex('status', 'status', { unique: false });
      }
      
      if (!db.objectStoreNames.contains(STORE_SYNC_QUEUE)) {
        const syncStore = db.createObjectStore(STORE_SYNC_QUEUE, { 
          keyPath: 'id',
          autoIncrement: true 
        });
        syncStore.createIndex('status', 'status', { unique: false });
      }
    };
  });
}

// Ticket operations
async function saveTicket(ticket) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_TICKETS], 'readwrite');
    const store = transaction.objectStore(STORE_TICKETS);
    
    const request = store.put(ticket);
    
    request.onsuccess = () => resolve(ticket);
    request.onerror = (event) => {
      console.error('Error saving ticket:', event.target.error);
      reject('Error saving ticket: ' + event.target.error);
    };
  });
}

async function getTicket(ticketId) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_TICKETS], 'readonly');
    const store = transaction.objectStore(STORE_TICKETS);
    
    const request = store.get(ticketId);
    
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = (event) => {
      console.error('Error getting ticket:', event.target.error);
      reject('Error getting ticket: ' + event.target.error);
    };
  });
}

async function updateTicketStatus(ticketId, status) {
  return new Promise(async (resolve, reject) => {
    const ticket = await getTicket(ticketId);
    if (!ticket) {
      reject('Ticket not found');
      return;
    }
    
    ticket.status = status;
    ticket.lastUpdated = new Date().toISOString();
    
    const transaction = db.transaction([STORE_TICKETS], 'readwrite');
    const store = transaction.objectStore(STORE_TICKETS);
    
    const request = store.put(ticket);
    
    request.onsuccess = () => resolve(ticket);
    request.onerror = (event) => {
      console.error('Error updating ticket:', event.target.error);
      reject('Error updating ticket: ' + event.target.error);
    };
  });
}

// Sync queue operations
async function addToSyncQueue(action, data) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_SYNC_QUEUE], 'readwrite');
    const store = transaction.objectStore(STORE_SYNC_QUEUE);
    
    const item = {
      action,
      data,
      status: 'pending',
      createdAt: new Date().toISOString(),
      retryCount: 0
    };
    
    const request = store.add(item);
    
    request.onsuccess = () => resolve(item);
    request.onerror = (event) => {
      console.error('Error adding to sync queue:', event.target.error);
      reject('Error adding to sync queue: ' + event.target.error);
    };
  });
}

async function getPendingSyncItems() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_SYNC_QUEUE], 'readonly');
    const store = transaction.objectStore(STORE_SYNC_QUEUE);
    const index = store.index('status');
    
    const request = index.getAll('pending');
    
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = (event) => {
      console.error('Error getting pending sync items:', event.target.error);
      reject('Error getting pending sync items: ' + event.target.error);
    };
  });
}

async function updateSyncItemStatus(id, status, error = null) {
  return new Promise(async (resolve, reject) => {
    const transaction = db.transaction([STORE_SYNC_QUEUE], 'readwrite');
    const store = transaction.objectStore(STORE_SYNC_QUEUE);
    
    const getRequest = store.get(id);
    
    getRequest.onsuccess = () => {
      const item = getRequest.result;
      if (!item) {
        reject('Sync item not found');
        return;
      }
      
      item.status = status;
      item.updatedAt = new Date().toISOString();
      
      if (status === 'failed') {
        item.retryCount = (item.retryCount || 0) + 1;
        item.lastError = error ? error.message || String(error) : null;
      }
      
      const updateRequest = store.put(item);
      
      updateRequest.onsuccess = () => resolve(item);
      updateRequest.onerror = (event) => {
        console.error('Error updating sync item:', event.target.error);
        reject('Error updating sync item: ' + event.target.error);
      };
    };
    
    getRequest.onerror = (event) => {
      console.error('Error getting sync item:', event.target.error);
      reject('Error getting sync item: ' + event.target.error);
    };
  });
}

// Initialize database when this module is loaded
initDB().catch(console.error);

// Export functions
window.OfflineDB = {
  // Ticket operations
  saveTicket,
  getTicket,
  updateTicketStatus,
  
  // Sync queue operations
  addToSyncQueue,
  getPendingSyncItems,
  updateSyncItemStatus,
  
  // Constants
  STORE_TICKETS,
  STORE_SYNC_QUEUE
};

// Listen for online/offline events to trigger sync
window.addEventListener('online', () => {
  console.log('Online, checking for pending sync items...');
  // This will be implemented in the sync-manager.js
});

// Service Worker registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js')
      .then(registration => {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
      })
      .catch(error => {
        console.error('ServiceWorker registration failed: ', error);
      });
  });
}
