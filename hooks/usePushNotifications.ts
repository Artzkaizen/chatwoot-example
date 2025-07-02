import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

const PROJECT_ID = "94eabdd7-23ad-4c45-b8f5-44b1086f3394"; // Your project ID from app.json

export interface PushNotificationState {
  expoPushToken?: Notifications.ExpoPushToken;
  notification?: Notifications.Notification;
}

export const usePushNotifications = (): PushNotificationState => {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldShowAlert: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  const [expoPushToken, setExpoPushToken] = useState<
    Notifications.ExpoPushToken | undefined
  >();

  const [notification, setNotification] = useState<
    Notifications.Notification | undefined
  >();

  const notificationListener = useRef<Notifications.EventSubscription | null>(
    null
  );
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  async function registerForPushNotificationsAsync() {
    try {
      console.log("Starting push notification registration...");

      // Try different ways to get project ID
      const configProjectId = Constants.expoConfig?.extra?.eas?.projectId;
      const easProjectId = Constants.easConfig?.projectId;
      const projectId = configProjectId || easProjectId || PROJECT_ID;

      console.log("Project ID from config:", configProjectId);
      console.log("Project ID from easConfig:", easProjectId);
      console.log("Using Project ID:", projectId);
      console.log("Is physical device:", Device.isDevice);

      let token;
      if (Device.isDevice) {
        // Check permissions
        const { status: existingStatus } =
          await Notifications.getPermissionsAsync();
        console.log("Existing permission status:", existingStatus);
        let finalStatus = existingStatus;

        if (existingStatus !== "granted") {
          console.log("Requesting permission...");
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
          console.log("Permission request result:", status);
        }

        if (finalStatus !== "granted") {
          console.log("Permission denied");
          throw new Error("Failed to get push token for push notification!");
        }

        console.log("Getting push token...");
        try {
          token = await Notifications.getExpoPushTokenAsync({
            projectId: projectId,
          });
          console.log("Push token received:", token);
        } catch (error) {
          console.error("Error getting push token:", error);
          throw error;
        }
      } else {
        console.log("Not a physical device, skipping push token registration");
      }

      if (Platform.OS === "android") {
        console.log("Setting up Android notification channel...");
        await Notifications.setNotificationChannelAsync("default", {
          name: "default",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#FF231F7C",
        });
      }

      return token;
    } catch (error) {
      console.error("Error in registerForPushNotificationsAsync:", error);
      throw error;
    }
  }

  useEffect(() => {
    console.log("Setting up push notifications...");
    registerForPushNotificationsAsync()
      .then((token) => {
        console.log("Registration complete, token:", token);
        setExpoPushToken(token);
      })
      .catch((error) => {
        console.error("Failed to register for push notifications:", error);
      });

    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        console.log("Notification received:", notification);
        setNotification(notification);
      });

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        console.log("Notification response:", response);
      });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  return {
    expoPushToken,
    notification,
  };
};
