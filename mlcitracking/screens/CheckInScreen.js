import React, { useEffect, useState } from 'react';
import { View, Text, Button, Alert, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Task Manager untuk menangani lokasi latar belakang
// Fungsi hitung jarak haversine (meter)
function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Radius bumi dalam meter
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const CheckInScreen = ({ navigation }) => {
  // Hapus isTracking dari state dan seluruh pemanggilan setIsTracking
  useEffect(() => {
    checkTrackingStatus();
  }, []);

  // Mengecek apakah background task sudah aktif
  const checkTrackingStatus = async () => {
    const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    // Hapus pemanggilan setIsTracking(hasStarted);
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
        type: 'start',
        tipechekin: 'start',
        timestamp: getLocalISOString(),
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };
      try {
        // Ambil data array lama
        const existing = await AsyncStorage.getItem('CheckinLocations');
        let arr = [];
        if (existing) {
          try { arr = JSON.parse(existing); } catch {}
          if (!Array.isArray(arr)) arr = [];
        }
        arr.push(checkInData);
        await AsyncStorage.setItem('CheckinLocations', JSON.stringify(arr));
      } catch (e) {
        Alert.alert('Gagal menyimpan data check-in.');
        return;
      }
      // Tidak lagi trigger startBackgroundTracking atau set isTracking di sini
      navigation.navigate('MapTrackingScreen');
    } catch (err) {
      Alert.alert('Terjadi error saat check-in.', err?.message || '');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Check-In & Background Tracking</Text>
      <Button title="Check-In dan Mulai Tracking" onPress={handleCheckIn} />
      {/* Hapus tombol hentikan tracking */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  title: { fontSize: 20, marginBottom: 20 },
});

export default CheckInScreen;
