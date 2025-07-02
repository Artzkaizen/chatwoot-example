import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { usePushNotifications } from "../hooks/usePushNotifications";

interface Message {
  id: string;
  author: string;
  content: string;
  timestamp: number;
}

interface User {
  identifier: string;
  name: string;
  email: string;
  avatar_url?: string;
}

const DEMO_USER: User = {
  identifier: "mobile-user-123",
  name: "Mobile User",
  email: "mobile.user@example.com",
  avatar_url: "",
};

const CHATWOOT_CONFIG = {
  inboxIdentifier: "9D5wpAc4dt4kRGhR6scDUkTp",
  apiUrl: "https://chatwoot.artzkaizen.com/public/api/v1/",
  wsUrl: "wss://chatwoot.artzkaizen.com/cable",
  websiteToken: "YOUR_WEBSITE_TOKEN", // Add your website token here
};

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("Initializing...");
  const [isLoading, setIsLoading] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);
  const [chatwootData, setChatwootData] = useState({
    contactIdentifier: "",
    contactPubsubToken: "",
    conversationId: "",
  });

  const { expoPushToken, notification } = usePushNotifications();

  // Log push notification status
  useEffect(() => {
    if (expoPushToken) {
      console.log("Push token ready:", expoPushToken.data);
    } else {
      console.log("Waiting for push token...");
    }
  }, [expoPushToken]);

  useEffect(() => {
    if (notification) {
      console.log("Received notification:", notification);
      const notificationData = notification.request.content.data;
      if (notificationData.conversationId === chatwootData.conversationId) {
        // Handle chat-specific notification
      }
    }
  }, [notification, chatwootData.conversationId]);

  useEffect(() => {
    setupInitialConnection();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const setupInitialConnection = async () => {
    try {
      setIsLoading(true);
      setConnectionStatus("Setting up contact...");
      const contactData = await setupContact();

      // Register token with Chatwoot if available
      if (expoPushToken?.data) {
        try {
          const response = await fetch(
            `${CHATWOOT_CONFIG.apiUrl}/api/v1/widget/push_tokens`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                api_access_token: CHATWOOT_CONFIG.websiteToken,
              },
              body: JSON.stringify({
                subscription_type: "expo",
                subscription_attributes: {
                  push_token: expoPushToken.data,
                  user_id: contactData.source_id,
                },
              }),
            }
          );

          if (!response.ok) {
            throw new Error("Failed to register push token with Chatwoot");
          }
          console.log("Push token registered with Chatwoot");
        } catch (error) {
          console.error("Failed to register push token:", error);
        }
      }

      setConnectionStatus("Connecting to chat...");
      initializeWebSocket();

      setIsLoading(false);
    } catch (error: unknown) {
      console.error("Error setting up initial connection:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to initialize chat";
      setConnectionStatus(`Error: ${errorMessage}`);
      setIsLoading(false);
    }
  };

  const setupContact = async () => {
    try {
      console.log("Setting up contact...");

      const response = await fetch(
        `${CHATWOOT_CONFIG.apiUrl}inboxes/${CHATWOOT_CONFIG.inboxIdentifier}/contacts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            source_id: DEMO_USER.identifier,
            name: DEMO_USER.name,
            email: DEMO_USER.email,
            identifier: DEMO_USER.identifier,
            custom_attributes: {
              platform: "mobile",
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Contact creation failed:", errorText);
        throw new Error(
          `Failed to create contact: ${response.status} ${errorText}`
        );
      }

      const data = await response.json();
      console.log("Contact created:", data);

      // Update state first
      setChatwootData((prev) => ({
        ...prev,
        contactIdentifier: data.source_id,
        contactPubsubToken: data.pubsub_token,
      }));

      // Then store in AsyncStorage
      await AsyncStorage.setItem("contactIdentifier", data.source_id);
      await AsyncStorage.setItem("contactPubsubToken", data.pubsub_token);

      return data;
    } catch (error) {
      console.error("Error in setupContact:", error);
      throw error;
    }
  };

  const setupConversation = async () => {
    try {
      console.log("Setting up conversation...");
      console.log("Current chatwootData:", chatwootData);

      const response = await fetch(
        `${CHATWOOT_CONFIG.apiUrl}inboxes/${CHATWOOT_CONFIG.inboxIdentifier}/contacts/${DEMO_USER.identifier}/conversations`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Conversation creation failed:", errorText);
        throw new Error(
          `Failed to create conversation: ${response.status} ${errorText}`
        );
      }

      const data = await response.json();
      console.log("Conversation created:", data);

      // Update state first
      setChatwootData((prev) => ({
        ...prev,
        conversationId: data.id.toString(),
      }));

      // Then store in AsyncStorage
      await AsyncStorage.setItem("contactConversation", data.id.toString());

      return data;
    } catch (error) {
      console.error("Error in setupConversation:", error);
      throw error;
    }
  };

  const sendMessage = async (content: string) => {
    try {
      console.log("Sending message...");

      // Get or create conversation
      let conversationId = chatwootData.conversationId;

      if (!conversationId) {
        setConnectionStatus("Creating conversation...");
        const conversationData = await setupConversation();
        conversationId = conversationData.id.toString();
        setConnectionStatus("Connected");
      }

      if (!chatwootData.contactIdentifier) {
        throw new Error("Contact not set up properly");
      }

      const response = await fetch(
        `${CHATWOOT_CONFIG.apiUrl}inboxes/${CHATWOOT_CONFIG.inboxIdentifier}/contacts/${chatwootData.contactIdentifier}/conversations/${conversationId}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content,
            message_type: 0,
            private: false,
            echo_id: Date.now().toString(),
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Message sending failed:", errorText);
        throw new Error(
          `Failed to send message: ${response.status} ${errorText}`
        );
      }

      const data = await response.json();
      console.log("Message sent successfully:", data);

      addMessage("me", content);
      setInputText("");
    } catch (error: any) {
      console.error("Error in sendMessage:", error);
      setConnectionStatus(`Error: ${error?.message || "Unknown error"}`);
      throw error;
    }
  };

  const initializeWebSocket = () => {
    console.log("Initializing WebSocket");
    wsRef.current = new WebSocket(CHATWOOT_CONFIG.wsUrl);

    wsRef.current.onopen = () => {
      setConnectionStatus("Connected");
      // Subscribe to Chatwoot webhooks
      if (wsRef.current && chatwootData.contactPubsubToken) {
        wsRef.current.send(
          JSON.stringify({
            command: "subscribe",
            identifier: JSON.stringify({
              channel: "RoomChannel",
              pubsub_token: chatwootData.contactPubsubToken,
            }),
          })
        );
      }
    };

    console.log("WebSocket initialized");

    wsRef.current.onmessage = (event) => {
      console.log("WebSocket message received");
      try {
        const json = JSON.parse(event.data);

        if (json.message?.event === "message.created") {
          const messageData = json.message.data;
          if (messageData.message_type === 1) {
            // Incoming message from agent
            addMessage(messageData.sender.name, messageData.content);
          }
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
      }
    };

    wsRef.current.onerror = (e) => {
      setConnectionStatus("Error");
      console.log("WebSocket error:", e);
    };

    wsRef.current.onclose = () => {
      setConnectionStatus("Disconnected");
    };
  };

  const addMessage = async (author: string, content: string) => {
    const newMessage = {
      id: Date.now().toString(),
      author,
      content,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, newMessage]);

    // Show notification for incoming messages when app is in background
    if (author !== "me") {
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `New message from ${author}`,
            body: content,
            data: {
              conversationId: chatwootData.conversationId,
              messageId: newMessage.id,
            },
          },
          trigger: null, // null means show immediately
        });
      } catch (err) {
        console.error("Failed to show notification:", err);
      }
    }
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View
      style={[
        styles.messageContainer,
        item.author === "me" ? styles.myMessage : styles.theirMessage,
      ]}
    >
      <Text style={styles.messageAuthor}>{item.author}</Text>
      <Text style={styles.messageContent}>{item.content}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.statusText}>{connectionStatus}</Text>
        <Text style={styles.tokenText}>
          Push Token: {expoPushToken?.data ?? "Not available"}
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1F93FF" />
          <Text style={styles.loadingText}>{connectionStatus}</Text>
        </View>
      ) : (
        <>
          <FlatList
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            style={styles.messageList}
            inverted={false}
          />

          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.inputContainer}
          >
            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Type a message..."
              onSubmitEditing={() => {
                if (inputText.trim()) {
                  sendMessage(inputText.trim());
                }
              }}
            />
          </KeyboardAvoidingView>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  statusText: {
    textAlign: "center",
    color: "#666",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    color: "#666",
  },
  messageList: {
    flex: 1,
    padding: 10,
  },
  messageContainer: {
    marginVertical: 5,
    padding: 10,
    borderRadius: 10,
    maxWidth: "80%",
  },
  myMessage: {
    alignSelf: "flex-end",
    backgroundColor: "#007AFF",
  },
  theirMessage: {
    alignSelf: "flex-start",
    backgroundColor: "#E5E5EA",
  },
  messageAuthor: {
    fontSize: 12,
    color: "#666",
    marginBottom: 2,
  },
  messageContent: {
    fontSize: 16,
  },
  inputContainer: {
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  input: {
    padding: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 20,
    backgroundColor: "#fff",
  },
  tokenText: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
});
