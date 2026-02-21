import { AnimatedListItem } from '@/components/ui/animated-list-item';
import { AnimatedPressableButton } from '@/components/ui/animated-pressable';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function WalletScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const handleAddPaymentMethod = () => {
    Alert.alert('Add Payment Method', 'Payment method setup coming soon');
  };

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const fetchWallet = async () => {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setTotalEarnings(0);
        setTransactions([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('host_id', user.id)
        .eq('status', 'paid')
        .order('created_at', { ascending: false });

      if (error) {
        setTotalEarnings(0);
        setTransactions([]);
        setLoading(false);
        return;
      }

      const rows = data ?? [];
      const sum = rows.reduce((acc, row) => acc + Number(row?.amount ?? 0), 0);
      setTotalEarnings(sum);
      setTransactions(rows);
      setLoading(false);
    };

    fetchWallet();

    channel = supabase
      .channel('bookings-wallet')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        fetchWallet();
      })
      .subscribe();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const renderedTransactions = useMemo(
    () => transactions.map((transaction) => {
      const raw = transaction?.paid_at ?? transaction?.created_at ?? transaction?.start_time;
      const date = raw ? new Date(raw).toLocaleDateString() : '—';
      return {
        id: transaction?.id ?? `${transaction?.spot_id ?? ''}-${date}`,
        title: transaction?.spot_name ?? transaction?.spot_title ?? transaction?.address ?? 'Parking',
        date,
        amount: Number(transaction?.amount ?? 0),
      };
    }),
    [transactions]
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.backgroundCard, paddingTop: insets.top + 16 }]}>
        <TouchableOpacity 
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }} 
          style={styles.backButton}
        >
          <IconSymbol name="chevron.left" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Wallet</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        {/* Balance Card */}
        <AnimatedListItem index={0} direction="down">
          <View style={[styles.balanceCard, { backgroundColor: colors.primary }]}>
            <Text style={[styles.balanceLabel, { color: 'rgba(255,255,255,0.8)' }]}>Total Earnings</Text>
            <Text style={[styles.balanceAmount, { color: '#fff' }]}>
              {loading ? '—' : `$${totalEarnings.toFixed(2)}`}
            </Text>
            <View style={styles.balanceFooter}>
              <Text style={[styles.balanceHint, { color: 'rgba(255,255,255,0.8)' }]}>Available to cash out</Text>
              <AnimatedPressableButton 
                style={styles.cashOutButton}
                onPress={() => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  Alert.alert('Cash Out', 'Your funds are on the way!');
                }}
              >
                <Text style={[styles.cashOutText, { color: colors.primary }]}>Cash Out</Text>
              </AnimatedPressableButton>
            </View>
          </View>
        </AnimatedListItem>

        {/* Payment Methods */}
        <AnimatedListItem index={1} direction="up">
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Payment Methods</Text>
              <TouchableOpacity 
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  handleAddPaymentMethod();
                }}
              >
                <Text style={[styles.addButton, { color: colors.primary }]}>+ Add</Text>
              </TouchableOpacity>
            </View>

            <AnimatedPressableButton 
              style={[styles.paymentCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                handleAddPaymentMethod();
              }}
            >
              <View style={[styles.paymentIcon, { backgroundColor: colors.background }]}>
                <IconSymbol name="creditcard.fill" size={24} color={colors.textSecondary} />
              </View>
              <Text style={[styles.paymentEmptyText, { color: colors.textSecondary }]}>Add a bank account or card</Text>
              <IconSymbol name="chevron.right" size={20} color={colors.textSecondary} />
            </AnimatedPressableButton>
          </View>
        </AnimatedListItem>

        {/* Transaction History */}
        <AnimatedListItem index={2} direction="up">
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Transactions</Text>
            
            {!loading && renderedTransactions.length === 0 && (
              <View style={[styles.emptyTransactionCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
                <IconSymbol name="doc.text.magnifyingglass" size={32} color={colors.textSecondary} />
                <Text style={[styles.emptyTransactionText, { color: colors.textSecondary }]}>No paid bookings yet.</Text>
              </View>
            )}

            {renderedTransactions.map((transaction, index) => (
              <AnimatedListItem key={transaction.id} index={index + 3} direction="up">
                <AnimatedPressableButton 
                  style={[styles.transactionCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    Alert.alert('Transaction Details', `${transaction.title}\n${transaction.date}\n$${transaction.amount.toFixed(2)}`);
                  }}
                >
                  <View style={[styles.transactionIcon, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                    <IconSymbol name="arrow.down.left" size={20} color="#10b981" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.transactionTitle, { color: colors.text }]} numberOfLines={1}>{transaction.title}</Text>
                    <Text style={[styles.transactionDate, { color: colors.textSecondary }]}>{transaction.date}</Text>
                  </View>
                  <Text style={[styles.transactionAmount, { color: '#10b981' }]}>+${transaction.amount.toFixed(2)}</Text>
                </AnimatedPressableButton>
              </AnimatedListItem>
            ))}
          </View>
        </AnimatedListItem>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150,150,150,0.2)',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  balanceCard: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  balanceLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 48,
    fontWeight: '800',
    marginBottom: 24,
    letterSpacing: -1,
  },
  balanceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.2)',
    paddingTop: 16,
  },
  balanceHint: {
    fontSize: 13,
    fontWeight: '500',
  },
  cashOutButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  cashOutText: {
    fontWeight: '700',
    fontSize: 14,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  addButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  paymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  paymentIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  paymentEmptyText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  emptyTransactionCard: {
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    gap: 12,
  },
  emptyTransactionText: {
    fontSize: 15,
    fontWeight: '500',
  },
  transactionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  transactionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 13,
  },
  transactionAmount: {
    fontSize: 18,
    fontWeight: '700',
  },
});
