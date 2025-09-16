import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCATION_TASK_NAME = 'background-location-task';

export async function startBackgroundTracking() {
  // Cek apakah sudah berjalan
  const isActive = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (isActive) {
    console.log('[BG Tracking] Sudah berjalan, skip start ulang');
    return;
  }
  // Request permission jika belum
  const { status, canAskAgain } = await Location.requestBackgroundPermissionsAsync();
  if (status !== 'granted') {
    // Tampilkan alert ke user jika permission belum diberikan
    if (canAskAgain) {
      alert('Aplikasi membutuhkan izin lokasi background. Silakan aktifkan "Allow all the time" di pengaturan aplikasi Android Anda.');
    } else {
      alert('Izin lokasi background ditolak permanen. Silakan aktifkan secara manual di pengaturan aplikasi Android.');
    }
    console.warn('[BG Tracking] Background location permission not granted');
    return;
  }
  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.High,
    timeInterval: 15 * 60000, // 15 menit
    distanceInterval: 200, // 200 meter
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'MLCI Tracking',
      notificationBody: 'Tracking lokasi berjalan di background',
      notificationColor: '#007bff',
    },
  });
  await AsyncStorage.setItem('isTracking', 'true');
  console.log('[BG Tracking] Background tracking dimulai');
}

export async function stopBackgroundTracking() {
  const isActive = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (isActive) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    await AsyncStorage.setItem('isTracking', 'false');
    console.log('[BG Tracking] Background tracking dihentikan');
  } else {
    console.log('[BG Tracking] Tidak ada background tracking yang aktif');
  }
}
