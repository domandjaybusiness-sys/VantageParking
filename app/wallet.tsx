import { IconSymbol } from '@/components/ui/icon-symbol';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function WalletScreen() {
  const router = useRouter();
  const { colors } = useTheme();
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
    <View style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View style={[styles.header, { backgroundColor: colors.backgroundCard }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <IconSymbol name="chevron.left" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Wallet</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Balance Card */}
        <View style={[styles.balanceCard, { backgroundColor: colors.backgroundCard }]}
        >
          <Text style={[styles.balanceLabel, { color: colors.textSecondary }]}>Total Earnings</Text>
          <Text style={[styles.balanceAmount, { color: colors.primary }]}>
            {loading ? '—' : `$${totalEarnings.toFixed(2)}`}
          </Text>
          <Text style={[styles.balanceHint, { color: colors.textSecondary }]}>Paid bookings only</Text>
        </View>

        {/* Payment Methods */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Payment Methods</Text>
            <TouchableOpacity onPress={handleAddPaymentMethod}>
              <Text style={[styles.addButton, { color: colors.primary }]}>+ Add</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.paymentCard, { backgroundColor: colors.background }]}
          >
            <Text style={[styles.paymentEmptyText, { color: colors.textSecondary }]}>No payment methods on file.</Text>
          </View>
        </View>

        {/* Transaction History */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Transactions</Text>
          
          {!loading && renderedTransactions.length === 0 && (
            <View style={[styles.transactionCard, { backgroundColor: colors.background }]}
            >
              <Text style={[styles.transactionDate, { color: colors.textSecondary }]}>No paid bookings yet.</Text>
            </View>
          )}

          {renderedTransactions.map((transaction) => (
            <View key={transaction.id} style={[styles.transactionCard, { backgroundColor: colors.background }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.transactionTitle, { color: colors.text }]}>{transaction.title}</Text>
                <Text style={[styles.transactionDate, { color: colors.textSecondary }]}>{transaction.date}</Text>
              </View>
              <Text style={[styles.transactionAmount, { color: colors.primary }]}>${transaction.amount.toFixed(2)}</Text>
            </View>
          ))}
        </View>
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
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
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
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  balanceLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 48,
    fontWeight: '700',
    marginBottom: 16,
  },
  balanceHint: {
    fontSize: 12,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  addButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  paymentCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  paymentEmptyText: {
    fontSize: 14,
  },
  transactionCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  transactionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 14,
  },
  transactionAmount: {
    fontSize: 18,
    fontWeight: '700',
  },
});
