import * as Notifications from "expo-notifications";
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  registerForPushNotifications,
  unregisterPushNotifications,
} from "./notifications";

type Subscription = { remove: () => void };

interface NotificationsContextType {
  pushToken: string | null;
  isRegistered: boolean;
  notification: Notifications.Notification | null;
  error: Error | null;
  registerNotifications: (
    baseUrl: string,
    websiteToken: string,
    userId: string
  ) => Promise<void>;
  unregisterNotifications: (
    baseUrl: string,
    websiteToken: string
  ) => Promise<void>;
}

const NotificationsContext = createContext<
  NotificationsContextType | undefined
>(undefined);

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (context === undefined) {
    throw new Error(
      "useNotifications must be used within a NotificationsProvider"
    );
  }
  return context;
}

interface NotificationsProviderProps {
  children: ReactNode;
}

export function NotificationsProvider({
  children,
}: NotificationsProviderProps) {
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [notification, setNotification] =
    useState<Notifications.Notification | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const notificationListener = useRef<Subscription | null>(null);
  const responseListener = useRef<Subscription | null>(null);

  console.log("pushToken", pushToken);
  console.log("isRegistered", isRegistered);

  useEffect(() => {
    // Set up notification listeners
    // registerForPushNotifications().then(
    //   (token) => setPushToken(token),
    //   (error) => setError(error)
    // );
    notificationListener.current =
      Notifications.addNotificationReceivedListener(
        (notification: Notifications.Notification) => {
          console.log("🔔 Notification Received: ", notification);
          setNotification(notification);
        }
      );

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener(
        (response: Notifications.NotificationResponse) => {
          console.log(
            "🔔 Notification Response: ",
            JSON.stringify(response, null, 2),
            JSON.stringify(response.notification.request.content.data, null, 2)
          );
          // Handle the notification response here
        }
      );

    console.log("Effect ran");

    // Cleanup listeners on unmount
    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  console.log("pushToken", pushToken);

  const registerNotifications = useCallback(
    async (baseUrl: string, websiteToken: string, userId: string) => {
      try {
        const token = await registerForPushNotifications(
          baseUrl,
          websiteToken,
          userId
        );
        setPushToken(token);
        setIsRegistered(true);
        setError(null);
      } catch (error) {
        console.error("Failed to register notifications:", error);
        setError(error instanceof Error ? error : new Error(String(error)));
        throw error;
      }
    },
    []
  );

  const unregisterNotifications = useCallback(
    async (baseUrl: string, websiteToken: string) => {
      try {
        await unregisterPushNotifications(baseUrl, websiteToken);
        setPushToken(null);
        setIsRegistered(false);
        setError(null);
      } catch (error) {
        console.error("Failed to unregister notifications:", error);
        setError(error instanceof Error ? error : new Error(String(error)));
        throw error;
      }
    },
    []
  );

  const value = {
    pushToken,
    isRegistered,
    notification,
    error,
    registerNotifications,
    unregisterNotifications,
  };

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}
