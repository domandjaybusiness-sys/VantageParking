import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { AnimatedPressableButton } from '@/components/ui/animated-pressable';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../lib/supabase';

// Mock nearby spots data
const NEARBY_SPOTS = [
  { id: 1, price: 8, distance: '0.2 mi', address: '123 Main St', image: '🅿️' },
  { id: 2, price: 12, distance: '0.4 mi', address: '456 Oak Ave', image: '🅿️' },
  { id: 3, price: 6, distance: '0.5 mi', address: '789 Pine Rd', image: '🅿️' },
  { id: 4, price: 15, distance: '0.8 mi', address: '321 Elm St', image: '🅿️' },
];

export default function HomeScreen() {
  const [driveways, setDriveways] = useState<any[] | null>(null);
  const [userName, setUserName] = useState('Jason');
  const [isHost, setIsHost] = useState(true);
  const [activeBookings, setActiveBookings] = useState(2);
  const [todayEarnings, setTodayEarnings] = useState(127.50);
  const router = useRouter();

  // Get time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning,';
    if (hour < 18) return 'Good afternoon,';
    return 'Good evening,';
  };

  useEffect(() => {
    (async () => {
      // Fetch user data
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.user_metadata?.name) {
        setUserName(user.user_metadata.name.split(' ')[0]);
      }

      // Fetch driveways
      const { data } = await supabase.from('driveways').select('*');
      setDriveways(data ?? []);
    })();
  }, []);

  const handleSearchLocation = () => {
    router.push('/map');
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
      router.push(`/map?lat=${latitude}&lng=${longitude}`);
    } catch (error) {
      Alert.alert('Error', 'Could not retrieve your location. Please try again.');
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header Section with Gradient */}
      <LinearGradient
        colors={['#1e293b', '#0f172a']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.userName}>{userName}</Text>
          </View>
          <TouchableOpacity 
            style={styles.profileIcon}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/profile');
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.profileIconText}>👤</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Primary Action - Find Parking */}
      <View style={styles.primaryActionContainer}>
        <AnimatedListItem index={0} direction="up">
          <TouchableOpacity
            style={styles.primaryActionButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              handleSearchLocation();
            }}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#10b981', '#059669']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryGradient}
            >
              <Text style={styles.primaryActionIcon}>🔍</Text>
              <View style={styles.primaryActionContent}>
                <Text style={styles.primaryActionTitle}>Find Parking</Text>
                <Text style={styles.primaryActionSubtitle}>Search available spots nearby</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </AnimatedListItem>
      </View>

      {/* Quick Action Buttons */}
      <View style={styles.quickActionsContainer}>
        <Text style={styles.sectionTitle}>More Actions</Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickActionsScroll}
        >
          <AnimatedListItem index={1} direction="up">
            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/host');
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.quickActionIconCircle, { backgroundColor: '#3b82f6' }]}>
                <Text style={styles.quickActionCardIcon}>📍</Text>
              </View>
              <Text style={styles.quickActionCardTitle}>List Spot</Text>
              <Text style={styles.quickActionCardSubtitle}>Earn money</Text>
            </TouchableOpacity>
          </AnimatedListItem>

          <AnimatedListItem index={2} direction="up">
            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/bookings');
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.quickActionIconCircle, { backgroundColor: '#8b5cf6' }]}>
                <Text style={styles.quickActionCardIcon}>📅</Text>
              </View>
              <Text style={styles.quickActionCardTitle}>Bookings</Text>
              <Text style={styles.quickActionCardSubtitle}>Your reservations</Text>
            </TouchableOpacity>
          </AnimatedListItem>

          <AnimatedListItem index={3} direction="up">
            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                Alert.alert('Wallet', 'View your payment methods and transaction history.', [
                  { text: 'OK' }
                ]);
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.quickActionIconCircle, { backgroundColor: '#f59e0b' }]}>
                <Text style={styles.quickActionCardIcon}>💳</Text>
              </View>
              <Text style={styles.quickActionCardTitle}>Wallet</Text>
              <Text style={styles.quickActionCardSubtitle}>Payments</Text>
            </TouchableOpacity>
          </AnimatedListItem>

          <AnimatedListItem index={4} direction="up">
            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                Alert.alert('Support', 'Get help with your parking experience.');
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.quickActionIconCircle, { backgroundColor: '#ec4899' }]}>
                <Text style={styles.quickActionCardIcon}>💬</Text>
              </View>
              <Text style={styles.quickActionCardTitle}>Support</Text>
              <Text style={styles.quickActionCardSubtitle}>Get help</Text>
            </TouchableOpacity>
          </AnimatedListItem>
        </ScrollView>
      </View>

      {/* Host Earnings Widget */}
      {isHost && (
        <AnimatedListItem index={5} direction="up">
          <TouchableOpacity 
            style={styles.earningsWidget}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/host');
            }}
            activeOpacity={0.8}
          >
            <View style={styles.earningsHeader}>
              <Text style={styles.earningsTitle}>Host Dashboard</Text>
              <Text style={styles.earningsViewAll}>View All →</Text>
            </View>
            <View style={styles.earningsStats}>
              <View style={styles.earningStat}>
                <Text style={styles.earningValue}>{activeBookings}</Text>
                <Text style={styles.earningLabel}>Active Bookings</Text>
              </View>
              <View style={styles.earningDivider} />
              <View style={styles.earningStat}>
                <Text style={styles.earningValue}>${todayEarnings.toFixed(2)}</Text>
                <Text style={styles.earningLabel}>Today's Earnings</Text>
              </View>
            </View>
          </TouchableOpacity>
        </AnimatedListItem>
      )}

      {/* Nearby Spots Section */}
      <View style={styles.nearbySpotsContainer}>
        <View style={styles.nearbySpotsHeader}>
          <Text style={styles.sectionTitle}>Nearby Spots</Text>
          <TouchableOpacity 
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/map');
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.viewAllText}>View All →</Text>
          </TouchableOpacity>
        </View>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.nearbySpotsScroll}
        >
          {NEARBY_SPOTS.map((spot, index) => (
            <AnimatedListItem key={spot.id} index={index + 6} direction="up">
              <TouchableOpacity 
                style={styles.nearbySpotCard}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  Alert.alert('Book Spot', `Book parking at ${spot.address}?`, [
                    { text: 'Cancel', style: 'cancel' },
                    { 
                      text: 'Book Now', 
                      onPress: () => {
                        router.push('/map');
                      }
                    }
                  ]);
                }}
                activeOpacity={0.8}
              >
                <View style={styles.spotImagePlaceholder}>
                  <Text style={styles.spotImageIcon}>{spot.image}</Text>
                </View>
                <View style={styles.spotInfo}>
                  <View style={styles.spotPriceRow}>
                    <Text style={styles.spotPrice}>${spot.price}/hr</Text>
                    <Text style={styles.spotDistance}>📍 {spot.distance}</Text>
                  </View>
                  <Text style={styles.spotAddress}>{spot.address}</Text>
                </View>
              </TouchableOpacity>
            </AnimatedListItem>
          ))}
        </ScrollView>
      </View>

      {/* Current Location Quick Access */}
      <AnimatedListItem index={10} direction="up">
        <TouchableOpacity 
          style={styles.currentLocationButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            handleUseCurrentLocation();
          }}
          activeOpacity={0.8}
        >
          <View style={styles.currentLocationIcon}>
            <Text style={styles.currentLocationIconText}>📍</Text>
          </View>
          <View style={styles.currentLocationContent}>
            <Text style={styles.currentLocationTitle}>Use My Current Location</Text>
            <Text style={styles.currentLocationSubtitle}>Find nearby parking instantly</Text>
          </View>
          <Text style={styles.currentLocationArrow}>→</Text>
        </TouchableOpacity>
      </AnimatedListItem>

      {/* How It Works Section */}
      <View style={styles.howItWorksContainer}>
        <Text style={styles.sectionTitle}>How It Works</Text>
        <View style={styles.stepsContainer}>
          <View style={styles.stepCard}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <Text style={styles.stepTitle}>Search</Text>
            <Text style={styles.stepDescription}>Find available parking near your destination</Text>
          </View>
          <View style={styles.stepCard}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <Text style={styles.stepTitle}>Reserve</Text>
            <Text style={styles.stepDescription}>Book your spot instantly and pay securely</Text>
          </View>
          <View style={styles.stepCard}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <Text style={styles.stepTitle}>Park</Text>
            <Text style={styles.stepDescription}>Arrive and park with confidence</Text>
          </View>
        </View>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },

  // Header Section
  headerGradient: {
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 16,
    color: '#94a3b8',
    fontWeight: '600',
    marginBottom: 4,
  },
  userName: {
    fontSize: 28,
    color: 'white',
    fontWeight: '800',
  },
  profileIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#10b981',
  },
  profileIconText: {
    fontSize: 24,
  },

  // Primary Action
  primaryActionContainer: {
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 24,
  },
  primaryActionButton: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  primaryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 24,
    gap: 16,
  },
  primaryActionIcon: {
    fontSize: 40,
  },
  primaryActionContent: {
    flex: 1,
  },
  primaryActionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: 'white',
    marginBottom: 4,
  },
  primaryActionSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },

  // Quick Actions
  quickActionsContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  quickActionsScroll: {
    paddingHorizontal: 20,
    gap: 12,
  },
  quickActionCard: {
    width: 140,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  quickActionIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  quickActionCardIcon: {
    fontSize: 32,
  },
  quickActionCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: 'white',
    textAlign: 'center',
    marginBottom: 4,
  },
  quickActionCardSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    fontWeight: '500',
  },

  // Earnings Widget
  earningsWidget: {
    marginHorizontal: 20,
    marginBottom: 24,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#10b981',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  earningsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  earningsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
  },
  earningsViewAll: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
  },
  earningsStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  earningStat: {
    flex: 1,
    alignItems: 'center',
  },
  earningValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#10b981',
    marginBottom: 4,
  },
  earningLabel: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
    textAlign: 'center',
  },
  earningDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#334155',
    marginHorizontal: 16,
  },

  // Nearby Spots
  nearbySpotsContainer: {
    marginBottom: 24,
  },
  nearbySpotsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
  },
  nearbySpotsScroll: {
    paddingHorizontal: 20,
    gap: 12,
  },
  nearbySpotCard: {
    width: 200,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  spotImagePlaceholder: {
    height: 100,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  spotImageIcon: {
    fontSize: 48,
  },
  spotInfo: {
    padding: 12,
  },
  spotPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  spotPrice: {
    fontSize: 18,
    fontWeight: '800',
    color: '#10b981',
  },
  spotDistance: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  spotAddress: {
    fontSize: 13,
    color: '#cbd5e1',
    fontWeight: '500',
  },

  // Current Location Button
  currentLocationButton: {
    marginHorizontal: 20,
    marginBottom: 24,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  currentLocationIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  currentLocationIconText: {
    fontSize: 24,
  },
  currentLocationContent: {
    flex: 1,
  },
  currentLocationTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
    marginBottom: 4,
  },
  currentLocationSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '500',
  },
  currentLocationArrow: {
    fontSize: 24,
    color: '#10b981',
    fontWeight: '700',
  },

  // How It Works
  howItWorksContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  stepsContainer: {
    gap: 12,
  },
  stepCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  stepNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepNumberText: {
    fontSize: 18,
    fontWeight: '800',
    color: 'white',
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
    marginBottom: 6,
  },
  stepDescription: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 20,
  },
});
