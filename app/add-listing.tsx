import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { AnimatedPressableButton } from '@/components/ui/animated-pressable';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useTheme } from '@/contexts/ThemeContext';
import { computeHourlyRate, DEFAULT_BASE_RATE } from '@/lib/pricing';
import { supabase } from '@/lib/supabase';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 3959; // miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export default function AddListingScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  // split address fields
  const [street, setStreet] = useState('');
  const [unit, setUnit] = useState('');
  const [city, setCity] = useState('');
  const [stateField, setStateField] = useState('');
  const [zip, setZip] = useState('');
  const [spots, setSpots] = useState('1');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionsAnim = useRef(new Animated.Value(0)).current;

  // Fetch address suggestions as user types
  const fetchAddressSuggestions = useCallback(
    async (query: string) => {
      if (!query || query.length < 3) {
        setSuggestions([]);
        return;
      }

      try {
        // Using Photon API (free OpenStreetMap-based geocoder with autocomplete)
        const response = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5`
        );
        const data = await response.json();
        if (data.features) {
          // Only keep suggestions within the United States for now
          const usOnly = (data.features || []).filter((f: any) => {
            const props = f.properties || {};
            const cc = String(props.countrycode || '').toLowerCase();
            return !cc || cc === 'us';
          });

          let sorted: any[] = usOnly;
          if (userLocation) {
            sorted = [...usOnly].sort((a: any, b: any) => {
              const coordsA = a.geometry?.coordinates || [];
              const coordsB = b.geometry?.coordinates || [];
              const lngA = coordsA[0];
              const latA = coordsA[1];
              const lngB = coordsB[0];
              const latB = coordsB[1];

              if (
                typeof latA !== 'number' ||
                typeof lngA !== 'number' ||
                typeof latB !== 'number' ||
                typeof lngB !== 'number'
              ) {
                return 0;
              }

              const distA = calculateDistance(userLocation.lat, userLocation.lng, latA, lngA);
              const distB = calculateDistance(userLocation.lat, userLocation.lng, latB, lngB);
              return distA - distB;
            });
          }

          setSuggestions(sorted);
        }
      } catch (error) {
        console.log('Autocomplete error:', error);
      }
    },
    [userLocation]
  );

  // Debounced search on street input change
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      if (street.length >= 3) {
        const fullQuery = [street, city, stateField].filter(Boolean).join(' ');
        fetchAddressSuggestions(fullQuery);
        setShowSuggestions(true);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [street, city, stateField, fetchAddressSuggestions]);

  // Animate suggestions dropdown for smoother appearance
  useEffect(() => {
    if (showSuggestions && suggestions.length > 0) {
      Animated.timing(suggestionsAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(suggestionsAnim, {
        toValue: 0,
        duration: 140,
        useNativeDriver: true,
      }).start();
    }
  }, [showSuggestions, suggestions, suggestionsAnim]);

  // Get user's current location to sort suggestions by proximity
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        const loc = await Location.getCurrentPositionAsync({});
        setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      } catch {
        // ignore location errors for now
      }
    })();
  }, []);

  // Handle selecting an autocomplete suggestion
  const handleSelectSuggestion = (feature: any) => {
    const props = feature.properties;
    
    // Parse address components
    const streetName = props.name || props.street || '';
    const houseNumber = props.housenumber || '';
    const fullStreet = houseNumber ? `${houseNumber} ${streetName}` : streetName;
    
    setStreet(fullStreet);
    setCity(props.city || props.town || props.village || '');
    setStateField(props.state || '');
    setZip(props.postcode || '');
    
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const fullAddressPreview = [street, city, stateField, zip].filter(Boolean).join(', ');
  const previewRate = fullAddressPreview
    ? computeHourlyRate({ baseRate: DEFAULT_BASE_RATE, address: fullAddressPreview })
    : null;
  const estimatedMonthly = previewRate != null ? previewRate * 8 * 30 * 0.5 : null; // ~4 hours/day, 30 days, 50% occupancy

  const onSubmit = async () => {
    const fullAddress = `${street}${unit ? ' ' + unit : ''}, ${city}${stateField ? ', ' + stateField : ''}${zip ? ' ' + zip : ''}`.trim();

    if (!fullAddress || !title) {
      Alert.alert('Please fill title and address components');
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const hostId = user?.id ?? null;

    const insertSpotWithFallback = async (basePayload: {
      title: string;
      address: string;
      lat: number | null;
      lng: number | null;
      price_per_hour: number;
      created_at: string;
    }) => {
      const attempts = [
        { ...basePayload, host_id: hostId },
        { ...basePayload, hostId },
        { ...basePayload },
      ];

      let lastError: any = null;

      for (const payload of attempts) {
        const { error } = await supabase.from('spots').insert(payload);
        if (!error) return null;

        lastError = error;
        const message = String(error.message || '').toLowerCase();
        const isHostColumnIssue =
          message.includes('host_id') ||
          message.includes('hostid') ||
          message.includes('schema cache') ||
          message.includes('column');

        if (!isHostColumnIssue) {
          break;
        }
      }

      return lastError;
    };

    const geo = await tryGeocodeVariants(fullAddress);
    if (!geo) {
      Alert.alert(
        'Address not found',
        'We couldn\'t find that address. You can edit the address, or save without placing a pin (you can edit later to place the pin).',
        [
          { text: 'Edit Address', style: 'cancel' },
          {
            text: 'Save Without Pin',
            onPress: () => {
              (async () => {
                const computedRate = computeHourlyRate({
                  baseRate: DEFAULT_BASE_RATE,
                  address: fullAddress,
                });

                const error = await insertSpotWithFallback({
                  title: title || 'New Spot',
                  address: fullAddress,
                  lat: null,
                  lng: null,
                  price_per_hour: computedRate,
                  created_at: new Date().toISOString(),
                });

                if (error) {
                  const details = error.message || error.details || error.hint || 'Unknown error';
                  Alert.alert('Save failed', details);
                  return;
                }

                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert('Success', 'Your spot has been listed!');
                router.push('/(tabs)/map');
              })();
            },
          },
        ]
      );
      return;
    }

    const { lat, lon } = geo;
    const computedRate = computeHourlyRate({
      baseRate: DEFAULT_BASE_RATE,
      address: fullAddress,
    });

    const error = await insertSpotWithFallback({
      title: title || 'New Spot',
      address: fullAddress,
      lat,
      lng: lon,
      price_per_hour: computedRate,
      created_at: new Date().toISOString(),
    });

    if (error) {
      const details = error.message || error.details || error.hint || 'Unknown error';
      Alert.alert('Save failed', details);
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Success', 'Your spot has been listed!');
    
    // navigate to map to view it
    router.push('/(tabs)/map');
  };

  async function tryGeocodeVariants(address: string) {
    const variants: string[] = [];
    variants.push(address);
    const noUnit = address.replace(/#?\s?Apt.*|Unit.*|Suite.*/i, '').trim();
    if (noUnit !== address) variants.push(noUnit);

    const components = [street, city, stateField, zip].filter(Boolean).join(' ').trim();
    if (components && !variants.includes(components)) variants.push(components);

    const noCommas = address.replace(/,/g, ' ').trim();
    if (!variants.includes(noCommas)) variants.push(noCommas);

    const withCountry = `${address} USA`;
    if (!variants.includes(withCountry)) variants.push(withCountry);

    const endpoints = [
      (q: string) => `https://geocode.maps.co/search?q=${encodeURIComponent(q)}&limit=1`,
      (q: string) => `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`,
    ];

    for (const q of variants) {
      for (const endpoint of endpoints) {
        try {
          const resp = await fetch(endpoint(q), { headers: { Accept: 'application/json' } });
          const data = await resp.json();
          const first = Array.isArray(data) ? data[0] : data?.[0];
          if (first) {
            const lat = parseFloat(first.lat ?? first.latitude);
            const lon = parseFloat(first.lon ?? first.longitude);
            if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
              return { lat, lon, usedQuery: q };
            }
          }
        } catch {
          // try next endpoint/query
        }
      }
    }
    return null;
  }

  const onLocate = async () => {
    const fullAddress = `${street}${unit ? ' ' + unit : ''}, ${city}${stateField ? ', ' + stateField : ''}${zip ? ' ' + zip : ''}`.trim();
    if (!fullAddress) {
      Alert.alert('Enter address', 'Please enter the address to locate.');
      return;
    }
    const geo = await tryGeocodeVariants(fullAddress);
    if (!geo) {
      Alert.alert('Address not found', 'We could not locate that address. Try editing or use Save Without Pin.');
      return;
    }
    const computedRate = computeHourlyRate({
      baseRate: DEFAULT_BASE_RATE,
      address: fullAddress,
    });
    const params = new URLSearchParams({
      lat: String(geo.lat),
      lng: String(geo.lon),
      title: title || 'New Spot',
      price: String(computedRate || '0'),
      address: fullAddress,
    });
    router.push(`/(tabs)/map?${params.toString()}`);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 }]}>
        <AnimatedListItem index={0} direction="down">
          <Text style={[styles.header, { color: colors.text }]}>Add New Spot</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>List your parking spot and start earning.</Text>
          {estimatedMonthly != null && (
            <Text style={[styles.earningsHint, { color: colors.textSecondary }]}>
              Est. earnings ~ ${estimatedMonthly.toFixed(0)}/month
            </Text>
          )}

          <View style={styles.stepperRow}>
            <View style={styles.stepItem}>
              <View style={[styles.stepCircle, styles.stepCircleActive]} />
              <Text style={[styles.stepLabel, { color: colors.text }]}>Details</Text>
            </View>
            <View style={styles.stepDivider} />
            <View style={styles.stepItem}>
              <View style={styles.stepCircle} />
              <Text style={[styles.stepLabel, { color: colors.textSecondary }]}>Location</Text>
            </View>
            <View style={styles.stepDivider} />
            <View style={styles.stepItem}>
              <View style={styles.stepCircle} />
              <Text style={[styles.stepLabel, { color: colors.textSecondary }]}>Confirm</Text>
            </View>
          </View>
        </AnimatedListItem>

        <AnimatedListItem index={1} direction="up">
          <View style={[styles.card, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.text }]}>Spot title</Text>
            <TextInput 
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} 
              value={title} 
              onChangeText={setTitle} 
              placeholder="e.g. Downtown Garage" 
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={[styles.label, { color: colors.text }]}>Street address</Text>
            <TextInput 
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} 
              value={street} 
              onChangeText={setStreet} 
              placeholder="123 Main St" 
              placeholderTextColor={colors.textSecondary}
              onFocus={() => street.length >= 3 && suggestions.length > 0 && setShowSuggestions(true)}
            />
            
            {/* Autocomplete suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <Animated.View
                style={[
                  styles.suggestionsContainer,
                  {
                    backgroundColor: colors.backgroundCard,
                    borderColor: colors.border,
                    opacity: suggestionsAnim,
                    transform: [
                      {
                        translateY: suggestionsAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-4, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                {suggestions.map((feature, index) => {
                  const props = feature.properties;
                  const displayText = [
                    props.housenumber,
                    props.name || props.street,
                    props.city || props.town,
                    props.state,
                    props.postcode,
                  ].filter(Boolean).join(', ');
                  
                  return (
                    <TouchableOpacity
                      key={index}
                      style={[styles.suggestionItem, { borderBottomColor: colors.border }]}
                      onPress={() => handleSelectSuggestion(feature)}
                    >
                      <Text style={[styles.suggestionText, { color: colors.text }]}>{displayText}</Text>
                    </TouchableOpacity>
                  );
                })}
              </Animated.View>
            )}

            <Text style={[styles.label, { color: colors.text }]}>Unit (optional)</Text>
            <TextInput 
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} 
              value={unit} 
              onChangeText={setUnit} 
              placeholder="Apt 2B" 
              placeholderTextColor={colors.textSecondary}
            />

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.text }]}>City</Text>
                <TextInput 
                  style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} 
                  value={city} 
                  onChangeText={setCity} 
                  placeholder="City" 
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
              <View style={{ width: 110 }}>
                <Text style={[styles.label, { color: colors.text }]}>ZIP</Text>
                <TextInput 
                  style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} 
                  value={zip} 
                  onChangeText={setZip} 
                  placeholder="ZIP" 
                  keyboardType="number-pad" 
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.text }]}>State</Text>
                <TextInput 
                  style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} 
                  value={stateField} 
                  onChangeText={setStateField} 
                  placeholder="State" 
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.text }]}>Number of spots</Text>
                <TextInput 
                  style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} 
                  value={spots} 
                  onChangeText={setSpots} 
                  keyboardType="number-pad" 
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
            </View>
          </View>
        </AnimatedListItem>

        <AnimatedListItem index={2} direction="up">
          <View style={styles.buttonContainer}>
            <AnimatedPressableButton 
              style={[styles.actionButton, { backgroundColor: colors.primary }]} 
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onLocate();
              }}
            >
              <IconSymbol name="map.fill" size={20} color="#fff" />
              <Text style={styles.actionText}>Locate on Map</Text>
            </AnimatedPressableButton>

            <AnimatedPressableButton 
              style={[styles.actionButton, { backgroundColor: colors.text }]} 
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onSubmit();
              }}
            >
              <IconSymbol name="checkmark.circle.fill" size={20} color={colors.background} />
              <Text style={[styles.actionText, { color: colors.background }]}>Save & View on Map</Text>
            </AnimatedPressableButton>
          </View>
        </AnimatedListItem>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  header: { fontSize: 28, fontWeight: '800', marginBottom: 4 },
  subtitle: { fontSize: 16, marginBottom: 24 },
  earningsHint: {
    fontSize: 13,
    marginBottom: 8,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 8,
  },
  stepItem: {
    alignItems: 'center',
    flexDirection: 'column',
    flexShrink: 0,
  },
  stepCircle: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#6b7280',
    backgroundColor: 'transparent',
  },
  stepCircleActive: {
    borderColor: '#22c55e',
    backgroundColor: '#22c55e',
  },
  stepLabel: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: '600',
  },
  stepDivider: {
    flex: 1,
    height: 1,
    backgroundColor: '#374151',
    marginHorizontal: 4,
    opacity: 0.6,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 24,
  },
  label: { fontSize: 14, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  input: { 
    borderWidth: 1, 
    borderRadius: 12, 
    padding: 14, 
    fontSize: 16,
  },
  buttonContainer: {
    gap: 12,
  },
  actionButton: { 
    flexDirection: 'row',
    padding: 16, 
    borderRadius: 12, 
    alignItems: 'center', 
    justifyContent: 'center',
    gap: 8,
  },
  actionText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  suggestionsContainer: {
    borderWidth: 1,
    borderRadius: 12,
    marginTop: 4,
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  suggestionItem: {
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  suggestionText: {
    fontSize: 14,
  },
});
