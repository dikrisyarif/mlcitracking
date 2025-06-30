import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext'; // Impor useTheme

const StartEndButton = ({ isStarted, onPress }) => {
  const { colors } = useTheme(); // Ambil warna dari tema

  return (
    <TouchableOpacity 
      style={[styles.button, { backgroundColor: colors.button, borderColor: colors.buttonborder, borderWidth: 1}]} // Gunakan warna tombol dari tema
      onPress={onPress}
    >
      <Text style={styles.buttonText}>{isStarted ? 'Stop' : 'Start'}</Text>
    </TouchableOpacity>
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
    color: '#fff', // Warna teks tombol
    fontSize: 18,
  },
});

export default StartEndButton;