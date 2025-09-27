import i18n from "@/language/_18n";
import { Tabs } from "expo-router";
import React from "react";

export default function TabLayout() {
  return (
    <Tabs screenOptions={{}}>
      <Tabs.Screen
        name="index"
        options={{
          title: i18n.t("common.journey"),
          // tabBarIcon: ({ color }) => (
          // ),
        }}
      />
      <Tabs.Screen
        name="courses"
        options={{
          title: i18n.t("common.courses"),
          // tabBarIcon: ({ color }) => (
          //   <IconSymbol size={28} name="paperplane.fill" color={color} />
          // ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: i18n.t("common.profile"),
        }}
      />
    </Tabs>
  );
}
