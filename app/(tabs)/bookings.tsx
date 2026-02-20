import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { AnimatedPressableButton } from '@/components/ui/animated-pressable';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

type BookingItem = {
  id: string;
  spotName: string;
  address: string;
  date: string;
  timeStart: string;
  timeEnd: string;
  hours: number;
  pricePerHour: number;
  totalPrice: number;
  status: string;
  checkInCode: string;
  instructions: string;
  fees: number;
  type: 'upcoming' | 'past';
  startTime: Date;
  endTime: Date;
  isActive: boolean;
};

export default function BookingsScreen() {
  const { colorScheme, colors } = useTheme();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [selectedBooking, setSelectedBooking] = useState<BookingItem | null>(null);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update timer every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchBookings = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setBookings([]);
        return;
      }

      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .or(`guest_id.eq.${user.id},user_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) {
        setBookings([]);
        return;
      }

      const now = Date.now();
      const mapped = (data ?? []).map((row: any) => {
        const startRaw = row?.start_time ?? row?.startTime ?? row?.date ?? row?.created_at;
        const endRaw = row?.end_time ?? row?.endTime;
        const start = startRaw ? new Date(startRaw) : new Date();
        const end = endRaw ? new Date(endRaw) : new Date(start.getTime() + 60 * 60 * 1000);
        const hours = Number(row?.hours ?? Math.max(1, Math.round(((end.getTime() - start.getTime()) / 3600000) * 10) / 10));
        const status = String(row?.status ?? 'Pending');
        const statusLower = status.toLowerCase();
        const isActive = statusLower === 'active';
        const isPast = ['paid', 'completed', 'cancelled'].includes(statusLower) || end.getTime() < now;

        return {
          id: String(row?.id ?? ''),
          spotName: row?.spot_name ?? row?.spot_title ?? row?.spotName ?? row?.address ?? 'Parking Spot',
          address: row?.address ?? 'Address unavailable',
          date: start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          timeStart: start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          timeEnd: end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          hours,
          pricePerHour: Number(row?.price_per_hour ?? row?.pricePerHour ?? row?.price ?? 0),
          totalPrice: Number(row?.amount ?? row?.total ?? 0),
          status,
          checkInCode: row?.check_in_code ?? row?.checkInCode ?? '—',
          instructions: row?.instructions ?? row?.notes ?? 'No instructions provided.',
          fees: Number(row?.fees ?? 0),
          type: isPast ? 'past' : 'upcoming',
          startTime: start,
          endTime: end,
          isActive,
        } as BookingItem;
      });

      setBookings(mapped);
    };

    fetchBookings();

    const channel = supabase
      .channel('bookings-guest')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        fetchBookings();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredBookings = useMemo(() => (
    bookings.filter((b) => {
      if (activeTab === 'upcoming') return b.type === 'upcoming';
      if (activeTab === 'past') return b.type === 'past';
      return false;
    })
  ), [activeTab, bookings]);

  const activeBooking = useMemo(() => bookings.find(b => b.isActive), [bookings]);
  const upcomingCount = useMemo(() => bookings.filter(b => b.type === 'upcoming').length, [bookings]);
  const pastCount = useMemo(() => bookings.filter(b => b.type === 'past').length, [bookings]);
  const totalSpent = useMemo(
    () => bookings.filter(b => b.type === 'past').reduce((sum, b) => sum + b.totalPrice, 0),
    [bookings]
  );

  const getTimeRemaining = (endTime: Date) => {
    const diff = endTime.getTime() - currentTime.getTime();
    if (diff <= 0) return 'Expired';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}m left`;
    return `${minutes}m left`;
  };

  const getTimeUntil = (startTime: Date) => {
    const diff = startTime.getTime() - currentTime.getTime();
    if (diff <= 0) return 'Now';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) {
      const minutes = Math.floor(diff / (1000 * 60));
      return `in ${minutes}m`;
    }
    if (hours < 24) return `in ${hours}h`;
    const days = Math.floor(hours / 24);
    return `in ${days}d`;
  };

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'active') return colors.badgeConfirmed;
    if (s === 'confirmed') return colorScheme === 'dark' ? '#60a5fa' : '#3b82f6';
    if (s === 'pending') return colors.badgePending;
    if (s === 'paid' || s === 'completed') return colors.textSecondary;
    if (s === 'cancelled') return colors.badgeCancelled;
    return colors.textSecondary;
  };

  const updateBookingStatus = async (bookingId: string, status: 'paid' | 'cancelled' | 'confirmed') => {
    const updates: Record<string, any> = { status };
    if (status === 'paid') {
      updates.paid_at = new Date().toISOString();
    }
    if (status === 'cancelled') {
      updates.cancelled_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('bookings')
      .update(updates)
      .eq('id', bookingId);

    if (error) {
      Alert.alert('Update failed', error.message);
      return false;
    }

    return true;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView>
        {/* Stats Summary */}
        <View style={styles.statsContainer}>
          <View style={[styles.statCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}
          >
            <Text style={[styles.statValue, { color: colors.primary }]}>{upcomingCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Upcoming</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}
          >
            <Text style={[styles.statValue, { color: colors.primary }]}>
              ${totalSpent.toFixed(0)}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Spent</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}
          >
            <Text style={[styles.statValue, { color: colors.primary }]}>
              {pastCount}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Completed</Text>
          </View>
        </View>

        {/* Active Parking Session */}
        {activeBooking && (
          <AnimatedListItem index={0} direction="down">
            <View style={[
              styles.activeSessionCard,
              { backgroundColor: colors.backgroundCard, borderColor: colors.primary, shadowColor: colors.primary }
            ]}>
              <View style={styles.activeSessionHeader}>
                <View style={[styles.pulseDot, { backgroundColor: colors.primary }]} />
                <Text style={[styles.activeSessionTitle, { color: colors.primary }]}>Active Parking Session</Text>
              </View>
              <Text style={[styles.activeSessionSpot, { color: colors.text }]}>{activeBooking.spotName}</Text>
              <Text style={[styles.activeSessionAddress, { color: colors.textSecondary }]}>
                {activeBooking.address}
              </Text>
              
              <View style={[styles.timerContainer, { backgroundColor: colors.background, borderLeftColor: colors.primary }]}
              >
                <Text style={[styles.timerLabel, { color: colors.textSecondary }]}>Time Remaining</Text>
                <Text style={[styles.timerValue, { color: colors.primary }]}>
                  {getTimeRemaining(activeBooking.endTime)}
                </Text>
              </View>

              <View style={styles.activeSessionActions}>
                <TouchableOpacity 
                  style={[styles.activeActionButton, { backgroundColor: colors.border }]}
                  onPress={() => Alert.alert('Directions', 'Opening map...')}
                >
                  <Text style={[styles.activeActionText, { color: colors.text }]}>🗺️ Directions</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.activeActionButton, { backgroundColor: colors.border }]}
                  onPress={() => Alert.alert('Gate Code', `Your code: ${activeBooking.checkInCode}`)}
                >
                  <Text style={[styles.activeActionText, { color: colors.text }]}>🔑 Gate Code</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.activeActionButton, styles.extendButton, { backgroundColor: colors.primary }]}
                  onPress={() => Alert.alert('Extend Time', 'Add more parking time?')}
                >
                  <Text style={[styles.activeActionText, styles.extendText]}>⏱️ Extend</Text>
                </TouchableOpacity>
              </View>
            </View>
          </AnimatedListItem>
        )}

        {/* Tab Toggle */}
        <View style={styles.tabContainer}>
          {['upcoming', 'past'].map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.tab,
                { backgroundColor: colors.backgroundCard },
                activeTab === tab && [styles.tabActive, { backgroundColor: colors.primary }],
              ]}
              onPress={() => setActiveTab(tab as 'upcoming' | 'past')}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: colors.textSecondary },
                  activeTab === tab && styles.tabTextActive,
                ]}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
              <View
                style={[
                  styles.tabBadge,
                  { backgroundColor: colors.border },
                  activeTab === tab && [styles.tabBadgeActive, { backgroundColor: colors.primary }],
                ]}
              >
                <Text
                  style={[
                    styles.tabBadgeText,
                    { color: colors.textSecondary },
                    activeTab === tab && styles.tabBadgeTextActive,
                  ]}
                >
                  {tab === 'upcoming' ? upcomingCount : pastCount}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Bookings List */}
        <View style={styles.listContainer}>
          {filteredBookings.map((item, index) => (
            <AnimatedListItem key={item.id} index={index + 1} direction="up">
              <AnimatedPressableButton
                style={[
                  styles.bookingCard,
                  { backgroundColor: colors.backgroundCard, borderColor: colors.border },
                  item.isActive && [styles.bookingCardActive, { borderColor: colors.primary }],
                ]}
                onPress={() => setSelectedBooking(item)}
              >
                {/* Header: Spot Name + Status */}
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.spotName, { color: colors.text }]}>{item.spotName}</Text>
                    <Text style={[styles.address, { color: colors.textSecondary }]}>{item.address}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                    <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
                    <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                      {item.status}
                    </Text>
                  </View>
                </View>

                {/* Date & Time */}
                <View style={styles.cardSection}>
                  <View style={styles.infoRow}>
                    <Text style={styles.iconLabel}>📅</Text>
                    <Text style={[styles.dateTime, { color: colors.textSecondary }]}>
                      {item.date} • {item.timeStart}–{item.timeEnd}
                    </Text>
                  </View>
                  {activeTab === 'upcoming' && !item.isActive && (
                    <Text style={[styles.countdownText, { color: colors.primary }]}>Starts {getTimeUntil(item.startTime)}</Text>
                  )}
                </View>

                {/* Price & Duration */}
                <View style={styles.priceRow}>
                  <View style={[styles.durationBadge, { backgroundColor: colors.border }]}
                  >
                    <Text style={[styles.durationText, { color: colors.text }]}>{item.hours}h</Text>
                  </View>
                  <Text style={[styles.price, { color: colors.primary }]}>${item.totalPrice.toFixed(2)}</Text>
                </View>

                {/* Quick Actions */}
                <View style={styles.buttonGroup}>
                  <TouchableOpacity 
                    style={[styles.buttonSmall, { backgroundColor: colors.border }]} 
                    onPress={() => setSelectedBooking(item)}
                  >
                    <Text style={[styles.buttonSmallText, { color: colors.text }]}>View Details</Text>
                  </TouchableOpacity>

                  {activeTab === 'past' && (
                    <TouchableOpacity 
                      style={[styles.buttonSmall, styles.buttonPrimary, { backgroundColor: colors.primary }]}
                      onPress={() => Alert.alert('Book Again', `Rebook ${item.spotName}?`)}
                    >
                      <Text style={styles.buttonPrimaryText}>Book Again</Text>
                    </TouchableOpacity>
                  )}

                  {activeTab === 'upcoming' && !item.isActive && (
                    <TouchableOpacity 
                      style={[
                        styles.buttonSmall,
                        styles.buttonOutline,
                        { borderColor: colors.badgeCancelled }
                      ]}
                      onPress={() => {
                        Alert.alert('Cancel Booking', 'Cancel this booking?', [
                          { text: 'Keep', style: 'cancel' },
                          {
                            text: 'Cancel Booking',
                            style: 'destructive',
                            onPress: async () => {
                              await updateBookingStatus(item.id, 'cancelled');
                            }
                          }
                        ]);
                      }}
                    >
                      <Text style={[styles.buttonOutlineText, { color: colors.badgeCancelled }]}>Cancel</Text>
                    </TouchableOpacity>
                  )}

                  {activeTab === 'upcoming' && item.status.toLowerCase() !== 'paid' && item.status.toLowerCase() !== 'cancelled' && (
                    <TouchableOpacity 
                      style={[styles.buttonSmall, styles.buttonPrimary, { backgroundColor: colors.primary }]}
                      onPress={async () => {
                        const ok = await updateBookingStatus(item.id, 'paid');
                        if (ok) {
                          Alert.alert('Confirmed', 'Booking marked as paid.');
                        }
                      }}
                    >
                      <Text style={styles.buttonPrimaryText}>Confirm</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </AnimatedPressableButton>
            </AnimatedListItem>
          ))}

          {filteredBookings.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {activeTab === 'upcoming' ? 'No Upcoming Bookings' : 'No Past Bookings'}
              </Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {activeTab === 'upcoming' 
                  ? 'Find a parking spot on the Map tab to get started!' 
                  : 'Your completed bookings will appear here.'}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Booking Details Modal */}
      <Modal visible={selectedBooking !== null} animationType="slide">
        <View style={[styles.detailsContainer, { backgroundColor: colors.background }]}>
          {/* Reserve Button */}
          <View style={[styles.modalHeader, { backgroundColor: colors.backgroundCard, borderBottomColor: colors.border }]}>
            {selectedBooking && selectedBooking.status.toLowerCase() !== 'paid' && selectedBooking.status.toLowerCase() !== 'cancelled' && (
              <TouchableOpacity
                style={[styles.reserveButton, { backgroundColor: colors.primary }]}
                onPress={async () => {
                  const ok = await updateBookingStatus(selectedBooking.id, 'paid');
                  if (ok) {
                    Alert.alert('Confirmed', 'Booking marked as paid.');
                    setSelectedBooking(null);
                  }
                }}
              >
                <Text style={styles.reserveButtonText}>Confirm Booking</Text>
              </TouchableOpacity>
            )}
            {selectedBooking && (selectedBooking.status.toLowerCase() === 'paid' || selectedBooking.status.toLowerCase() === 'cancelled') && (
              <Text style={[styles.reserveButtonText, { color: colors.textSecondary }]}>No actions available</Text>
            )}
          </View>

          <ScrollView contentContainerStyle={styles.detailsContent}>
            {selectedBooking && (
              <>
                {/* Spot Info */}
                <View style={styles.detailsSection}>
                  <Text style={[styles.detailsTitle, { color: colors.text }]}>{selectedBooking.spotName}</Text>
                  <Text style={[styles.detailsAddress, { color: colors.textSecondary }]}>{selectedBooking.address}</Text>
                </View>

                {/* Date & Time Details */}
                <View style={styles.detailsSection}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Date & Time</Text>
                  <Text style={[styles.detailsText, { color: colors.textSecondary }]}>
                    {selectedBooking.date} {selectedBooking.timeStart}–
                    {selectedBooking.timeEnd}
                  </Text>
                  <Text style={[styles.detailsText, { color: colors.textSecondary }]}>
                    {selectedBooking.hours} hours
                  </Text>
                </View>

                {/* Check-in Instructions */}
                <View style={styles.detailsSection}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Check-in Instructions</Text>
                  <Text
                    style={[
                      styles.instructionBox,
                      { backgroundColor: colors.backgroundCard, borderLeftColor: colors.primary, color: colors.textSecondary }
                    ]}
                  >
                    Gate Code: {selectedBooking.checkInCode}
                  </Text>
                  <Text style={[styles.detailsText, { color: colors.textSecondary }]}>
                    {selectedBooking.instructions}
                  </Text>
                </View>

                {/* Receipt Breakdown */}
                <View style={styles.detailsSection}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Receipt</Text>
                  <View style={[styles.receiptRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.receiptLabel, { color: colors.textSecondary }]}>
                      {selectedBooking.hours} hrs × ${selectedBooking.pricePerHour.toFixed(2)}/hr
                    </Text>
                    <Text style={[styles.receiptValue, { color: colors.text }]}>
                      ${(selectedBooking.hours * selectedBooking.pricePerHour).toFixed(2)}
                    </Text>
                  </View>
                  {selectedBooking.fees > 0 && (
                    <View style={[styles.receiptRow, { borderBottomColor: colors.border }]}>
                      <Text style={[styles.receiptLabel, { color: colors.textSecondary }]}>Service Fee</Text>
                      <Text style={[styles.receiptValue, { color: colors.text }]}>${selectedBooking.fees.toFixed(2)}</Text>
                    </View>
                  )}
                  <View style={[styles.receiptRow, styles.receiptTotal, { borderTopColor: colors.border }]}
                  >
                    <Text style={[styles.receiptTotalLabel, { color: colors.text }]}>Total</Text>
                    <Text style={[styles.receiptTotalValue, { color: colors.primary }]}>
                      ${selectedBooking.totalPrice.toFixed(2)}
                    </Text>
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.detailsSection}>
                  <TouchableOpacity
                    style={[styles.directionButton, { backgroundColor: colors.primary }]}
                  >
                    <Text style={styles.directionButtonText}>📍 Get Directions</Text>
                  </TouchableOpacity>

                  {activeTab === 'upcoming' && (
                    <>
                      <TouchableOpacity
                        style={[
                          styles.messageButton,
                          { backgroundColor: colorScheme === 'dark' ? '#60a5fa' : '#3b82f6' }
                        ]}
                      >
                        <Text style={styles.messageButtonText}>💬 Message Host</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.supportButton, { backgroundColor: colors.border }]}>
                        <Text style={[styles.supportButtonText, { color: colors.text }]}>⚠️ Report Issue</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.buttonSmall,
                          styles.buttonCancel,
                          { backgroundColor: colors.badgeCancelled, marginTop: 12 }
                        ]}
                        onPress={() => {
                          if (!selectedBooking) return;
                          Alert.alert('Cancel Booking', 'Are you sure you want to cancel?', [
                            { text: 'Keep', style: 'cancel' },
                            {
                              text: 'Cancel Booking',
                              style: 'destructive',
                              onPress: async () => {
                                const ok = await updateBookingStatus(selectedBooking.id, 'cancelled');
                                if (ok) setSelectedBooking(null);
                              }
                            }
                          ]);
                        }}
                      >
                        <Text style={styles.buttonCancelText}>Cancel Booking</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>

                {/* Close Button at Bottom */}
                <View style={styles.detailsSection}>
                  <TouchableOpacity
                    style={[styles.closeButtonBottom, { backgroundColor: colors.border }]}
                    onPress={() => setSelectedBooking(null)}
                  >
                    <Text style={[styles.closeButtonBottomText, { color: colors.text }]}>Close</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Stats Summary
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
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
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

  // Active Parking Session
  activeSessionCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  activeSessionHeader: {
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
  activeSessionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  activeSessionSpot: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  activeSessionAddress: {
    fontSize: 14,
    marginBottom: 16,
  },
  timerContainer: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
  },
  timerLabel: {
    fontSize: 12,
    marginBottom: 6,
    fontWeight: '600',
  },
  timerValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  activeSessionActions: {
    flexDirection: 'row',
    gap: 8,
  },
  activeActionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  activeActionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  extendButton: {
  },
  extendText: {
    color: 'white',
  },

  // Tabs
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  tabActive: {
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
  },
  tabTextActive: {
    color: 'white',
  },
  tabBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 24,
    alignItems: 'center',
  },
  tabBadgeActive: {
  },
  tabBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  tabBadgeTextActive: {
    color: 'white',
  },

  // Bookings List
  listContainer: {
    padding: 16,
    paddingTop: 0,
    paddingBottom: 32,
  },
  bookingCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  bookingCardActive: {
    borderWidth: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  spotName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  address: {
    fontSize: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  cardSection: {
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  iconLabel: {
    fontSize: 14,
  },
  dateTime: {
    fontSize: 13,
    fontWeight: '500',
  },
  countdownText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  durationBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  durationText: {
    fontSize: 13,
    fontWeight: '700',
  },
  price: {
    fontSize: 20,
    fontWeight: '700',
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  buttonSmall: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonSmallText: {
    fontSize: 13,
    fontWeight: '600',
  },
  buttonPrimary: {
  },
  buttonPrimaryText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
  buttonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  buttonOutlineText: {
    fontSize: 13,
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
  },

  // Modal Details
  detailsContainer: {
    flex: 1,
    paddingTop: 16,
  },
  modalHeader: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    paddingTop: 24,
    borderBottomWidth: 1,
  },
  reserveButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  reserveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  detailsContent: {
    padding: 16,
    paddingBottom: 40,
  },
  detailsSection: {
    marginBottom: 24,
  },
  detailsTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  detailsAddress: {
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  detailsText: {
    fontSize: 14,
    marginBottom: 8,
  },
  instructionBox: {
    borderLeftWidth: 3,
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
    fontWeight: '600',
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  receiptLabel: {
    fontSize: 13,
  },
  receiptValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  receiptTotal: {
    borderBottomWidth: 0,
    borderTopWidth: 2,
    paddingTop: 12,
    marginTop: 12,
  },
  receiptTotalLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  receiptTotalValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  directionButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  directionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  messageButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  messageButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  supportButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  supportButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  closeButtonBottom: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonBottomText: {
    fontSize: 14,
    fontWeight: '600',
  },
  buttonCancel: {
  },
  buttonCancelText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
});
