import { addListing } from '@/lib/listings';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function AddListingScreen() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  // split address fields
  const [street, setStreet] = useState('');
  const [unit, setUnit] = useState('');
  const [city, setCity] = useState('');
  const [stateField, setStateField] = useState('');
  const [zip, setZip] = useState('');
  const [spots, setSpots] = useState('1');
  const [price, setPrice] = useState('5');
  
  // Autocomplete state
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Fetch address suggestions as user types
  const fetchAddressSuggestions = async (query: string) => {
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
        setSuggestions(data.features);
      }
    } catch (error) {
      console.log('Autocomplete error:', error);
    }
  };

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
  }, [street, city, stateField]);

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

  const onSubmit = async () => {
    const fullAddress = `${street}${unit ? ' ' + unit : ''}, ${city}${stateField ? ', ' + stateField : ''}${zip ? ' ' + zip : ''}`.trim();

    if (!fullAddress || !title) {
      Alert.alert('Please fill title and address components');
      return;
    }

    const id = Date.now().toString();

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

      // try reliable endpoints (geocode.maps.co is a permissive Nominatim mirror)
      const endpoints = [
        (q: string) => `https://geocode.maps.co/search?q=${encodeURIComponent(q)}&limit=1`,
        (q: string) => `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`,
      ];

      for (const q of variants) {
        for (const ep of endpoints) {
          try {
            const url = ep(q);
            const resp = await fetch(url, { headers: { Accept: 'application/json' } });
            const data = await resp.json();
            const first = Array.isArray(data) ? data[0] : data?.[0];
            if (first) {
              const lat = parseFloat(first.lat ?? first.latitude ?? first.lat);
              const lon = parseFloat(first.lon ?? first.longitude ?? first.lon);
              if (!Number.isNaN(lat) && !Number.isNaN(lon)) return { lat, lon, usedQuery: q };
            }
          } catch (e) {
            // ignore and try next
          }
        }
      }
      return null;
    }

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
              const newItem = {
                id,
                title: title || 'New Spot',
                address: fullAddress,
                latitude: undefined,
                longitude: undefined,
                pricePerHour: parseFloat(price) || 0,
                spots: parseInt(spots, 10) || 1,
                status: 'Active' as const,
              };
              addListing(newItem);
              router.push('/(tabs)/map');
            },
          },
        ]
      );
      return;
    }

    const { lat, lon } = geo;

    const newItem = {
      id,
      title: title || 'New Spot',
      address: fullAddress,
      latitude: lat,
      longitude: lon,
      pricePerHour: parseFloat(price) || 0,
      spots: parseInt(spots, 10) || 1,
      status: 'Active' as const,
    };

    addListing(newItem);
    // navigate to map to view it
    router.push('/(tabs)/map');
  };

  async function tryGeocodeVariants(address: string) {
    const variants: string[] = [];
    variants.push(address);
    const noUnit = address.replace(/#?\s?Apt.*|Unit.*|Suite.*/i, '').trim();
    if (noUnit !== address) variants.push(noUnit);
    variants.push(address.replace(/,/g, ' '));
    variants.push(`${address} USA`);

    for (const q of variants) {
      try {
        const resp = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`
        );
        const data = await resp.json();
        if (data && data[0]) {
          return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), usedQuery: q };
        }
      } catch (e) {
        // try next
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
    const params = new URLSearchParams({ lat: String(geo.lat), lng: String(geo.lon), title: title || 'New Spot', price: String(price || '0'), address: fullAddress });
    router.push(`/(tabs)/map?${params.toString()}`);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.header}>Add New Spot</Text>

        <Text style={styles.label}>Spot title</Text>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g. Downtown Garage" />

        <Text style={styles.label}>Street address</Text>
        <TextInput 
          style={styles.input} 
          value={street} 
          onChangeText={setStreet} 
          placeholder="123 Main St" 
          onFocus={() => street.length >= 3 && suggestions.length > 0 && setShowSuggestions(true)}
        />
        
        {/* Autocomplete suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <View style={styles.suggestionsContainer}>
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
                  style={styles.suggestionItem}
                  onPress={() => handleSelectSuggestion(feature)}
                >
                  <Text style={styles.suggestionText}>{displayText}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <Text style={styles.label}>Unit (optional)</Text>
        <TextInput style={styles.input} value={unit} onChangeText={setUnit} placeholder="Apt 2B" />

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>City</Text>
            <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="City" />
          </View>
          <View style={{ width: 100 }}>
            <Text style={styles.label}>ZIP</Text>
            <TextInput style={styles.input} value={zip} onChangeText={setZip} placeholder="ZIP" keyboardType="number-pad" />
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>State</Text>
            <TextInput style={styles.input} value={stateField} onChangeText={setStateField} placeholder="State" />
          </View>
        </View>

        <Text style={styles.label}>Number of spots</Text>
        <TextInput style={styles.input} value={spots} onChangeText={setSpots} keyboardType="number-pad" />

        <Text style={styles.label}>Price per hour (USD)</Text>
        <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="numeric" />

        <Pressable style={[styles.saveButton, { backgroundColor: '#2563eb' }]} onPress={onLocate} android_ripple={{ color: '#eee' }}>
          <Text style={styles.saveText}>Locate on Map</Text>
        </Pressable>

        <Pressable style={styles.saveButton} onPress={onSubmit} android_ripple={{ color: '#eee' }}>
          <Text style={styles.saveText}>Save & View on Map</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#fff', paddingBottom: 40 },
  header: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  label: { color: '#444', marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, backgroundColor: '#fff' },
  saveButton: { marginTop: 24, backgroundColor: '#0a7ea4', padding: 14, borderRadius: 10, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '700' },
  suggestionsContainer: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  suggestionText: {
    fontSize: 14,
    color: '#111',
  },
});
