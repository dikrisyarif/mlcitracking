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
    console.log('[BG Tracking] Task dieksekusi:', new Date().toISOString());
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
      // Gunakan timestamp unik (milidetik) agar tidak duplikat
      const now = new Date();
      const uniqueTimestamp = `${getLocalWIBString(now)}.${now.getMilliseconds()}`;
      const newLocation = {
        timestamp: uniqueTimestamp, // timestamp unik
        latitude: locations[0].coords.latitude,
        longitude: locations[0].coords.longitude,
      };
      // Simpan hanya 1 lokasi terakhir ke locationLogs (tidak menumpuk)
      await AsyncStorage.setItem('locationLogs', JSON.stringify([newLocation]));

      // Cek duplikasi: jika timestamp sama dengan record terakhir, skip insert ke server
      if (parsed.length > 0) {
        const lastLog = parsed[parsed.length - 1];
        if (lastLog.timestamp === newLocation.timestamp) {
          console.log('[BG Tracking] Skip tracking insert karena duplikasi timestamp di locationLogs');
          return;
        }
      }
      // Cek duplikasi: jika timestamp sama dengan lastTrackingSentTimestamp di AsyncStorage, skip insert ke server
      const lastTrackingSentTimestamp = await AsyncStorage.getItem('lastTrackingSentTimestamp');
      if (lastTrackingSentTimestamp && lastTrackingSentTimestamp === newLocation.timestamp) {
        console.log('[BG Tracking] Skip tracking insert karena duplikasi timestamp di lastTrackingSentTimestamp');
        return;
      }

      // Kirim ke server (tracking) jika sudah >= 2 menit dari pengiriman terakhir
      const lastSentStr = await AsyncStorage.getItem('lastTrackingSent');
      let lastSent = 0;
      if (lastSentStr) {
        try { lastSent = parseInt(lastSentStr, 10); } catch {}
      }
      const currTime = Date.now();
      if (currTime - lastSent < 2 * 60 * 1000) {
        console.log('[BG Tracking] Skip tracking insert karena limiter 2 menit');
        return;
      }
      // Untuk testing, tracking akan dipanggil setiap 30 detik tanpa limiter
      // const currTime = Date.now();
      // Kirim ke server (tracking) jika ada user login
      const userInfoStr = await SecureStore.getItemAsync('userInfo');
      if (userInfoStr) {
        const userInfo = JSON.parse(userInfoStr);
        if (userInfo && userInfo.UserName) {
          try {
            console.log('[BG Tracking] Akan kirim tracking ke server:', {
              EmployeeName: userInfo.UserName,
              Lattitude: newLocation.latitude,
              Longtitude: newLocation.longitude,
              CreatedDate: newLocation.timestamp,
              tipechekin: 'tracking',
            });
            const result = await saveCheckinToServer({
              EmployeeName: userInfo.UserName,
              Lattitude: newLocation.latitude,
              Longtitude: newLocation.longitude,
              CreatedDate: newLocation.timestamp,
              tipechekin: 'tracking',
            });
            await AsyncStorage.setItem('lastTrackingSent', String(currTime));
            await AsyncStorage.setItem('lastTrackingSentTimestamp', newLocation.timestamp);
            console.log('[BG Tracking] Tracking berhasil dikirim:', {
              result,
              lokasi: newLocation,
              waktu: new Date().toISOString(),
            });
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
        // Jika tracking < 10 detik dari check-in start, skip insert ke server
        if (Math.abs(currTime - lastCheckinStart) < 10 * 1000) {
          console.log('[BG Tracking] Skip tracking insert karena baru saja start');
          return;
        }
      }
    } catch (e) {
      console.error('Failed to save location logs', e);
    }
  }
});
