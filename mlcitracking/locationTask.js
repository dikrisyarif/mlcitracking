import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveCheckinToServer, isStartedApi } from './api/listApi';
import * as SecureStore from 'expo-secure-store';

const LOCATION_TASK_NAME = 'background-location-task';

function getLocalWIBString(date) {
  const pad = n => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function getLocalWIBLogString(date = new Date()) {
  // WIB = UTC+7
  const wibOffset = 7 * 60; // in minutes
  const local = new Date(date.getTime() + (wibOffset - date.getTimezoneOffset()) * 60000);
  const pad = n => n.toString().padStart(2, '0');
  return `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())} ${pad(local.getHours())}:${pad(local.getMinutes())}:${pad(local.getSeconds())}`;
}

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error(error);
    return;
  }
  if (data) {
    console.log('[BG Tracking] Task dieksekusi (WIB):', getLocalWIBLogString());
    const { locations } = data;
    try {
      // Ambil user info
      const userInfoStr = await SecureStore.getItemAsync('userInfo');
      if (!userInfoStr) {
        console.warn('[BG Tracking] userInfo not found in SecureStore');
        return;
      }
      const userInfo = JSON.parse(userInfoStr);
      const employeeName = userInfo?.UserName;
      if (!employeeName) {
        console.warn('[BG Tracking] userInfo.UserName not found:', userInfo);
        return;
      }
      // Cek next action dari API
      const now = new Date();
      const res = await isStartedApi({ EmployeeName: employeeName, CreatedDate: now.toISOString() });
      const nextAction = res?.Data?.NextAction;
      if (nextAction === 'Start') {
        // Sudah harus stop, hentikan background tracking
        const Location = await import('expo-location');
        const isActive = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
        if (isActive) {
          await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
          console.log('[BG Tracking] stopLocationUpdatesAsync dipanggil karena nextAction=Start');
        }
        await AsyncStorage.setItem('isTracking', 'false');
        return;
      }
      // Jika nextAction masih Stop, tracking boleh lanjut
      // Ambil waktu next insert dari storage
      let nextInsertStr = await AsyncStorage.getItem('nextTrackingInsert');
      let nextInsert = 0;
      if (nextInsertStr) {
        try { nextInsert = parseInt(nextInsertStr, 10); } catch {}
      }
      const currTime = Date.now();
      if (currTime < nextInsert) {
        console.log('[BG Tracking] Skip tracking insert, belum waktunya (WIB):', getLocalWIBLogString(new Date(nextInsert)));
        return;
      }
      // Simpan lokasi terbaru
      const nowDate = new Date();
      nowDate.setMilliseconds(0); // bulatkan ke detik
      const wibTimestamp = getLocalWIBString(nowDate); // format lokal WIB tanpa ms
      const newLocation = {
        timestamp: wibTimestamp,
        latitude: locations[0].coords.latitude,
        longitude: locations[0].coords.longitude,
      };
      await AsyncStorage.setItem('locationLogs', JSON.stringify([newLocation]));
      // Cek duplikasi sebelum insert ke server
      const lastSentTimestamp = await AsyncStorage.getItem('lastTrackingSentTimestamp');
      const lastSentLocStr = await AsyncStorage.getItem('lastTrackingSentLoc');
      let isDuplicate = false;
      if (lastSentTimestamp && lastSentLocStr) {
        try {
          const lastLoc = JSON.parse(lastSentLocStr);
          isDuplicate = lastSentTimestamp === newLocation.timestamp &&
            lastLoc.latitude === newLocation.latitude &&
            lastLoc.longitude === newLocation.longitude;
        } catch {}
      }
      // CEGAH tracking terlalu dekat dengan check-in start
      let isTooCloseToCheckin = false;
      const lastCheckinStartTimestamp = await AsyncStorage.getItem('lastCheckinStartTimestamp');
      const lastCheckinStartLocStr = await AsyncStorage.getItem('lastCheckinStartLoc');
      if (lastCheckinStartTimestamp && lastCheckinStartLocStr) {
        try {
          const lastCheckinLoc = JSON.parse(lastCheckinStartLocStr);
          const checkinTime = new Date(lastCheckinStartTimestamp);
          const trackingTime = new Date(newLocation.timestamp);
          const diffMs = Math.abs(trackingTime - checkinTime);
          // Jika < 1 menit dan koordinat sama, skip tracking
          if (diffMs < 60 * 1000 && lastCheckinLoc.latitude === newLocation.latitude && lastCheckinLoc.longitude === newLocation.longitude) {
            isTooCloseToCheckin = true;
          }
        } catch {}
      }
      // Kirim ke server jika bukan duplikat dan tidak terlalu dekat dengan check-in
      if (!isDuplicate && !isTooCloseToCheckin) {
        try {
          console.log('[BG Tracking] Akan kirim tracking ke server:', {
            EmployeeName: employeeName,
            Lattitude: newLocation.latitude,
            Longtitude: newLocation.longitude,
            CreatedDate: newLocation.timestamp,
            tipechekin: 'tracking',
          });
          const result = await saveCheckinToServer({
            EmployeeName: employeeName,
            Lattitude: newLocation.latitude,
            Longtitude: newLocation.longitude,
            CreatedDate: newLocation.timestamp,
            tipechekin: 'tracking',
          });
          await AsyncStorage.setItem('lastTrackingSent', String(currTime));
          await AsyncStorage.setItem('lastTrackingSentTimestamp', newLocation.timestamp);
          await AsyncStorage.setItem('lastTrackingSentLoc', JSON.stringify({ latitude: newLocation.latitude, longitude: newLocation.longitude }));
          // Set waktu next insert = currTime + 2 menit
          const nextAllowed = currTime + 2 * 60 * 1000;
          await AsyncStorage.setItem('nextTrackingInsert', String(nextAllowed));
          console.log('[BG Tracking] Tracking berhasil dikirim, next insert at (WIB):', getLocalWIBLogString(new Date(nextAllowed)));
        } catch (e) {
          console.error('[BG Tracking] Failed to send tracking to server', e);
        }
      } else if (isTooCloseToCheckin) {
        console.log('[BG Tracking] Skip insert: terlalu dekat dengan check-in start');
      } else {
        console.log('[BG Tracking] Skip insert: duplikat timestamp/koordinat');
      }
    } catch (e) {
      console.error('Failed to save location logs', e);
    }
  }
});
