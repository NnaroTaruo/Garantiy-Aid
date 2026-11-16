import React, { useState } from 'react';
import { Keyboard, Modal, Pressable, View } from 'react-native';
import { Check, ChevronDown } from 'lucide-react-native';
import type { Barangay } from './api';
import { Button, Field, Page, styles, Txt } from './components';
import { useDemo } from './state';
import { colors as c } from './theme';

export function BarangayPicker({ label, areas, value, onChange, error, disabled, showCity }: {
  label: string;
  areas: Barangay[];
  value: string;
  onChange: (id: string) => void;
  error?: string;
  disabled?: boolean;
  showCity?: boolean;
}) {
  const { t } = useDemo();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selected = areas.find((area) => area.id === value);
  const unavailable = disabled || !areas.length;
  const prompt = t('Choose a barangay', 'Pagpili og barangay');
  const close = () => setOpen(false);
  const visible = open ? [...areas]
    .filter((area) => `${area.barangayName} ${area.city}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
    .sort((a, b) => a.barangayName.localeCompare(b.barangayName)) : [];

  return (
    <View style={{ gap: 8 }}>
      <Txt variant="label">{label}</Txt>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: selected ? `${selected.barangayName}, ${selected.city}` : prompt }}
        accessibilityState={{ disabled: unavailable, expanded: open }}
        disabled={unavailable}
        onPress={() => { Keyboard.dismiss(); setSearch(''); setOpen(true); }}
        style={[styles.input, styles.row, error && { borderColor: c.error }]}
      >
        <Txt style={{ flex: 1, fontSize: 16, color: selected ? c.text : c.muted }}>
          {selected ? (showCity ? `${selected.barangayName}, ${selected.city}` : selected.barangayName) : prompt}
        </Txt>
        <ChevronDown size={20} color={c.muted} />
      </Pressable>
      {error && <Txt variant="small" accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: c.error }}>{error}</Txt>}
      {open && (
        <Modal transparent onRequestClose={close}>
          <View style={{ flex: 1, alignItems: 'center', backgroundColor: 'rgba(15, 31, 51, 0.45)' }}>
            <View accessibilityViewIsModal style={{ flex: 1, width: '100%', maxWidth: 430, backgroundColor: c.surface }}>
              <Page header={false} footer={<Button variant="outline" onPress={close}>{t('Cancel', 'Kanselahon')}</Button>}>
                <Txt variant="title">{prompt}</Txt>
                <Field label={t('Search barangays', 'Pangitaa ang barangay')} value={search} onChangeText={setSearch} />
                <View accessibilityRole="radiogroup" accessibilityLabel={label}>
                  {visible.map((area) => (
                    <Pressable
                      key={area.id}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: area.id === value }}
                      onPress={() => { onChange(area.id); close(); }}
                      style={({ pressed }) => [
                        styles.row,
                        { minHeight: 48, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderColor: c.outline },
                        (pressed || area.id === value) && { backgroundColor: c.primarySoft },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Txt variant="label">{area.barangayName}</Txt>
                        <Txt variant="small">{area.city}</Txt>
                      </View>
                      {area.id === value && <Check size={18} color={c.primary} />}
                    </Pressable>
                  ))}
                </View>
                {!visible.length && <Txt accessibilityLiveRegion="polite">{t('No matching barangays.', 'Walay barangay nga nagtugma.')}</Txt>}
              </Page>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}
