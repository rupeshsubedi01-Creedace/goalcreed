import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';
import * as haptics from '@/lib/haptics';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.pitch,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: {
          backgroundColor: colors.bgElevated,
          borderTopColor: colors.stroke,
          borderTopWidth: 0.5,
          height: 62,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.4 },
        tabBarItemStyle: { padding: 0 },
      }}
      screenListeners={{
        tabPress: () => haptics.tick(),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Live',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? 'radio' : 'radio-outline'} size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="fixtures"
        options={{
          title: 'Fixtures',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? 'options' : 'options-outline'} size={size - 2} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
