import React, { useEffect, useState } from 'react';
import { View, Text, Button, Alert, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCATION_TASK_NAME = 'background-location-task';

// Task Manager untuk menangani lokasi latar belakang
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Error in background location task:', error);
    return;
  }
  
  if (data) {
    const { locations } = data;
    const location = locations[0];
    
    // Simpan lokasi ke AsyncStorage
    const locationData = {
      timestamp: new Date().toISOString(),
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
    
    // Ambil data lokasi yang sudah ada
    const existingLogs = await AsyncStorage.getItem('locationLogs');
    const parsedLogs = JSON.parse(existingLogs || '[]');
    
    // Tambahkan lokasi baru ke logs
    parsedLogs.push(locationData);
    
    // Simpan kembali ke AsyncStorage
    await AsyncStorage.setItem('locationLogs', JSON.stringify(parsedLogs));
  }
});

const CheckInScreen = ({ navigation }) => {
  const [isTracking, setIsTracking] = useState(false);

  useEffect(() => {
    checkTrackingStatus();
  }, []);

  // Mengecek apakah background task sudah aktif
  const checkTrackingStatus = async () => {
    const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    setIsTracking(hasStarted);
  };

  // Helper untuk waktu lokal (WIB)
  function getLocalISOString(offsetHours = 7) {
    const now = new Date();
    now.setHours(now.getHours() + offsetHours);
    return now.toISOString().slice(0, 19); // yyyy-MM-ddTHH:mm:ss
  }

  // Fungsi check-in awal
  const handleCheckIn = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Izin lokasi diperlukan untuk check-in.');
        return;
      }
      let loc;
      try {
        loc = await Location.getCurrentPositionAsync({});
      } catch (e) {
        Alert.alert('Gagal mendapatkan lokasi. Pastikan GPS aktif.');
        return;
      }
      if (!loc?.coords) {
        Alert.alert('Data lokasi tidak valid.');
        return;
      }
      const checkInData = {
        timestamp: getLocalISOString(),
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };
      try {
        await AsyncStorage.setItem('CheckinLocations', JSON.stringify(checkInData));
      } catch (e) {
        Alert.alert('Gagal menyimpan data check-in.');
        return;
      }
      await startBackgroundTracking();
      navigation.navigate('MapTrackingScreen');
    } catch (err) {
      Alert.alert('Terjadi error saat check-in.', err?.message || '');
    }
  };

  // Mulai tracking lokasi di background
  const startBackgroundTracking = async () => {
    const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
    if (bgStatus !== 'granted') {
      Alert.alert('Izin lokasi latar belakang diperlukan.');
      return;
    }

    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.High,
      timeInterval: 2 * 60 * 1000, // 2 menit
      distanceInterval: 10, // 10 meter
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Tracking lokasi aktif',
        notificationBody: 'Aplikasi sedang melacak lokasimu.',
      },
    });

    setIsTracking(true);
  };

  // Berhenti tracking
  const stopBackgroundTracking = async () => {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    setIsTracking(false);
    Alert.alert('Tracking dihentikan');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Check-In & Background Tracking</Text>
      <Button title="Check-In dan Mulai Tracking" onPress={handleCheckIn} />
      {isTracking && (
        <Button title="Hentikan Tracking" onPress={stopBackgroundTracking} color="red" />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  title: { fontSize: 20, marginBottom: 20 },
});

export default CheckInScreen;
