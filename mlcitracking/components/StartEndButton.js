import React, { useState, useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useMap } from '../context/MapContext';
import * as Location from 'expo-location';
import CustomAlert from './CustomAlert';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isStartedApi } from '../api/listApi';
import { useAuth } from '../context/AuthContext';
import { startBackgroundTracking, stopBackgroundTracking } from '../backgroundTrackingManager';

const StartEndButton = ({ isStarted, onPress, checkinLocations: propCheckinLocations }) => {
  const { colors } = useTheme();
  const { addCheckin, checkinLocations: contextCheckinLocations } = useMap();
  const checkinLocations = propCheckinLocations || contextCheckinLocations;
  const { state: authState } = useAuth();
  const [started, setStarted] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [loading, setLoading] = useState(false);

  // Cek status started dari backend saat mount/berubah
  useEffect(() => {
    const fetchStartedStatus = async () => {
      try {
        let employeeName = authState?.userInfo?.UserName || authState?.userInfo?.username;
        if (!employeeName) {
          // fallback ke SecureStore jika context belum siap
          const userInfoStr = await AsyncStorage.getItem('userInfo');
          if (userInfoStr) {
            const userInfo = JSON.parse(userInfoStr);
            employeeName = userInfo.UserName || userInfo.username;
          }
        }
        if (!employeeName) return;
        const now = new Date();
        const createdDate = now.toISOString();
        const res = await isStartedApi({ EmployeeName: employeeName, CreatedDate: createdDate });
        // Tambahkan log debug
        console.log('[StartEndButton] isStartedApi result:', res);
        if (res?.Data?.NextAction === 'Start') {
          setStarted(false); // NextAction Start -> tombol Start (belum mulai)
        } else if (res?.Data?.NextAction === 'Stop') {
          setStarted(true); // NextAction Stop -> tombol Stop (sudah mulai)
        }
      } catch (e) {
        // fallback ke local jika error
        console.log('[StartEndButton] isStartedApi error:', e);
      }
    };
    fetchStartedStatus();
  }, [authState?.userInfo, checkinLocations]);

  // useEffect berikut DINONAKTIFKAN agar status tombol hanya dari API
  // useEffect(() => {
  //   const checkTrackingStatus = async () => {
  //     try {
  //       const tracking = await AsyncStorage.getItem('isTracking');
  //       setStarted(tracking === 'true');
  //     } catch {
  //       setStarted(false);
  //     }
  //   };
  //   checkTrackingStatus();
  // }, []);

  // Helper waktu lokal
  function getLocalISOString(offsetHours = 7) {
    const now = new Date();
    now.setHours(now.getHours() + offsetHours);
    return now.toISOString().slice(0, 19);
  }

  // Handle Start
  const handleStart = async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Izin lokasi diperlukan untuk check-in.');
        setLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      if (!loc?.coords) {
        Alert.alert('Data lokasi tidak valid.');
        setLoading(false);
        return;
      }
      // Pastikan EmployeeName tidak kosong
      let employeeName = authState?.userInfo?.UserName || authState?.userInfo?.username;
      if (!employeeName) {
        const userInfoStr = await AsyncStorage.getItem('userInfo');
        if (userInfoStr) {
          const userInfo = JSON.parse(userInfoStr);
          employeeName = userInfo.UserName || userInfo.username;
        }
      }
      if (!employeeName) {
        Alert.alert('User tidak ditemukan, silakan login ulang.');
        setLoading(false);
        return;
      }
      const checkInData = {
        EmployeeName: employeeName,
        type: 'start',
        tipechekin: 'start',
        timestamp: getLocalISOString(),
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };
      console.log('[StartEndButton] handleStart, akan panggil addCheckin:', checkInData);
      await addCheckin(checkInData);
      // Simpan info check-in start ke AsyncStorage untuk filter tracking pertama
      await AsyncStorage.setItem('lastCheckinStartTimestamp', checkInData.timestamp);
      await AsyncStorage.setItem('lastCheckinStartLoc', JSON.stringify({ latitude: checkInData.latitude, longitude: checkInData.longitude }));
      // Pass profile info to global tracking manager for correct logging
      await startBackgroundTracking(authState?.userInfo);
      await AsyncStorage.setItem('isTracking', 'true'); // pastikan update status
      setStarted(true);
      if (onPress) onPress(true);
      console.log('[StartEndButton] handleStart selesai, API sudah dipanggil');
    } catch (err) {
      Alert.alert('Terjadi error saat check-in.', err?.message || '');
      console.log('[StartEndButton] handleStart error:', err);
    }
    setLoading(false);
  };

  // Handle Stop
  const handleStop = async () => {
    setShowAlert(true);
  };

  // Konfirmasi stop
  const confirmStop = async () => {
    setShowAlert(false);
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Izin lokasi diperlukan untuk check-out.');
        setLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      if (!loc?.coords) {
        Alert.alert('Data lokasi tidak valid.');
        setLoading(false);
        return;
      }
      const checkOutData = {
        type: 'stop',
        tipechekin: 'stop',
        timestamp: getLocalISOString(),
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };
      await addCheckin(checkOutData);
      await stopBackgroundTracking(); // Panggil global
      await AsyncStorage.setItem('isTracking', 'false'); // pastikan update status
      setStarted(false);
      if (onPress) onPress(false);
    } catch (err) {
      Alert.alert('Terjadi error saat check-out.', err?.message || '');
    }
    setLoading(false);
  };

  return (
    <>
      <TouchableOpacity
        style={[
          styles.button,
          started
            ? { backgroundColor: '#d32f2f', borderColor: '#d32f2f' }
            : { backgroundColor: colors.button, borderColor: colors.buttonborder },
          { borderWidth: 1 },
        ]}
        onPress={started ? handleStop : handleStart}
        disabled={loading}
      >
        <Text style={styles.buttonText}>{started ? 'Stop' : 'Start'}</Text>
      </TouchableOpacity>
      <CustomAlert
        visible={showAlert}
        onClose={() => setShowAlert(false)}
        onConfirm={confirmStop}
        message="Are you want to finish all job ?"
        mode="confirm"
      />
    </>
  );
};

const styles = StyleSheet.create({
  button: {
    padding: 5,
    borderRadius: 5,
    alignItems: 'center',
    margin: 5,
    width: 200,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
  },
});

export default StartEndButton;