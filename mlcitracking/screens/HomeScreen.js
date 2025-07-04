// screens/HomeScreen.js
import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, BackHandler } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useTheme } from '../context/ThemeContext';
import { useFocusEffect } from '@react-navigation/native';
import CustomAlert from '../components/CustomAlert';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMap } from '../context/MapContext';

const HomeScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const { clearCheckins } = useMap();
  const { signOut } = require('../context/AuthContext').useAuth();
  const [exitAlert, setExitAlert] = React.useState(false);

  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        setExitAlert(true);
        return true; // prevent default behavior
      };
      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [])
  );

  const handleExit = async () => {
    setExitAlert(false);
    // Hapus semua token dan data lokasi
    await AsyncStorage.removeItem('locationLogs');
    await AsyncStorage.removeItem('CheckinLocations');
    if (clearCheckins) await clearCheckins();
    // Hapus SecureStore token
    if (typeof signOut === 'function') await signOut();
    // Tidak perlu navigation.reset, biarkan context Auth yang handle ke Login
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('ListContract')}
      >
        <Icon name="list" size={40} color="#fff" />
        <Text style={styles.text}>List Contract</Text>
      </TouchableOpacity>
      <CustomAlert
        visible={exitAlert}
        onClose={() => setExitAlert(false)}
        onConfirm={handleExit}
        message="Are you sure want to exit?"
        mode="confirm"
      />
      {/* Tombol Check-in dihilangkan, hanya List Contract */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-evenly',
    alignItems: 'center',
    flexDirection: 'row',
    padding: 20,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#007bff',
    padding: 20,
    borderRadius: 15,
  },
  text: {
    marginTop: 10,
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default HomeScreen;
