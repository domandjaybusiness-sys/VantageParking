import { useTheme } from '@/contexts/ThemeContext';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SearchScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [location, setLocation] = useState('');
  const [date, setDate] = useState(new Date());
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date(Date.now() + 2 * 60 * 60 * 1000)); // 2 hours later

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async () => {
    setIsSearching(true);
    let lat = null;
    let lng = null;

    if (location.trim()) {
      try {
        const geocoded = await Location.geocodeAsync(location);
        if (geocoded.length > 0) {
          const first = geocoded[0] as any;
          const country = String(first.country || first.isoCountryCode || '').toLowerCase();
          if (country && country !== 'united states' && country !== 'us' && country !== 'usa') {
            Alert.alert('Location restricted', 'Please search for locations within the United States.');
          } else {
            lat = first.latitude;
            lng = first.longitude;
          }
        }
      } catch (e) {
        console.log('Geocoding failed', e);
      }
    }

    setIsSearching(false);

    // Pass parameters to browse
    router.push({
      pathname: '/(tabs)/browse',
      params: {
        location,
        lat: lat ? String(lat) : undefined,
        lng: lng ? String(lng) : undefined,
        date: date.toISOString(),
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      },
    });
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.title, { color: colors.text }]}>Find a Spot</Text>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Where to?</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.backgroundCard, color: colors.text, borderColor: colors.border }]}
            placeholder="Address, city, or zip code"
            placeholderTextColor={colors.textSecondary}
            value={location}
            onChangeText={setLocation}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Date</Text>
          <TouchableOpacity
            style={[styles.input, { backgroundColor: colors.backgroundCard, borderColor: colors.border, justifyContent: 'center' }]}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={{ color: colors.text }}>{date.toLocaleDateString()}</Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display="default"
              onChange={(event, selectedDate) => {
                setShowDatePicker(false);
                if (selectedDate) setDate(selectedDate);
              }}
            />
          )}
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Start Time</Text>
            <TouchableOpacity
              style={[styles.input, { backgroundColor: colors.backgroundCard, borderColor: colors.border, justifyContent: 'center' }]}
              onPress={() => setShowStartTimePicker(true)}
            >
              <Text style={{ color: colors.text }}>
                {startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </TouchableOpacity>
            {showStartTimePicker && (
              <DateTimePicker
                value={startTime}
                mode="time"
                display="default"
                onChange={(event, selectedTime) => {
                  setShowStartTimePicker(false);
                  if (selectedTime) setStartTime(selectedTime);
                }}
              />
            )}
          </View>

          <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>End Time</Text>
            <TouchableOpacity
              style={[styles.input, { backgroundColor: colors.backgroundCard, borderColor: colors.border, justifyContent: 'center' }]}
              onPress={() => setShowEndTimePicker(true)}
            >
              <Text style={{ color: colors.text }}>
                {endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </TouchableOpacity>
            {showEndTimePicker && (
              <DateTimePicker
                value={endTime}
                mode="time"
                display="default"
                onChange={(event, selectedTime) => {
                  setShowEndTimePicker(false);
                  if (selectedTime) setEndTime(selectedTime);
                }}
              />
            )}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.searchButton, { backgroundColor: colors.text }]}
          onPress={handleSearch}
          disabled={isSearching}
        >
          <Text style={[styles.searchButtonText, { color: colors.background }]}>
            {isSearching ? 'Searching...' : 'Search Spots'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 30,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    height: 50,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  searchButton: {
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  searchButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
});
