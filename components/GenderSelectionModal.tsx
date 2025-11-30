import { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Check } from 'lucide-react-native';

import Colors from '@/constants/colors';
import { GenderOption } from '@/types/profile';

interface GenderSelectionModalProps {
  isVisible: boolean;
  onGenderSelected: (gender: GenderOption) => void;
  isLoading?: boolean;
}

const options: { label: string; value: GenderOption }[] = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Prefer not to say', value: 'other' },
];

export default function GenderSelectionModal({ isVisible, onGenderSelected, isLoading = false }: GenderSelectionModalProps) {
  const [selectedGender, setSelectedGender] = useState<GenderOption | null>(null);

  useEffect(() => {
    if (!isVisible) {
      setSelectedGender(null);
    }
  }, [isVisible]);

  const handleContinue = () => {
    if (!selectedGender || isLoading) {
      return;
    }
    onGenderSelected(selectedGender);
  };

  return (
    <Modal visible={isVisible} transparent animationType="slide" presentationStyle="overFullScreen">
      <View style={styles.overlay}>
        <View style={styles.card} testID="gender-selection-modal">
          <Text style={styles.title}>Select Your Gender</Text>
          <View style={styles.optionContainer}>
            {options.map((option) => {
              const isSelected = selectedGender === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.option, isSelected && styles.optionSelected]}
                  onPress={() => setSelectedGender(option.value)}
                  activeOpacity={0.85}
                  testID={`gender-option-${option.value}`}
                >
                  <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                    {isSelected && <View style={styles.radioInner} />}
                  </View>
                  <Text style={styles.optionLabel}>{option.label}</Text>
                  {isSelected && <Check size={18} color={Colors.light.text} />}
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity
            style={[styles.ctaButton, (!selectedGender || isLoading) && styles.ctaButtonDisabled]}
            onPress={handleContinue}
            disabled={!selectedGender || isLoading}
            activeOpacity={0.85}
            testID="gender-continue-button"
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.light.text} />
            ) : (
              <Text style={styles.ctaButtonText}>Continue</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    backgroundColor: Colors.light.background,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#000000',
    gap: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '900' as const,
    color: Colors.light.text,
    textAlign: 'center',
  },
  optionContainer: {
    gap: 12,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#000000',
    borderRadius: 12,
    backgroundColor: Colors.light.background,
  },
  optionSelected: {
    backgroundColor: '#f0ece4',
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  radioOuterSelected: {
    borderColor: Colors.light.text,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.light.text,
  },
  optionLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '900' as const,
    color: Colors.light.text,
  },
  ctaButton: {
    borderWidth: 1,
    borderColor: '#000000',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: Colors.light.background,
  },
  ctaButtonDisabled: {
    opacity: 0.5,
  },
  ctaButtonText: {
    fontSize: 16,
    fontWeight: '900' as const,
    color: Colors.light.text,
  },
});
