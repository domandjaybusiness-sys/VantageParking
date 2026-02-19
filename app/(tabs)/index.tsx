import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { AnimatedPressableButton } from '@/components/ui/animated-pressable';
import Card from '@/components/ui/card';
import PrimaryButton from '@/components/ui/primary-button';
import { Colors, Design } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../../lib/supabase';

export default function HomeScreen() {
  const [driveways, setDriveways] = useState<any[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [howItWorksVisible, setHowItWorksVisible] = useState(false);
  const theme = useColorScheme() ?? 'light';
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('driveways').select('*');

      if (error) setErrorMsg(error.message);
      else setDriveways(data ?? []);
    })();
  }, []);

  const drivewaysFound = driveways?.length ?? 0;

  const handleSearchLocation = () => {
    // Navigate to Map screen and programmatically open search
    router.push('/map?openSearch=true');
  };

  const handleUseCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Location permission required',
          'Please enable location access to find parking near you.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => {
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:');
                } else {
                  Linking.openSettings();
                }
              },
            },
          ]
        );
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;

      // Navigate to Map and center on user location
      router.push(`/map?lat=${latitude}&lng=${longitude}`);
    } catch (error) {
      Alert.alert('Error', 'Could not retrieve your location. Please try again.');
    }
  };

  const handleBecomeHost = () => {
    // Navigate to Host tab (Earn)
    router.push('/host');
  };

  const handleSearchAnotherCity = () => {
    handleSearchLocation();
  };

  return (
    <View style={[styles.container, { backgroundColor: Colors[theme].background }]}> 
      <AnimatedListItem index={0} direction="down">
        <View style={styles.headerSection}>
          <Text style={styles.title}>Find parking in seconds</Text>
          <Text style={styles.subtitle}>Book nearby driveways and lots instantly.</Text>

          <View style={styles.buttonsRow}>
            <PrimaryButton title="Search a location" onPress={handleSearchLocation} />
          </View>

          <View style={{ height: 12 }} />
          <PrimaryButton 
            title="Use my current location" 
            onPress={handleUseCurrentLocation} 
            style={{ backgroundColor: Colors[theme].backgroundCard }} 
            textStyle={{ color: Colors[theme].text }} 
          />
        </View>
      </AnimatedListItem>

      <AnimatedListItem index={1} direction="up">
        <AnimatedPressableButton onPress={() => setHowItWorksVisible(true)}>
          <Card style={styles.howItWorksCard}>
            <Text style={styles.howTitle}>How it works</Text>
            <View style={styles.stepsRow}>
              <View style={styles.step}><Text style={styles.stepTitle}>1. Search</Text></View>
              <View style={styles.step}><Text style={styles.stepTitle}>2. Reserve</Text></View>
              <View style={styles.step}><Text style={styles.stepTitle}>3. Park</Text></View>
            </View>
          </Card>
        </AnimatedPressableButton>
      </AnimatedListItem>

      {driveways && drivewaysFound === 0 && (
        <AnimatedListItem index={2} direction="up">
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No spots in this area yet.</Text>
            <View style={{ height: 12 }} />
            <PrimaryButton 
              title="Become a Host" 
              onPress={handleBecomeHost} 
            />
            <View style={{ height: 8 }} />
            <Pressable onPress={handleSearchAnotherCity}>
              <Text style={styles.linkText}>Search another city</Text>
            </Pressable>
          </Card>
        </AnimatedListItem>
      )}

      {/* How It Works Modal */}
      <Modal visible={howItWorksVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>How it works</Text>
            
            <View style={styles.modalStep}>
              <Text style={styles.modalStepNumber}>1</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalStepTitle}>Search</Text>
                <Text style={styles.modalStepDesc}>Find available parking near your destination</Text>
              </View>
            </View>

            <View style={styles.modalStep}>
              <Text style={styles.modalStepNumber}>2</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalStepTitle}>Reserve</Text>
                <Text style={styles.modalStepDesc}>Book your spot instantly and pay securely</Text>
              </View>
            </View>

            <View style={styles.modalStep}>
              <Text style={styles.modalStepNumber}>3</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalStepTitle}>Park</Text>
                <Text style={styles.modalStepDesc}>Arrive and park with confidence</Text>
              </View>
            </View>

            <PrimaryButton title="Got it" onPress={() => setHowItWorksVisible(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  headerSection: { alignItems: 'center', marginTop: 24 },
  title: { fontSize: Design.fontSizes.title, fontWeight: '800', color: 'white', textAlign: 'center' },
  subtitle: { fontSize: Design.fontSizes.subtitle, color: '#cbd5e1', marginTop: 8, textAlign: 'center' },
  buttonsRow: { width: '100%', marginTop: 16 },
  howItWorksCard: { marginHorizontal: 0, marginTop: 24 },
  howTitle: { fontSize: 18, fontWeight: '700', color: 'white', marginBottom: 12 },
  stepsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  step: { flex: 1, alignItems: 'center' },
  stepTitle: { color: '#cbd5e1', fontWeight: '600' },
  emptyCard: { marginTop: 24, alignItems: 'center' },
  emptyTitle: { color: '#cbd5e1', fontSize: 16, marginBottom: 12 },
  linkText: { color: '#10b981', fontSize: 16, fontWeight: '600', textAlign: 'center', marginTop: 8 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: 'white',
    marginBottom: 24,
  },
  modalStep: {
    flexDirection: 'row',
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  modalStepNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#10b981',
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 40,
    marginRight: 16,
  },
  modalStepTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
    marginBottom: 4,
  },
  modalStepDesc: {
    fontSize: 14,
    color: '#cbd5e1',
  },
});
