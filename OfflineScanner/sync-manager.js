// Sync Manager for handling background sync and offline data synchronization

// Register sync event in service worker
if ('serviceWorker' in navigator && 'SyncManager' in window) {
  navigator.serviceWorker.ready.then(registration => {
    // Register sync event for offline data
    registration.sync.register('sync-queue').catch(console.error);
  });
}

// Function to process sync queue
async function processSyncQueue() {
  try {
    // Check if we're online
    if (!navigator.onLine) {
      console.log('Offline, cannot process sync queue');
      return;
    }

    // Get pending sync items
    const pendingItems = await window.OfflineDB.getPendingSyncItems();
    
    if (pendingItems.length === 0) {
      console.log('No pending items to sync');
      return;
    }

    console.log(`Processing ${pendingItems.length} pending sync items...`);

    // Process each item in the queue
    for (const item of pendingItems) {
      try {
        console.log(`Processing sync item:`, item);
        
        // Handle different action types
        switch (item.action) {
          case 'addOtsTicket':
            await processOtsTicket(item);
            break;
          // Add more action types as needed
          default:
            console.warn(`Unknown action type: ${item.action}`);
            await window.OfflineDB.updateSyncItemStatus(item.id, 'failed', 'Unknown action type');
        }
      } catch (error) {
        console.error(`Error processing sync item ${item.id}:`, error);
        await window.OfflineDB.updateSyncItemStatus(
          item.id, 
          'failed', 
          error.message || String(error)
        );
      }
    }

    console.log('Sync queue processing complete');
  } catch (error) {
    console.error('Error in sync manager:', error);
  }
}

// Process OTS ticket sync
async function processOtsTicket(syncItem) {
  const { id, data } = syncItem;
  
  try {
    // Call your API to save the OTS ticket
    const response = await fetch(window.AppConfig.GAS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'addOtsTicket',
        ...data
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.status === 'success') {
      // Update the local ticket status to synced
      await window.OfflineDB.updateOtsStatus(data.id, 'synced');
      
      // Mark sync item as completed
      await window.OfflineDB.updateSyncItemStatus(id, 'completed');
      
      // Show notification
      showNotification('Data OTS berhasil disinkronisasi', 'success');
    } else {
      throw new Error(result.message || 'Gagal menyimpan data OTS');
    }
  } catch (error) {
    console.error('Error syncing OTS ticket:', error);
    
    // Update sync status with error
    await window.OfflineDB.updateSyncItemStatus(
      id,
      'failed',
      error.message || 'Gagal menyinkronkan data OTS'
    );
    
    // Show error notification
    showNotification('Gagal menyinkronkan data OTS', 'error');
    
    // Re-throw to be caught by the caller
    throw error;
  }
}

// Helper function to show notifications
function showNotification(message, type = 'info') {
  if (!('Notification' in window)) return;
  
  if (Notification.permission === 'granted') {
    new Notification('Offline Scanner', {
      body: message,
      icon: 'Assets/images/logo.png'
    });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        new Notification('Offline Scanner', {
          body: message,
          icon: 'Assets/images/logo.png'
        });
      }
    });
  }
  
  // Also log to console
  const colors = {
    success: 'green',
    error: 'red',
    warning: 'orange',
    info: 'blue'
  };
  
  console.log(`%c${message}`, `color: ${colors[type] || 'black'}; font-weight: bold;`);
}

// Listen for online/offline events
window.addEventListener('online', () => {
  console.log('Online, checking for pending sync items...');
  processSyncQueue().catch(console.error);
});

// Initialize sync manager when the page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSyncManager);
} else {
  initSyncManager();
}

async function initSyncManager() {
  // Request notification permission
  if ('Notification' in window) {
    try {
      const permission = await Notification.requestPermission();
      console.log('Notification permission:', permission);
    } catch (error) {
      console.error('Error requesting notification permission:', error);
    }
  }
  
  // Process any pending sync items
  if (navigator.onLine) {
    processSyncQueue().catch(console.error);
  }
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    processSyncQueue,
    processOtsTicket,
    showNotification
  };
}
