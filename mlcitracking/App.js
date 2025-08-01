// App.js
import React, { useState } from 'react';
import Navigation from './navigation/AppNavigator';
import { AuthProvider } from './context/AuthContext';
import { ApiProvider } from './context/ApiContext';
import { ThemeProvider } from './context/ThemeContext';
import { useFonts, DancingScript_400Regular } from '@expo-google-fonts/dancing-script';
import SplashScreenComponent from './SplashScreen';
import './locationTask';
import { MapProvider } from './context/MapContext'; // import MapProvider yang kita buat
import { LogBox } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// DEBUG: Log checkinLocations setiap kali app mount
LogBox.ignoreLogs(['Warning: ...']); // Ignore log notification by message

(async () => {
  try {
    const data = await AsyncStorage.getItem('CheckinLocations');
    console.log('DEBUG: CheckinLocations on app start:', data);
  } catch (e) {
    console.log('DEBUG: Gagal membaca CheckinLocations', e);
  }
})();

const App = () => {
  const [fontsLoaded] = useFonts({
    DancingScript_400Regular,
  });

  const [isSplashVisible, setSplashVisible] = useState(true);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <AuthProvider>
      <ApiProvider>
        <ThemeProvider>
          <MapProvider>
            {isSplashVisible ? (
              <SplashScreenComponent onFinish={() => setSplashVisible(false)} />
            ) : (
              <Navigation />
            )}
          </MapProvider>
        </ThemeProvider>
      </ApiProvider>
    </AuthProvider>
  );
};

export default App;
