import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveCheckinToServer } from './api/listApi';
import * as SecureStore from 'expo-secure-store';

const LOCATION_TASK_NAME = 'background-location-task';

function getLocalWIBString(date) {
  // Ambil waktu lokal device, tanpa offset tambahan
  const pad = n => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error(error);
    return;
  }
  if (data) {
    const { locations } = data;
    try {
      // Cek apakah sudah ada 'stop' setelah 'start' terakhir
      const checkinJson = await AsyncStorage.getItem('CheckinLocations');
      let checkins = [];
      try {
        checkins = JSON.parse(checkinJson || '[]');
      } catch {}
      const reversed = [...checkins].reverse();
      const lastStartIdx = reversed.findIndex(c => c.tipechekin === 'start');
      if (lastStartIdx !== -1) {
        const stopAfterStart = reversed.slice(0, lastStartIdx).findIndex(c => c.tipechekin === 'stop');
        if (stopAfterStart !== -1) {
          // Sudah ada stop setelah start terakhir, hentikan background tracking
          const Location = await import('expo-location');
          const isActive = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
          if (isActive) {
            await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
            console.log('[BG Tracking] stopLocationUpdatesAsync dipanggil');
          } else {
            console.log('[BG Tracking] Task sudah tidak aktif, skip stopLocationUpdatesAsync');
          }
          await AsyncStorage.setItem('isTracking', 'false');
          console.log('[BG Tracking] Dihentikan karena sudah ada stop setelah start terakhir');
          return;
        }
      }

      const oldData = await AsyncStorage.getItem('locationLogs');
      const parsed = JSON.parse(oldData || '[]');
      const newLocation = {
        timestamp: getLocalWIBString(new Date()), // gunakan waktu lokal device saat task dieksekusi
        latitude: locations[0].coords.latitude,
        longitude: locations[0].coords.longitude,
      };
      // Simpan semua lokasi ke locationLogs
      const updated = [...parsed, newLocation];
      await AsyncStorage.setItem('locationLogs', JSON.stringify(updated));

      // Kirim ke server (tracking) jika sudah >= 2 menit dari pengiriman terakhir
      const lastSentStr = await AsyncStorage.getItem('lastTrackingSent');
      let lastSent = 0;
      if (lastSentStr) {
        try { lastSent = parseInt(lastSentStr, 10); } catch {}
      }
      const currTime = Date.now();
      if (currTime - lastSent < 5 * 60 * 1000) {
        return;
      }
      // Kirim ke server (tracking) jika ada user login
      const userInfoStr = await SecureStore.getItemAsync('userInfo');
      if (userInfoStr) {
        const userInfo = JSON.parse(userInfoStr);
        if (userInfo && userInfo.UserName) {
          try {
            const result = await saveCheckinToServer({
              EmployeeName: userInfo.UserName,
              Lattitude: newLocation.latitude,
              Longtitude: newLocation.longitude,
              CreatedDate: newLocation.timestamp,
              tipechekin: 'tracking',
            });
            await AsyncStorage.setItem('lastTrackingSent', String(currTime));
            console.log('[BG Tracking] saveCheckinToServer result:', result);
          } catch (e) {
            console.error('[BG Tracking] Failed to send tracking to server', e);
          }
        } else {
          console.warn('[BG Tracking] userInfo.UserName not found:', userInfo);
        }
      } else {
        console.warn('[BG Tracking] userInfo not found in SecureStore');
      }

      // Cek apakah tracking terlalu dekat dengan check-in (start)
      const lastCheckinStartStr = await AsyncStorage.getItem('lastCheckinStart');
      if (lastCheckinStartStr) {
        const lastCheckinStart = parseInt(lastCheckinStartStr, 10);
        const currTime = Date.now();
        if (Math.abs(currTime - lastCheckinStart) < 5 * 60 * 1000) {
          // Jika tracking < 1 menit dari check-in, skip insert ke server
          return;
        }
      }
    } catch (e) {
      console.error('Failed to save location logs', e);
    }
  }
});
