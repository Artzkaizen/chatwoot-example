import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const DEVICE_TOKEN_KEY = "chatwoot_device_token";

// Configure notification categories/actions
Notifications.setNotificationCategoryAsync("CHAT", [
  {
    identifier: "REPLY",
    buttonTitle: "Reply",
    options: {
      opensAppToForeground: true,
    },
  },
  {
    identifier: "MARK_READ",
    buttonTitle: "Mark as Read",
    options: {
      opensAppToForeground: false,
    },
  },
]);

export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: any
) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      categoryIdentifier: "CHAT",
    },
    trigger: null, // null means show immediately
  });
}

export async function registerForPushNotifications(
  baseUrl: string,
  websiteToken: string,
  userId: string
) {
  try {
    // Check if we already have a token
    const existingToken = await AsyncStorage.getItem(DEVICE_TOKEN_KEY);
    if (existingToken) {
      return existingToken;
    }

    // Platform-specific setup for Android
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
      });
    }

    // Check if running on a physical device
    if (!Device.isDevice) {
      throw new Error("Must use physical device for push notifications");
    }

    // Request permission
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") {
      throw new Error(
        "Permission not granted to get push token for push notification!"
      );
    }

    // Get project ID from Constants
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;
    if (!projectId) {
      throw new Error("Project ID not found");
    }

    // Get Expo push token
    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    // Register token with Chatwoot
    const response = await fetch(`${baseUrl}/api/v1/widget/push_tokens`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        api_access_token: websiteToken,
      },
      body: JSON.stringify({
        subscription_type: "expo",
        subscription_attributes: {
          push_token: token,
          user_id: userId,
        },
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to register push token with Chatwoot");
    }

    // Save token locally
    await AsyncStorage.setItem(DEVICE_TOKEN_KEY, token);
    console.log("Push token:", token);
    return token;
  } catch (error) {
    console.error("Error registering for push notifications:", error);
    throw error;
  }
}

export async function unregisterPushNotifications(
  baseUrl: string,
  websiteToken: string
) {
  try {
    const token = await AsyncStorage.getItem(DEVICE_TOKEN_KEY);
    if (!token) return;

    // Unregister from Chatwoot
    const response = await fetch(
      `${baseUrl}/api/v1/widget/push_tokens/unsubscribe`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          api_access_token: websiteToken,
        },
        body: JSON.stringify({
          subscription_type: "expo",
          push_token: token,
        }),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to unregister push token from Chatwoot");
    }

    // Remove token from local storage
    await AsyncStorage.removeItem(DEVICE_TOKEN_KEY);
  } catch (error) {
    console.error("Error unregistering push notifications:", error);
    throw error;
  }
}
