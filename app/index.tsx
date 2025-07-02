import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import ChatWootWidget from "@/components/chatwoot";
import { useNotifications } from "@/lib/NotificationsContext";
import { useState } from "react";

const user = {
  identifier: "john@gmail.com",
  name: "John Samuel",
  avatar_url: "",
  email: "john@gmail.com",
  identifier_hash: "",
};
const customAttributes = {
  accountId: 1,
  pricingPlan: "paid",
  status: "active",
};
const websiteToken = "5t4cpui2gPedn1QY4ZygLmD8";
const baseUrl = "https://chatwoot.artzkaizen.com/";
const locale = "en";
const colorScheme = "dark";
export default function HomeScreen() {
  const [showWidget, toggleWidget] = useState(false);

  const notifications = useNotifications();

  if (notifications.error) {
    return <Text>Error: {notifications.error.message}</Text>;
  }

  return (
    <View>
      <View>
        <TouchableOpacity
          style={styles.button}
          onPress={() => toggleWidget(true)}
        >
          <Text style={styles.buttonText}>Open widget</Text>
        </TouchableOpacity>

        <Text>
          Notification: {notifications.notification?.request.content.title}
        </Text>
        <Text>
          Body:{" "}
          {JSON.stringify(
            notifications.notification?.request.content.data,
            null,
            2
          )}
        </Text>
      </View>
      {showWidget && (
        <ChatWootWidget
          websiteToken={websiteToken}
          locale={locale}
          baseUrl={baseUrl}
          closeModal={() => toggleWidget(false)}
          isModalVisible={showWidget}
          user={user}
          customAttributes={customAttributes}
          colorScheme={colorScheme}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  button: {
    height: 48,
    marginTop: 32,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: "#1F93FF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#fff",
    justifyContent: "center",
  },
  buttonText: {
    color: "#fff",
    textAlign: "center",
    paddingLeft: 10,
    fontWeight: "600",
    fontSize: 16,
    paddingRight: 10,
  },
});
