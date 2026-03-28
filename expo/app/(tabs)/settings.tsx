import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import {
  Calendar,
  LogOut,
  PenSquare,
  Phone,
  Settings as SettingsIcon,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
} from 'lucide-react-native';

import Colors from '@/constants/colors';
import { useUser } from '@/contexts/UserContext';
import { useProfiles } from '@/contexts/ProfilesContext';

import { auth, deleteUserAccountData } from '@/services/firebase';

export default function SettingsScreen() {
  const { user, logout } = useUser();
  const { profiles } = useProfiles();
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(true);
  const [accountAction, setAccountAction] = useState<'logout' | 'delete' | null>(null);

  const analytics = useMemo(() => {
    const totalProfiles = profiles.length;
    const totalComments = profiles.reduce((sum, profile) => sum + (profile.commentCount ?? profile.comments?.length ?? 0), 0);
    const positive = profiles.reduce((sum, profile) => sum + profile.greenFlags, 0);
    const negative = profiles.reduce((sum, profile) => sum + profile.redFlags, 0);
    const sentimentBase = positive + negative || 1;
    const sentimentScore = Math.round((positive / sentimentBase) * 100);
    return {
      totalProfiles,
      totalComments,
      sentimentScore,
    };
  }, [profiles]);

  const communityCopy = useMemo(() => {
    if (!user?.gender) {
      return {
        emoji: '🍻',
        headline: 'Choose your beer lane',
        subline: 'Pick a gender to unlock community content',
      } as const;
    }
    const presets: Record<string, { emoji: string; label: string; copy: string }> = {
      male: { emoji: '🧑', label: 'Male', copy: 'male creators' },
      female: { emoji: '👩', label: 'Female', copy: 'female creators' },
      other: { emoji: '👥', label: 'LGBTQ🏳️‍🌈', copy: 'inclusive creators' },
    };
    const active = presets[user.gender] ?? { emoji: '🍻', label: 'Community', copy: 'selected creators' };
    return {
      emoji: active.emoji,
      headline: `${active.label} feed locked in`,
      subline: `Your gallery is curated for ${active.copy}`,
    } as const;
  }, [user?.gender]);

  const confirmLogout = useCallback(() => {
    Alert.alert('Log out', 'Are you sure you want to leave the beer lounge?', [
      { text: 'Stay', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          setAccountAction('logout');
          try {
            await auth.signOut();
            await logout();
            router.replace('/login');
          } catch (error: any) {
            Alert.alert('Logout failed', error?.message ?? 'Unable to log out.');
          } finally {
            setAccountAction(null);
          }
        },
      },
    ]);
  }, [logout]);

  const confirmDeleteAccount = useCallback(() => {
    Alert.alert(
      'Delete account',
      'This action will remove your profiles, votes, and access forever. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!user?.id) {
              Alert.alert('Unavailable', 'No account found to delete.');
              return;
            }
            setAccountAction('delete');
            try {
              await deleteUserAccountData(user.id);
              await auth.currentUser?.delete();
              await logout();
              router.replace('/welcome');
            } catch (error: any) {
              const requiresRelogin = error?.code === 'auth/requires-recent-login';
              const message = requiresRelogin
                ? 'Please re-authenticate in login screen, then try deleting again.'
                : error?.message ?? 'Could not remove your account right now.';
              Alert.alert('Delete failed', message);
            } finally {
              setAccountAction(null);
            }
          },
        },
      ],
    );
  }, [logout, user?.id]);

  const handleNotificationToggle = useCallback(async (value: boolean) => {
    setNotificationsEnabled(value);
    try {
      await Haptics.selectionAsync();
    } catch {}
  }, []);

  if (!user) {
    return (
      <View style={styles.emptyState} testID="settings-empty-state">
        <Text style={styles.emptyTitle}>sign in required</Text>
        <Text style={styles.emptySubtitle}>Log in to customize preferences.</Text>
        <TouchableOpacity style={[styles.ctaButton, styles.primaryButton]} onPress={() => router.replace('/login')}>
          <Text style={styles.primaryText}>go to login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} testID="settings-screen">
      <LinearGradient
        colors={['#0d0d0d', '#20140a']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroHeader}>
          <SettingsIcon color="#fefcf4" size={28} />
          <Text style={styles.heroTitle}>control room</Text>
        </View>
        <Text style={styles.heroHeadline}>
          {communityCopy.emoji} {communityCopy.headline}
        </Text>
        <Text style={styles.heroSubtitle}>{communityCopy.subline}</Text>
        <View style={styles.heroBadges}>
          <View style={styles.heroBadge}>
            <ShieldCheck size={18} color="#fefcf4" />
            <Text style={styles.heroBadgeText}>{user.authMethod === 'google' ? 'Google secured' : 'Email secured'}</Text>
          </View>
          <View style={styles.heroBadge}>
            <Sparkles size={18} color="#fefcf4" />
            <Text style={styles.heroBadgeText}>{user.gender ?? 'no gender set'}</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.card} testID="profile-info-card">
        <Text style={styles.sectionTitle}>profile</Text>
        <View style={styles.infoRow}>
          <UserRound color={Colors.light.text} size={18} />
          <View style={styles.infoText}>
            <Text style={styles.label}>name</Text>
            <Text style={styles.value}>{user.name || 'Not set'}</Text>
          </View>
        </View>
        <View style={styles.infoRow}>
          <Phone color={Colors.light.text} size={18} />
          <View style={styles.infoText}>
            <Text style={styles.label}>phone</Text>
            <Text style={styles.value}>{user.phone || 'Not provided'}</Text>
          </View>
        </View>
        <View style={styles.infoRow}>
          <Calendar color={Colors.light.text} size={18} />
          <View style={styles.infoText}>
            <Text style={styles.label}>date of birth</Text>
            <Text style={styles.value}>
              {user.dateOfBirth ? user.dateOfBirth.toLocaleDateString() : 'Not set'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.card} testID="gender-settings-card">
        <View style={styles.cardHeaderLocked}>
          <Text style={styles.sectionTitle}>gender & community</Text>
          <View style={styles.lockedPill}>
            <PenSquare size={14} color="#7f1d1d" />
            <Text style={styles.lockedText}>locked</Text>
          </View>
        </View>
        <View style={styles.currentGender}>
          <Text style={styles.currentGenderLabel}>current gender</Text>
          <Text style={styles.currentGenderValue}>
            {user.gender ? `${communityCopy.emoji} ${user.gender}` : 'not selected'}
          </Text>
          <Text style={styles.currentGenderNote}>
            Gender is sealed after verification. Contact support for changes.
          </Text>
        </View>
      </View>

      <View style={styles.card} testID="preferences-card">
        <Text style={styles.sectionTitle}>preferences</Text>
        <View style={styles.preferenceRow}>
          <View>
            <Text style={styles.preferenceLabel}>push notifications</Text>
            <Text style={styles.preferenceHint}>Get verified drops & approval alerts</Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={handleNotificationToggle}
            thumbColor={notificationsEnabled ? '#fefcf4' : '#cbd5f5'}
            trackColor={{ false: '#b7b7b7', true: '#0d0d0d' }}
            testID="notifications-switch"
          />
        </View>
        <View style={styles.preferenceRow}>
          <View>
            <Text style={styles.preferenceLabel}>profile visibility</Text>
            <Text style={styles.preferenceHint}>Only {user.gender ?? 'selected'} users can view you</Text>
          </View>
          <ShieldCheck size={20} color={Colors.light.text} />
        </View>
      </View>

      <View style={styles.card} testID="analytics-card">
        <Text style={styles.sectionTitle}>engagement pulse</Text>
        <View style={styles.analyticsRow}>
          <View style={styles.analyticsBox}>
            <Text style={styles.analyticsNumber}>{analytics.totalProfiles}</Text>
            <Text style={styles.analyticsLabel}>profiles visible</Text>
          </View>
          <View style={styles.analyticsBox}>
            <Text style={styles.analyticsNumber}>{analytics.totalComments}</Text>
            <Text style={styles.analyticsLabel}>community comments</Text>
          </View>
          <View style={styles.analyticsBox}>
            <Text style={styles.analyticsNumber}>{analytics.sentimentScore}%</Text>
            <Text style={styles.analyticsLabel}>positive vibes</Text>
          </View>
        </View>
      </View>

      <View style={styles.card} testID="account-card">
        <Text style={styles.sectionTitle}>account</Text>
        <TouchableOpacity
          style={[styles.ctaButton, styles.secondaryButton]}
          onPress={confirmLogout}
          disabled={accountAction === 'logout'}
          testID="logout-button"
        >
          {accountAction === 'logout' ? (
            <ActivityIndicator color="#0d0d0d" />
          ) : (
            <>
              <LogOut size={18} color="#0d0d0d" />
              <Text style={styles.secondaryText}>log out</Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.ctaButton, styles.dangerButton]}
          onPress={confirmDeleteAccount}
          disabled={accountAction === 'delete'}
          testID="delete-account-button"
        >
          {accountAction === 'delete' ? (
            <ActivityIndicator color="#fefcf4" />
          ) : (
            <>
              <Trash2 size={18} color="#fefcf4" />
              <Text style={styles.primaryText}>delete account</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.footer}>v1.0 · crafted for the beer collective</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  content: {
    paddingBottom: 32,
  },
  hero: {
    margin: 16,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2a1f17',
    gap: 8,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroTitle: {
    color: '#fefcf4',
    fontSize: 16,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  heroHeadline: {
    color: '#fefcf4',
    fontSize: 24,
    fontWeight: '900',
  },
  heroSubtitle: {
    color: 'rgba(254,252,244,0.8)',
    fontSize: 14,
  },
  heroBadges: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(254,252,244,0.15)',
  },
  heroBadgeText: {
    color: '#fefcf4',
    fontSize: 13,
    fontWeight: '600',
  },
  card: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#000000',
    gap: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    textTransform: 'uppercase',
    color: Colors.light.text,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoText: {
    flex: 1,
  },
  label: {
    fontSize: 13,
    color: '#6b7280',
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  value: {
    fontSize: 16,
    color: Colors.light.text,
    fontWeight: '700',
  },
  cardHeaderLocked: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lockedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#7f1d1d',
  },
  lockedText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7f1d1d',
    textTransform: 'uppercase',
  },
  currentGender: {
    gap: 6,
  },
  currentGenderLabel: {
    fontSize: 13,
    color: '#6b7280',
    textTransform: 'uppercase',
  },
  currentGenderValue: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.light.text,
  },
  currentGenderNote: {
    fontSize: 13,
    color: '#6b7280',
  },
  preferenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  preferenceLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.light.text,
  },
  preferenceHint: {
    fontSize: 12,
    color: '#6b7280',
  },
  analyticsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  analyticsBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#000000',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: Colors.light.background,
  },
  analyticsNumber: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.light.text,
  },
  analyticsLabel: {
    fontSize: 12,
    color: '#6b7280',
    textTransform: 'uppercase',
    marginTop: 4,
  },
  ctaButton: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#000000',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  primaryButton: {
    backgroundColor: '#0d0d0d',
  },
  secondaryButton: {
    backgroundColor: '#f5f5f5',
  },
  dangerButton: {
    backgroundColor: '#c1121f',
    marginTop: 12,
  },
  primaryText: {
    color: '#fefcf4',
    fontSize: 16,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  secondaryText: {
    color: '#0d0d0d',
    fontSize: 16,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
    backgroundColor: Colors.light.background,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.light.text,
    textTransform: 'uppercase',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  footer: {
    textAlign: 'center',
    marginTop: 24,
    color: '#6b7280',
    textTransform: 'uppercase',
    fontSize: 12,
  },
});
