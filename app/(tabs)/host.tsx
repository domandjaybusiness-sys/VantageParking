import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { AnimatedPressableButton } from '@/components/ui/animated-pressable';
import { useTheme } from '@/contexts/ThemeContext';
import { Listing, mapSpotRow } from '@/lib/listings';
import { computeHourlyRate, DEFAULT_BASE_RATE } from '@/lib/pricing';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function HostScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [listings, setListings] = useState<Listing[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [hostId, setHostId] = useState<string | null>(null);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [showEarnings, setShowEarnings] = useState(false);
  const [earningsTab, setEarningsTab] = useState<'week' | 'month'>('week');
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setHostId(user?.id ?? null);
    })();
  }, []);

  const fetchListings = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('spots')
      .select('*')
      .eq('host_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      setListings([]);
      return;
    }

    setListings((data ?? []).map(mapSpotRow));
  }, []);

  const fetchBookings = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('host_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      setBookings([]);
      return;
    }

    setBookings(data ?? []);
  }, []);

  useEffect(() => {
    if (!hostId) {
      setListings([]);
      setBookings([]);
      return;
    }

    fetchListings(hostId);
    fetchBookings(hostId);

    const spotsChannel = supabase
      .channel('spots-host')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'spots' }, () => {
        fetchListings(hostId);
      })
      .subscribe();

    const bookingsChannel = supabase
      .channel('bookings-host')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        fetchBookings(hostId);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(spotsChannel);
      supabase.removeChannel(bookingsChannel);
    };
  }, [hostId, fetchListings, fetchBookings]);

  const paidBookings = useMemo(
    () => bookings.filter((b) => String(b?.status || '').toLowerCase() === 'paid'),
    [bookings]
  );

  const totalEarnings = useMemo(
    () => paidBookings.reduce((sum, b) => sum + Number(b?.amount ?? 0), 0),
    [paidBookings]
  );

  const todayEarnings = useMemo(() => {
    const today = new Date();
    return paidBookings.reduce((sum, b) => {
      const raw = b?.paid_at ?? b?.created_at ?? b?.start_time ?? b?.startTime;
      const date = raw ? new Date(raw) : null;
      if (!date) return sum;
      const sameDay = date.toDateString() === today.toDateString();
      return sameDay ? sum + Number(b?.amount ?? 0) : sum;
    }, 0);
  }, [paidBookings]);

  const weekEarnings = useMemo(() => {
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    return paidBookings.reduce((sum, b) => {
      const raw = b?.paid_at ?? b?.created_at ?? b?.start_time ?? b?.startTime;
      const date = raw ? new Date(raw).getTime() : 0;
      if (date >= weekAgo && date <= now) {
        return sum + Number(b?.amount ?? 0);
      }
      return sum;
    }, 0);
  }, [paidBookings]);

  const totalBookings = bookings.length;

  const activeBooking = useMemo(() => (
    bookings.find((b) => String(b?.status || '').toLowerCase() === 'active') || null
  ), [bookings]);

  const activeBookingDisplay = useMemo(() => {
    if (!activeBooking) return null;
    const raw = activeBooking?.start_time ?? activeBooking?.startTime ?? activeBooking?.date ?? activeBooking?.created_at;
    const date = raw ? new Date(raw) : null;
    const duration = activeBooking?.duration ?? (activeBooking?.hours ? `${activeBooking.hours}h` : '');

    return {
      guestName: activeBooking?.guest_name ?? activeBooking?.guestName ?? 'Guest',
      spotName: activeBooking?.spot_name ?? activeBooking?.spot_title ?? activeBooking?.spotName ?? activeBooking?.address ?? 'Parking Spot',
      date: date ? date.toLocaleString() : 'Active',
      duration,
      amount: Number(activeBooking?.amount ?? activeBooking?.total ?? 0),
    };
  }, [activeBooking]);

  const upcomingBookings = useMemo(() => {
    const now = Date.now();
    return bookings
      .filter((b) => String(b?.status || '').toLowerCase() !== 'active')
      .filter((b) => {
        const raw = b?.start_time ?? b?.startTime ?? b?.date ?? b?.created_at;
        const time = raw ? new Date(raw).getTime() : 0;
        return time >= now;
      })
      .slice(0, 5)
      .map((b) => {
        const raw = b?.start_time ?? b?.startTime ?? b?.date ?? b?.created_at;
        const date = raw ? new Date(raw) : null;
        const duration = b?.duration ?? (b?.hours ? `${b.hours}h` : '');
        return {
          id: b?.id,
          guestName: b?.guest_name ?? b?.guestName ?? 'Guest',
          spotName: b?.spot_name ?? b?.spot_title ?? b?.spotName ?? b?.address ?? 'Parking Spot',
          date: date ? date.toLocaleString() : 'Upcoming',
          duration,
          amount: Number(b?.amount ?? b?.total ?? 0),
          status: b?.status ?? 'Confirmed',
        };
      });
  }, [bookings]);

  const chartData = useMemo(() => {
    const days = Array.from({ length: 7 }).map((_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      const label = i === 6 ? 'Today' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      return { label, dateKey: date.toDateString(), amount: 0, bookings: 0 };
    });

    paidBookings.forEach((b) => {
      const raw = b?.paid_at ?? b?.created_at ?? b?.start_time ?? b?.startTime;
      const date = raw ? new Date(raw) : null;
      if (!date) return;
      const key = date.toDateString();
      const match = days.find((d) => d.dateKey === key);
      if (match) {
        match.amount += Number(b?.amount ?? 0);
        match.bookings += 1;
      }
    });

    return days;
  }, [paidBookings]);

  const activeCount = useMemo(
    () => listings.filter((l) => l.status === 'Active').length,
    [listings]
  );

  const pausedCount = useMemo(
    () => listings.filter((l) => l.status === 'Paused').length,
    [listings]
  );

  const onAddNew = () => {
    router.push('/add-listing');
  };
  
  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 24 }}
    >
      {/* Stats Dashboard */}
      <View style={styles.statsContainer}>
        <TouchableOpacity 
          style={[styles.statCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}
          onPress={() => {
            setEarningsTab('month');
            setShowEarnings(true);
          }}
          activeOpacity={0.7}
        >
          <Text style={[styles.statValue, { color: colors.primary }]}>${totalEarnings.toFixed(0)}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>This Month</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.statCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}
          onPress={() => Alert.alert('Active Spots', `You have ${activeCount} active parking spots and ${pausedCount} paused spots.`)}
          activeOpacity={0.7}
        >
            <Text style={[styles.statValue, { color: colors.primary }]}>{activeCount}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Active Spots</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.statCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}
          onPress={() => Alert.alert('Total Bookings', `You've had ${totalBookings} total bookings this month.`)}
          activeOpacity={0.7}
        >
            <Text style={[styles.statValue, { color: colors.primary }]}>{totalBookings}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Bookings</Text>
        </TouchableOpacity>
      </View>

      {/* Today's Earnings Card */}
      <AnimatedListItem index={0} direction="down">
        <TouchableOpacity 
          style={[styles.todayEarningsCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}
          onPress={() => setShowEarnings(true)}
          activeOpacity={0.8}
        >
          <View style={styles.earningsHeader}>
            <View>
              <Text style={[styles.todayLabel, { color: colors.textSecondary }]}>Today&apos;s Earnings</Text>
              <Text style={[styles.todayAmount, { color: colors.text }]}>${todayEarnings.toFixed(2)}</Text>
            </View>
            <TouchableOpacity 
              style={[
                styles.trendBadge,
                { backgroundColor: 'rgba(16, 185, 129, 0.2)' }
              ]}
              onPress={() => Alert.alert('Trend', 'Up 12% compared to yesterday')}
              activeOpacity={0.7}
            >
              <Text style={[styles.trendText, { color: colors.primary }]}>↗ +12%</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.miniChart}>
            {chartData.map((day, i) => (
              <View
                key={i}
                style={[
                  styles.miniBar,
                  { backgroundColor: colors.border },
                  { height: day.amount > 0 ? (day.amount / Math.max(1, totalEarnings || 1)) * 60 : 4 },
                  i === chartData.length - 1 && [styles.miniBarActive, { backgroundColor: colors.primary }],
                ]}
              />
            ))}
          </View>
          <Text style={[styles.viewDetailsText, { color: colors.primary }]}>Tap to view full report →</Text>
        </TouchableOpacity>
      </AnimatedListItem>

      {/* Active Booking Session */}
      {activeBookingDisplay && (
        <AnimatedListItem index={1} direction="down">
          <View style={[styles.activeBookingCard, { backgroundColor: colors.backgroundCard, borderColor: colors.primary }]}>
            <View style={styles.activeBookingHeader}>
              <View style={[styles.pulseDot, { backgroundColor: colors.primary }]} />
              <Text style={[styles.activeBookingTitle, { color: colors.primary }]}>Active Booking</Text>
            </View>
            <Text style={[styles.guestName, { color: colors.text }]}>{activeBookingDisplay.guestName}</Text>
            <Text style={[styles.spotNameActive, { color: colors.textSecondary }]}>{activeBookingDisplay.spotName}</Text>
            <View style={[styles.activeBookingInfo, { backgroundColor: colors.background }]}>
              <View style={styles.infoItem}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Time</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{activeBookingDisplay.date}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Duration</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{activeBookingDisplay.duration}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Earning</Text>
                <Text style={[styles.earningValue, { color: colors.primary }]}>
                  ${activeBookingDisplay.amount.toFixed(2)}
                </Text>
              </View>
            </View>
            <View style={styles.activeActions}>
              <TouchableOpacity 
                style={[styles.activeActionBtn, { backgroundColor: colors.border }]}
                onPress={() => Alert.alert(
                  'Contact Guest',
                  `Send a message to ${activeBookingDisplay.guestName}?`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Message', onPress: () => Alert.alert('Message Sent', 'Guest will be notified') }
                  ]
                )}
                activeOpacity={0.7}
              >
                <Text style={[styles.activeActionText, { color: colors.text }]}>💬 Contact</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.activeActionBtn, { backgroundColor: colors.border }]}
                onPress={() => Alert.alert(
                  'Report Issue',
                  'What type of issue would you like to report?',
                  [
                    { text: 'No Show', onPress: () => Alert.alert('Reported', 'Issue has been reported') },
                    { text: 'Damage', onPress: () => Alert.alert('Reported', 'Issue has been reported') },
                    { text: 'Other', onPress: () => Alert.alert('Reported', 'Issue has been reported') },
                    { text: 'Cancel', style: 'cancel' }
                  ]
                )}
                activeOpacity={0.7}
              >
                <Text style={[styles.activeActionText, { color: colors.text }]}>⚠️ Report</Text>
              </TouchableOpacity>
            </View>
          </View>
        </AnimatedListItem>
      )}

      {/* Upcoming Bookings Section */}
      {upcomingBookings.length > 0 && (
        <>
          <View style={styles.sectionHeaderContainer}>
            <Text style={[styles.sectionHeader, { color: colors.text }]}>Upcoming Bookings</Text>
            <Text style={[styles.sectionCount, { color: colors.primary, backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
              {upcomingBookings.length}
            </Text>
          </View>
          {upcomingBookings.map((booking, index) => (
            <AnimatedListItem key={booking.id} index={index + 2} direction="up">
              <TouchableOpacity 
                style={[styles.upcomingBookingCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}
                onPress={() => setSelectedBooking(booking)}
                activeOpacity={0.8}
              >
                <View style={styles.bookingCardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.guestNameSmall, { color: colors.text }]}>{booking.guestName}</Text>
                    <Text style={[styles.spotNameSmall, { color: colors.textSecondary }]}>{booking.spotName}</Text>
                  </View>
                  <Text style={[styles.bookingAmount, { color: colors.primary }]}>
                    ${booking.amount.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.bookingCardFooter}>
                  <Text style={[styles.bookingTime, { color: colors.text }]}>📅 {booking.date}</Text>
                  <View style={[styles.durationBadgeSmall, { backgroundColor: colors.border }]}>
                    <Text style={[styles.durationTextSmall, { color: colors.text }]}>
                      {booking.duration}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            </AnimatedListItem>
          ))}
        </>
      )}

      {/* My Listings Section */}
      <View style={styles.sectionHeaderContainer}>
        <Text style={[styles.sectionHeader, { color: colors.text }]}>My Parking Spots</Text>
        <TouchableOpacity 
          onPress={onAddNew}
          activeOpacity={0.6}
        >
          <Text style={[styles.addNewText, { color: colors.primary }]}>+ Add New</Text>
        </TouchableOpacity>
      </View>
      
      {listings.map((l, index) => (
        <AnimatedListItem key={l.id} index={index + 10} direction="up">
          <AnimatedPressableButton
            style={[styles.listingCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}
            onPress={() => setSelectedListing(l)}
          >
            <View style={[styles.listingThumb, { backgroundColor: colors.background }]} />
            <View style={styles.listingInfo}>
              <Text style={[styles.listingName, { color: colors.text }]}>{l.title}</Text>
              <Text style={[styles.listingAddress, { color: colors.textSecondary }]}>{l.address}</Text>
              <View style={styles.listingMeta}>
                <Text style={[styles.listingPrice, { color: colors.primary }]}>
                  ${computeHourlyRate({
                    baseRate: l.pricePerHour ?? DEFAULT_BASE_RATE,
                    address: l.address,
                    startTime: new Date(),
                  }).toFixed(0)}/hr
                </Text>
                <View
                  style={[
                    styles.statusBadge,
                    l.status === 'Active'
                      ? [styles.statusActive, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]
                      : [styles.statusPaused, { backgroundColor: colors.border }],
                  ]}>
                  <View style={[
                    styles.statusDot,
                    { backgroundColor: l.status === 'Active' ? colors.primary : colors.textSecondary }
                  ]} />
                  <Text
                    style={
                      l.status === 'Active'
                        ? [styles.statusTextActive, { color: colors.primary }]
                        : [styles.statusTextPaused, { color: colors.textSecondary }]
                    }>
                    {l.status || 'Active'}
                  </Text>
                </View>
              </View>
            </View>
          </AnimatedPressableButton>
        </AnimatedListItem>
      ))}

      {listings.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🅿️</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Parking Spots Yet</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            List your parking spot and start earning money today!
          </Text>
          <TouchableOpacity 
            style={[styles.emptyButton, { backgroundColor: colors.primary }]} 
            onPress={onAddNew}
            activeOpacity={0.8}
          >
            <Text style={styles.emptyButtonText}>+ Add Your First Spot</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ height: 40 }} />

      {/* Earnings Modal */}
      <Modal visible={showEarnings} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalBackdrop} 
            onPress={() => setShowEarnings(false)}
            activeOpacity={1}
          />
          <View style={[styles.earningsModal, { backgroundColor: colors.backgroundCard }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Earnings Report</Text>
              <TouchableOpacity onPress={() => setShowEarnings(false)}>
                <Text style={[styles.modalClose, { color: colors.textSecondary }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.tabRow}>
              <TouchableOpacity
                onPress={() => setEarningsTab('week')}
                style={[
                  styles.tabButton,
                  { backgroundColor: colors.background },
                  earningsTab === 'week' && [styles.tabButtonActive, { backgroundColor: colors.primary }],
                ]}>
                <Text
                  style={[
                    styles.tabText,
                    { color: colors.textSecondary },
                    earningsTab === 'week' && styles.tabTextActive,
                  ]}>
                  This Week
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setEarningsTab('month')}
                style={[
                  styles.tabButton,
                  { backgroundColor: colors.background },
                  earningsTab === 'month' && [styles.tabButtonActive, { backgroundColor: colors.primary }],
                ]}>
                <Text
                  style={[
                    styles.tabText,
                    { color: colors.textSecondary },
                    earningsTab === 'month' && styles.tabTextActive,
                  ]}>
                  This Month
                </Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.earningsSummary, { backgroundColor: colors.background }]}>
              <Text style={[styles.earningsSummaryLabel, { color: colors.textSecondary }]}>
                {earningsTab === 'week' ? 'Weekly Revenue' : 'Monthly Revenue'}
              </Text>
              <Text style={[styles.earningsSummaryValue, { color: colors.primary }]}>
                ${earningsTab === 'week' ? weekEarnings.toFixed(2) : totalEarnings.toFixed(2)}
              </Text>
            </View>

            <ScrollView style={styles.chartScroll}>
              <View style={styles.chartContainer}>
                {chartData.map((day, i) => (
                  <TouchableOpacity 
                    key={i} 
                    style={styles.chartDay}
                    onPress={() => Alert.alert(
                      day.label,
                      `Revenue: $${day.amount.toFixed(2)}\nBookings: ${day.bookings}`
                    )}
                    activeOpacity={0.6}
                  >
                    <View
                      style={[
                        styles.chartBar,
                        { backgroundColor: colors.primary },
                        { height: day.amount > 0 ? (day.amount / Math.max(1, totalEarnings || 1)) * 120 : 8 },
                      ]}
                    />
                    <Text style={[styles.chartLabel, { color: colors.textSecondary }]}>{day.label}</Text>
                    <Text style={[styles.chartAmount, { color: colors.text }]}>${day.amount.toFixed(0)}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.breakdownSection}>
                <Text style={[styles.breakdownTitle, { color: colors.text }]}>Revenue Breakdown</Text>
                {chartData.slice(-5).reverse().map((day, i) => (
                  <TouchableOpacity 
                    key={i} 
                    style={[styles.breakdownRow, { borderBottomColor: colors.border }]}
                    onPress={() => Alert.alert(
                      `${day.label} Details`,
                      `Total Revenue: $${day.amount.toFixed(2)}\nBookings: ${day.bookings}\nAverage per booking: $${day.bookings ? (day.amount / day.bookings).toFixed(2) : '0.00'}`
                    )}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.breakdownDate, { color: colors.text }]}>{day.label}</Text>
                      <Text style={[styles.breakdownBookings, { color: colors.textSecondary }]}>
                        {day.bookings} bookings
                      </Text>
                    </View>
                    <Text style={[styles.breakdownAmount, { color: colors.primary }]}>
                      ${day.amount.toFixed(2)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Listing Details Modal */}
      <Modal visible={selectedListing !== null} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalBackdrop} 
            onPress={() => setSelectedListing(null)}
            activeOpacity={1}
          />
          <View style={[styles.listingModal, { backgroundColor: colors.backgroundCard }]}>
            {selectedListing && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>
                    {selectedListing.title}
                  </Text>
                  <TouchableOpacity onPress={() => setSelectedListing(null)}>
                    <Text style={[styles.modalClose, { color: colors.textSecondary }]}>✕</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView>
                  <Text style={[styles.listingModalAddress, { color: colors.textSecondary }]}>
                    {selectedListing.address}
                  </Text>

                  <View style={styles.listingModalStats}>
                    <View style={styles.modalStatItem}>
                      <Text style={[styles.modalStatLabel, { color: colors.textSecondary }]}>Price</Text>
                      <Text style={[styles.modalStatValue, { color: colors.primary }]}>
                        ${computeHourlyRate({
                          baseRate: selectedListing.pricePerHour ?? DEFAULT_BASE_RATE,
                          address: selectedListing.address,
                          startTime: new Date(),
                        }).toFixed(2)}/hr
                      </Text>
                    </View>
                    <View style={styles.modalStatItem}>
                      <Text style={[styles.modalStatLabel, { color: colors.textSecondary }]}>Status</Text>
                      <View style={[
                        styles.statusBadge,
                        selectedListing.status === 'Active'
                          ? [styles.statusActive, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]
                          : [styles.statusPaused, { backgroundColor: colors.border }],
                      ]}>
                        <View style={[
                          styles.statusDot,
                          { backgroundColor: selectedListing.status === 'Active' ? colors.primary : colors.textSecondary }
                        ]} />
                        <Text style={
                          selectedListing.status === 'Active'
                            ? [styles.statusTextActive, { color: colors.primary }]
                            : [styles.statusTextPaused, { color: colors.textSecondary }]
                        }>
                          {selectedListing.status}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.modalActions}>
                    <TouchableOpacity 
                      style={[styles.modalActionButton, { backgroundColor: colors.border }]}
                      onPress={() => {
                        setSelectedListing(null);
                        Alert.alert('Edit Listing', 'Opening edit form...', [
                          { text: 'OK', onPress: () => router.push('/add-listing') }
                        ]);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.modalActionText, { color: colors.text }]}>✏️ Edit Details</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={[
                        styles.modalActionButton,
                        selectedListing.status === 'Active'
                          ? [styles.pauseButton, { backgroundColor: colors.badgePending }]
                          : [styles.activateButton, { backgroundColor: colors.primary }]
                      ]}
                      onPress={() => {
                        Alert.alert(
                          selectedListing.status === 'Active' ? 'Pause Listing' : 'Activate Listing',
                          `${selectedListing.status === 'Active' ? 'This will stop new bookings from being made.' : 'This will allow new bookings to be made.'}`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { 
                              text: 'Confirm',
                              onPress: () => {
                                Alert.alert('Updated', `Listing ${selectedListing.status === 'Active' ? 'paused' : 'activated'} successfully`);
                                setSelectedListing(null);
                              }
                            }
                          ]
                        );
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.modalActionText, { color: 'white' }]}>
                        {selectedListing.status === 'Active' ? '⏸️ Pause Listing' : '▶️ Activate Listing'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={[
                        styles.modalActionButton,
                        styles.deleteButton,
                        { borderColor: colors.badgeCancelled }
                      ]}
                      onPress={() => {
                        Alert.alert(
                          'Delete Listing', 
                          'Are you sure you want to delete this listing? This action cannot be undone and will cancel all upcoming bookings.', 
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { 
                              text: 'Delete', 
                              style: 'destructive', 
                              onPress: () => {
                                (async () => {
                                  if (!hostId) return;
                                  const { error } = await supabase
                                    .from('spots')
                                    .delete()
                                    .eq('id', selectedListing.id)
                                    .eq('host_id', hostId);

                                  if (error) {
                                    Alert.alert('Delete failed', error.message);
                                    return;
                                  }

                                  setSelectedListing(null);
                                  fetchListings(hostId);
                                  Alert.alert('Deleted', 'Listing has been removed');
                                })();
                              }
                            },
                          ]
                        );
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.deleteActionText, { color: colors.badgeCancelled }]}>🗑️ Delete Listing</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Booking Details Modal */}
      <Modal visible={selectedBooking !== null} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalBackdrop} 
            onPress={() => setSelectedBooking(null)}
            activeOpacity={1}
          />
          <View style={[styles.listingModal, { backgroundColor: colors.backgroundCard }]}>
            {selectedBooking && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>Booking Details</Text>
                  <TouchableOpacity onPress={() => setSelectedBooking(null)}>
                    <Text style={[styles.modalClose, { color: colors.textSecondary }]}>✕</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView>
                  <View style={[styles.bookingDetailCard, { backgroundColor: colors.background }]}
                  >
                    <Text style={[styles.bookingDetailLabel, { color: colors.textSecondary }]}>Guest</Text>
                    <Text style={[styles.bookingDetailValue, { color: colors.text }]}>
                      {selectedBooking.guestName}
                    </Text>
                  </View>

                  <View style={[styles.bookingDetailCard, { backgroundColor: colors.background }]}>
                    <Text style={[styles.bookingDetailLabel, { color: colors.textSecondary }]}>Parking Spot</Text>
                    <Text style={[styles.bookingDetailValue, { color: colors.text }]}>
                      {selectedBooking.spotName}
                    </Text>
                  </View>

                  <View style={[styles.bookingDetailCard, { backgroundColor: colors.background }]}>
                    <Text style={[styles.bookingDetailLabel, { color: colors.textSecondary }]}>Date & Time</Text>
                    <Text style={[styles.bookingDetailValue, { color: colors.text }]}>
                      {selectedBooking.date}
                    </Text>
                  </View>

                  <View style={[styles.bookingDetailCard, { backgroundColor: colors.background }]}>
                    <Text style={[styles.bookingDetailLabel, { color: colors.textSecondary }]}>Duration</Text>
                    <Text style={[styles.bookingDetailValue, { color: colors.text }]}>
                      {selectedBooking.duration}
                    </Text>
                  </View>

                  <View style={[styles.bookingDetailCard, { backgroundColor: colors.background }]}>
                    <Text style={[styles.bookingDetailLabel, { color: colors.textSecondary }]}>Earnings</Text>
                    <Text style={[styles.bookingDetailValue, { color: colors.primary }]}>
                      ${selectedBooking.amount.toFixed(2)}
                    </Text>
                  </View>

                  <View style={[styles.bookingDetailCard, { backgroundColor: colors.background }]}>
                    <Text style={[styles.bookingDetailLabel, { color: colors.textSecondary }]}>Status</Text>
                    <View style={[
                      styles.statusBadge,
                      selectedBooking.status === 'Active'
                        ? [styles.statusActive, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]
                        : [styles.statusPaused, { backgroundColor: colors.border }],
                    ]}>
                      <View style={[
                        styles.statusDot,
                        { backgroundColor: selectedBooking.status === 'Active' ? colors.primary : colors.badgePending }
                      ]} />
                      <Text style={
                        selectedBooking.status === 'Active'
                          ? [styles.statusTextActive, { color: colors.primary }]
                          : [styles.statusTextPaused, { color: colors.textSecondary }]
                      }>
                        {selectedBooking.status}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.modalActions}>
                    <TouchableOpacity 
                      style={[styles.modalActionButton, { backgroundColor: colors.border }]}
                      onPress={() => {
                        Alert.alert('Message Guest', `Send a message to ${selectedBooking.guestName}`);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.modalActionText, { color: colors.text }]}>💬 Message Guest</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={[styles.modalActionButton, { backgroundColor: colors.border }]}
                      onPress={() => {
                        Alert.alert('View Spot', `View details for ${selectedBooking.spotName}`);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.modalActionText, { color: colors.text }]}>📍 View Spot</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={[
                        styles.modalActionButton,
                        styles.deleteButton,
                        { borderColor: colors.badgeCancelled }
                      ]}
                      onPress={() => {
                        Alert.alert(
                          'Cancel Booking',
                          'Are you sure you want to cancel this booking? The guest will be notified.',
                          [
                            { text: 'Keep Booking', style: 'cancel' },
                            { 
                              text: 'Cancel Booking', 
                              style: 'destructive',
                              onPress: () => {
                                Alert.alert('Cancelled', 'Booking has been cancelled.');
                                setSelectedBooking(null);
                              }
                            },
                          ]
                        );
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.deleteActionText, { color: colors.badgeCancelled }]}>❌ Cancel Booking</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
  },

  // Stats Dashboard
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Today's Earnings Card
  todayEarningsCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 18,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  earningsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  todayLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  todayAmount: {
    fontSize: 36,
    fontWeight: '800',
  },
  trendBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  trendText: {
    fontSize: 14,
    fontWeight: '700',
  },
  miniChart: {
    flexDirection: 'row',
    height: 60,
    alignItems: 'flex-end',
    gap: 6,
    marginBottom: 12,
  },
  miniBar: {
    flex: 1,
    borderRadius: 4,
    minHeight: 4,
  },
  miniBarActive: {},
  viewDetailsText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Active Booking Card
  activeBookingCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 18,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  activeBookingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  activeBookingTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  guestName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  spotNameActive: {
    fontSize: 14,
    marginBottom: 16,
  },
  activeBookingInfo: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    borderRadius: 12,
    padding: 12,
  },
  infoItem: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    marginBottom: 4,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  earningValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  activeActions: {
    flexDirection: 'row',
    gap: 8,
  },
  activeActionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  activeActionText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Upcoming Bookings
  sectionHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionCount: {
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  addNewText: {
    fontSize: 14,
    fontWeight: '600',
  },
  upcomingBookingCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bookingCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  guestNameSmall: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  spotNameSmall: {
    fontSize: 13,
  },
  bookingAmount: {
    fontSize: 18,
    fontWeight: '700',
  },
  bookingCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bookingTime: {
    fontSize: 13,
  },
  durationBadgeSmall: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  durationTextSmall: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Listing Cards
  listingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  listingThumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
    marginRight: 16,
  },
  listingInfo: {
    flex: 1,
  },
  listingName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  listingAddress: {
    fontSize: 12,
    marginBottom: 8,
  },
  listingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  listingPrice: {
    fontSize: 15,
    fontWeight: '700',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  statusActive: {
  },
  statusPaused: {
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusTextActive: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusTextPaused: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  emptyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  earningsModal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 20,
    maxHeight: '85%',
  },
  listingModal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '75%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  modalClose: {
    fontSize: 28,
    fontWeight: '300',
  },
  tabRow: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 12,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabButtonActive: {
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextActive: {
    color: 'white',
    fontWeight: '700',
  },
  earningsSummary: {
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  earningsSummaryLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  earningsSummaryValue: {
    fontSize: 40,
    fontWeight: '800',
  },
  chartScroll: {
    maxHeight: 400,
  },
  chartContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  chartDay: {
    flex: 1,
    alignItems: 'center',
  },
  chartBar: {
    width: '100%',
    borderRadius: 6,
    minHeight: 8,
    marginBottom: 8,
  },
  chartLabel: {
    fontSize: 10,
    marginBottom: 4,
    textAlign: 'center',
  },
  chartAmount: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  breakdownSection: {
    marginTop: 20,
    paddingBottom: 20,
  },
  breakdownTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  breakdownDate: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  breakdownBookings: {
    fontSize: 12,
  },
  breakdownAmount: {
    fontSize: 16,
    fontWeight: '700',
  },

  // Listing Modal
  listingModalAddress: {
    fontSize: 14,
    marginBottom: 20,
  },
  listingModalStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  modalStatItem: {
    flex: 1,
  },
  modalStatLabel: {
    fontSize: 12,
    marginBottom: 8,
    fontWeight: '600',
  },
  modalStatValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalActions: {
    gap: 12,
  },
  modalActionButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalActionText: {
    fontSize: 15,
    fontWeight: '600',
  },
  pauseButton: {
  },
  activateButton: {
  },
  deleteButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  deleteActionText: {
    fontSize: 15,
    fontWeight: '600',
  },

  // Booking Details Modal
  bookingDetailCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  bookingDetailLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bookingDetailValue: {
    fontSize: 16,
    fontWeight: '600',
  },
});
