import { useRouter } from "expo-router";
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

export default function Index() {
  const router = useRouter();

  const startChat = () => {
    router.push("/chat");
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.button} onPress={startChat}>
        <Text style={styles.buttonText}>Start Chat</Text>
      </TouchableOpacity>
    </View>
  );
}

export function HomeScreen() {
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
    padding: 20,
  },
  button: {
    height: 48,
    paddingHorizontal: 32,
    backgroundColor: "#1F93FF",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
