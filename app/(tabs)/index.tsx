import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { useTheme } from '@/contexts/ThemeContext';
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
  const { colorScheme, colors } = useTheme();
  const [driveways, setDriveways] = useState<any[] | null>(null);
  const [userName, setUserName] = useState('Jason');
  const [isHost, setIsHost] = useState(false);
  const [activeBookings, setActiveBookings] = useState(0);
  const [todayEarnings, setTodayEarnings] = useState(0);
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

      if (!user) {
        setIsHost(false);
        setActiveBookings(0);
        setTodayEarnings(0);
        return;
      }

      const { data: spots } = await supabase
        .from('spots')
        .select('id')
        .eq('host_id', user.id);
      setIsHost((spots ?? []).length > 0);

      const { data: bookings } = await supabase
        .from('bookings')
        .select('*')
        .eq('host_id', user.id);

      const rows = bookings ?? [];
      const activeCount = rows.filter((b) => String(b?.status || '').toLowerCase() === 'active').length;
      setActiveBookings(activeCount);

      const today = new Date().toDateString();
      const todayTotal = rows.reduce((sum, b) => {
        if (String(b?.status || '').toLowerCase() !== 'paid') return sum;
        const raw = b?.paid_at ?? b?.created_at ?? b?.start_time ?? b?.startTime;
        const date = raw ? new Date(raw).toDateString() : '';
        return date === today ? sum + Number(b?.amount ?? 0) : sum;
      }, 0);
      setTodayEarnings(todayTotal);
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
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} showsVerticalScrollIndicator={false}>
      {/* Header Section with Gradient */}
      <LinearGradient
        colors={colorScheme === 'dark' ? ['#1e293b', '#0f172a'] : ['#e0f2fe', '#bae6fd']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.greeting, { color: colors.textSecondary }]}>{getGreeting()}</Text>
            <Text style={[styles.userName, { color: colors.text }]}>{userName}</Text>
          </View>
          <TouchableOpacity 
            style={[styles.profileIcon, { 
              backgroundColor: colors.backgroundCard,
              borderColor: colors.primary 
            }]}
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
              colors={colorScheme === 'dark' ? ['#10b981', '#059669'] : ['#10b981', '#34d399']}
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
        <Text style={[styles.sectionTitle, { color: colors.text }]}>More Actions</Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickActionsScroll}
        >
          <AnimatedListItem index={1} direction="up">
            <TouchableOpacity
              style={[styles.quickActionCard, { 
                backgroundColor: colors.backgroundCard,
                borderColor: colorScheme === 'dark' ? '#334155' : '#e5e7eb'
              }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/host');
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.quickActionIconCircle, { backgroundColor: '#3b82f6' }]}>
                <Text style={styles.quickActionCardIcon}>📍</Text>
              </View>
              <Text style={[styles.quickActionCardTitle, { color: colors.text }]}>List Spot</Text>
              <Text style={[styles.quickActionCardSubtitle, { color: colors.textSecondary }]}>Earn money</Text>
            </TouchableOpacity>
          </AnimatedListItem>

          <AnimatedListItem index={2} direction="up">
            <TouchableOpacity
              style={[styles.quickActionCard, { 
                backgroundColor: colors.backgroundCard,
                borderColor: colorScheme === 'dark' ? '#334155' : '#e5e7eb'
              }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/bookings');
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.quickActionIconCircle, { backgroundColor: '#8b5cf6' }]}>
                <Text style={styles.quickActionCardIcon}>📅</Text>
              </View>
              <Text style={[styles.quickActionCardTitle, { color: colors.text }]}>Bookings</Text>
              <Text style={[styles.quickActionCardSubtitle, { color: colors.textSecondary }]}>Your reservations</Text>
            </TouchableOpacity>
          </AnimatedListItem>

          <AnimatedListItem index={3} direction="up">
            <TouchableOpacity
              style={[styles.quickActionCard, { 
                backgroundColor: colors.backgroundCard,
                borderColor: colorScheme === 'dark' ? '#334155' : '#e5e7eb'
              }]}
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
              <Text style={[styles.quickActionCardTitle, { color: colors.text }]}>Wallet</Text>
              <Text style={[styles.quickActionCardSubtitle, { color: colors.textSecondary }]}>Payments</Text>
            </TouchableOpacity>
          </AnimatedListItem>

          <AnimatedListItem index={4} direction="up">
            <TouchableOpacity
              style={[styles.quickActionCard, { 
                backgroundColor: colors.backgroundCard,
                borderColor: colorScheme === 'dark' ? '#334155' : '#e5e7eb'
              }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                Alert.alert('Support', 'Get help with your parking experience.');
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.quickActionIconCircle, { backgroundColor: '#ec4899' }]}>
                <Text style={styles.quickActionCardIcon}>💬</Text>
              </View>
              <Text style={[styles.quickActionCardTitle, { color: colors.text }]}>Support</Text>
              <Text style={[styles.quickActionCardSubtitle, { color: colors.textSecondary }]}>Get help</Text>
            </TouchableOpacity>
          </AnimatedListItem>
        </ScrollView>
      </View>

      {/* Host Earnings Widget */}
      {isHost && (
        <AnimatedListItem index={5} direction="up">
          <TouchableOpacity 
            style={[styles.earningsWidget, {
              backgroundColor: colors.backgroundCard,
              borderColor: colors.primary
            }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/host');
            }}
            activeOpacity={0.8}
          >
            <View style={styles.earningsHeader}>
              <Text style={[styles.earningsTitle, { color: colors.text }]}>Host Dashboard</Text>
              <Text style={[styles.earningsViewAll, { color: colors.primary }]}>View All →</Text>
            </View>
            <View style={styles.earningsStats}>
              <View style={styles.earningStat}>
                <Text style={[styles.earningValue, { color: colors.primary }]}>{activeBookings}</Text>
                <Text style={[styles.earningLabel, { color: colors.textSecondary }]}>Active Bookings</Text>
              </View>
              <View style={[styles.earningDivider, { backgroundColor: colorScheme === 'dark' ? '#334155' : '#e5e7eb' }]} />
              <View style={styles.earningStat}>
                <Text style={[styles.earningValue, { color: colors.primary }]}>${todayEarnings.toFixed(2)}</Text>
                <Text style={[styles.earningLabel, { color: colors.textSecondary }]}>Today's Earnings</Text>
              </View>
            </View>
          </TouchableOpacity>
        </AnimatedListItem>
      )}

      {/* Nearby Spots Section */}
      <View style={styles.nearbySpotsContainer}>
        <View style={styles.nearbySpotsHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Nearby Spots</Text>
          <TouchableOpacity 
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/map');
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.viewAllText, { color: colors.primary }]}>View All →</Text>
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
                style={[styles.nearbySpotCard, {
                  backgroundColor: colors.backgroundCard,
                  borderColor: colorScheme === 'dark' ? '#334155' : '#e5e7eb'
                }]}
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
                <View style={[styles.spotImagePlaceholder, { backgroundColor: colorScheme === 'dark' ? '#0f172a' : '#f1f5f9' }]}>
                  <Text style={styles.spotImageIcon}>{spot.image}</Text>
                </View>
                <View style={styles.spotInfo}>
                  <View style={styles.spotPriceRow}>
                    <Text style={[styles.spotPrice, { color: colors.primary }]}>${spot.price}/hr</Text>
                    <Text style={[styles.spotDistance, { color: colors.textSecondary }]}>📍 {spot.distance}</Text>
                  </View>
                  <Text style={[styles.spotAddress, { color: colors.text }]}>{spot.address}</Text>
                </View>
              </TouchableOpacity>
            </AnimatedListItem>
          ))}
        </ScrollView>
      </View>

      {/* Current Location Quick Access */}
      <AnimatedListItem index={10} direction="up">
        <TouchableOpacity 
          style={[styles.currentLocationButton, {
            backgroundColor: colors.backgroundCard,
            borderColor: colorScheme === 'dark' ? '#334155' : '#e5e7eb'
          }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            handleUseCurrentLocation();
          }}
          activeOpacity={0.8}
        >
          <View style={[styles.currentLocationIcon, { backgroundColor: colors.primary }]}>
            <Text style={styles.currentLocationIconText}>📍</Text>
          </View>
          <View style={styles.currentLocationContent}>
            <Text style={[styles.currentLocationTitle, { color: colors.text }]}>Use My Current Location</Text>
            <Text style={[styles.currentLocationSubtitle, { color: colors.textSecondary }]}>Find nearby parking instantly</Text>
          </View>
          <Text style={[styles.currentLocationArrow, { color: colors.primary }]}>→</Text>
        </TouchableOpacity>
      </AnimatedListItem>

      {/* How It Works Section */}
      <View style={styles.howItWorksContainer}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>How It Works</Text>
        <View style={styles.stepsContainer}>
          <View style={[styles.stepCard, {
            backgroundColor: colors.backgroundCard,
            borderColor: colorScheme === 'dark' ? '#334155' : '#e5e7eb'
          }]}>
            <View style={[styles.stepNumber, { backgroundColor: colors.primary }]}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Search</Text>
            <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>Find available parking near your destination</Text>
          </View>
          <View style={[styles.stepCard, {
            backgroundColor: colors.backgroundCard,
            borderColor: colorScheme === 'dark' ? '#334155' : '#e5e7eb'
          }]}>
            <View style={[styles.stepNumber, { backgroundColor: colors.primary }]}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Reserve</Text>
            <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>Book your spot instantly and pay securely</Text>
          </View>
          <View style={[styles.stepCard, {
            backgroundColor: colors.backgroundCard,
            borderColor: colorScheme === 'dark' ? '#334155' : '#e5e7eb'
          }]}>
            <View style={[styles.stepNumber, { backgroundColor: colors.primary }]}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Park</Text>
            <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>Arrive and park with confidence</Text>
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
    fontWeight: '600',
    marginBottom: 4,
  },
  userName: {
    fontSize: 28,
    fontWeight: '800',
  },
  profileIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
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
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  quickActionsScroll: {
    paddingHorizontal: 20,
    gap: 12,
  },
  quickActionCard: {
    width: 140,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
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
    textAlign: 'center',
    marginBottom: 4,
  },
  quickActionCardSubtitle: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },

  // Earnings Widget
  earningsWidget: {
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
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
  },
  earningsViewAll: {
    fontSize: 14,
    fontWeight: '600',
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
    marginBottom: 4,
  },
  earningLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  earningDivider: {
    width: 1,
    height: 40,
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
  },
  nearbySpotsScroll: {
    paddingHorizontal: 20,
    gap: 12,
  },
  nearbySpotCard: {
    width: 200,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  spotImagePlaceholder: {
    height: 100,
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
  },
  spotDistance: {
    fontSize: 12,
    fontWeight: '600',
  },
  spotAddress: {
    fontSize: 13,
    fontWeight: '500',
  },

  // Current Location Button
  currentLocationButton: {
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
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
    marginBottom: 4,
  },
  currentLocationSubtitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  currentLocationArrow: {
    fontSize: 24,
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
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
  },
  stepNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    marginBottom: 6,
  },
  stepDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
});
