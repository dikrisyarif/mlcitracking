// context/MapContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveCheckinToServer } from '../api/listApi';
import { useAuth } from './AuthContext';
import * as Location from 'expo-location';

const MapContext = createContext();

export const MapProvider = ({ children }) => {
  const [checkinLocations, setCheckinLocations] = useState([]);
  const { state } = useAuth();

  const loadCheckinsFromStorage = async () => {
  try {
    const json = await AsyncStorage.getItem('CheckinLocations');
    let parsed;
    try {
      parsed = JSON.parse(json || '[]');
      if (!Array.isArray(parsed)) parsed = [];
    } catch (err) {
      console.error('[MapContext] Invalid JSON format:', err);
      parsed = [];
    }
    setCheckinLocations(parsed);
    // console.log('[MapContext] Loaded check-ins from storage:', parsed);
  } catch (e) {
    console.error('[MapContext] Error loading CheckinLocations:', e);
    setCheckinLocations([]);
  }
};


  const clearCheckins = async () => {
    try {
      await AsyncStorage.removeItem('CheckinLocations');
      setCheckinLocations([]);
      // console.log('[MapContext] Cleared all check-ins');
    } catch (e) {
      console.error('[MapContext] Error clearing checkins:', e);
    }
  };

  // Helper untuk waktu lokal (WIB)
  function getLocalISOString(offsetHours = 7) {
    const now = new Date();
    now.setHours(now.getHours() + offsetHours);
    return now.toISOString().slice(0, 19); // yyyy-MM-ddTHH:mm:ss
  }

  // Helper: Ambil address dari reverse geocode, prioritas street+number, fallback ke city/district, dengan caching
  async function getBestAddress({ latitude, longitude, Address }) {
    if (Address && Address.trim()) return Address;
    if (!latitude || !longitude) return '';
    const cacheKey = `address_${latitude}_${longitude}`;
    try {
      // Cek cache dulu
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) return cached;
      // Jika belum ada di cache, panggil Google API
      const geocode = await Location.reverseGeocodeAsync({ latitude, longitude });
      let bestAddress = '';
      if (geocode && geocode[0]) {
        const g = geocode[0];
        let street = g.street || '';
        let number = g.name || g.streetNumber || '';
        let city = g.city || g.subregion || g.district || g.region || '';
        if (street && number) bestAddress = `${street} No. ${number}`;
        else if (street) bestAddress = street;
        else if (city) bestAddress = city;
      }
      // Simpan ke cache
      if (bestAddress) await AsyncStorage.setItem(cacheKey, bestAddress);
      return bestAddress;
    } catch (err) {
      console.error('[MapContext] Reverse geocode error:', err);
    }
    return '';
  }

  const addCheckin = async (location) => {
    try {
      // Pastikan timestamp lokal
      const locWithLocalTime = {
        ...location,
        timestamp: location.timestamp || getLocalISOString(),
        tipechekin: location.tipechekin || location.type || 'tracking',
      };
      // Cek duplikasi berdasarkan contractId, tipechekin, dan timestamp
      const isDuplicate = checkinLocations.some(
        l => l.contractId === locWithLocalTime.contractId &&
             l.tipechekin === locWithLocalTime.tipechekin &&
             l.timestamp === locWithLocalTime.timestamp
      );
      if (isDuplicate) return;
      const updated = [...checkinLocations, locWithLocalTime];
      setCheckinLocations(updated);
      await AsyncStorage.setItem('CheckinLocations', JSON.stringify(updated));

      // Simpan info check-in start ke AsyncStorage untuk filter tracking background
      if (locWithLocalTime.tipechekin === 'start') {
        await AsyncStorage.setItem('lastCheckinStartTimestamp', locWithLocalTime.timestamp);
        await AsyncStorage.setItem('lastCheckinStartLoc', JSON.stringify({ latitude: locWithLocalTime.latitude, longitude: locWithLocalTime.longitude }));
      }

      // Kirim ke server (start, stop, kontrak semuanya pakai address terbaik)
      const userName = state?.userInfo?.UserName || state?.userInfo?.username || '';
      const address = await getBestAddress(locWithLocalTime);
      console.log(`[MapContext] Akan kirim ke API saveCheckinToServer tipe: ${locWithLocalTime.tipechekin}`, {
        EmployeeName: userName,
        Lattitude: locWithLocalTime.latitude,
        Longtitude: locWithLocalTime.longitude,
        CreatedDate: locWithLocalTime.timestamp,
        Address: address,
        tipechekin: locWithLocalTime.tipechekin,
      });
      const apiResult = await saveCheckinToServer({
        EmployeeName: userName,
        Lattitude: locWithLocalTime.latitude,
        Longtitude: locWithLocalTime.longitude,
        CreatedDate: locWithLocalTime.timestamp,
        Address: address,
        tipechekin: locWithLocalTime.tipechekin,
      });
      console.log(`[MapContext] Hasil panggil API saveCheckinToServer tipe: ${locWithLocalTime.tipechekin}`, apiResult);
    } catch (e) {
      console.error('[MapContext] Error saving checkin:', e);
    }
  };

  // Tambahkan fungsi untuk hanya update lokal tanpa trigger API
  const addCheckinLocal = async (location) => {
    try {
      const locWithLocalTime = {
        ...location,
        timestamp: location.timestamp || getLocalISOString(),
        tipechekin: location.tipechekin || location.type || 'tracking',
      };
      const isDuplicate = checkinLocations.some(
        l => l.contractId === locWithLocalTime.contractId &&
             l.tipechekin === locWithLocalTime.tipechekin &&
             l.timestamp === locWithLocalTime.timestamp
      );
      if (isDuplicate) return;
      const updated = [...checkinLocations, locWithLocalTime];
      setCheckinLocations(updated);
      await AsyncStorage.setItem('CheckinLocations', JSON.stringify(updated));
    } catch (e) {
      console.error('[MapContext] Error saving checkin (local only):', e);
    }
  };

  useEffect(() => {
    loadCheckinsFromStorage();
  }, []);

  return (
    <MapContext.Provider value={{ checkinLocations, addCheckin, addCheckinLocal, loadCheckinsFromStorage, clearCheckins }}>
      {children}
    </MapContext.Provider>
  );
};

export const useMap = () => useContext(MapContext);
