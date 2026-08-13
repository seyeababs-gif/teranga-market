import { Tabs } from "expo-router";
import { Home, PlusCircle, User, Shield, Crown } from "lucide-react-native";
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useMarketplace } from "@/contexts/MarketplaceContext";

export default function TabLayout() {
  const { currentUser } = useMarketplace();
  const isAdmin = currentUser?.isAdmin === true;
  const isPartner = currentUser?.isPartner === true;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#00853F",
        tabBarInactiveTintColor: "#C9A876",
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopWidth: 1,
          borderTopColor: "#E8D5B7",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Accueil",
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: "Vendre",
          tabBarIcon: ({ color, size }) => <PlusCircle color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: "Admin",
          tabBarIcon: ({ color, size }) => <Shield color={color} size={size} />,
          href: isAdmin ? '/admin' : null,
        }}
      />
      <Tabs.Screen
        name="partner-dashboard"
        options={{
          title: "Partenaire",
          tabBarIcon: ({ color, size }) => <Crown color={color} size={size} />,
          href: isPartner ? '/partner-dashboard' : null,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -8,
    right: -10,
    backgroundColor: '#E63946',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700' as const,
  },
});
