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
  reconnectInterval: 3000, // 3 seconds between reconnection attempts
  maxReconnectAttempts: 5,
};

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("Initializing...");
  const [isLoading, setIsLoading] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messageCounterRef = useRef(0);
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

      // First try to fetch existing conversations
      const existingConversationsResponse = await fetch(
        `${CHATWOOT_CONFIG.apiUrl}inboxes/${CHATWOOT_CONFIG.inboxIdentifier}/contacts/${DEMO_USER.identifier}/conversations`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (existingConversationsResponse.ok) {
        const conversations = await existingConversationsResponse.json();
        console.log("Existing conversations:", conversations);

        // Find the most recent open conversation
        const activeConversation = conversations.find(
          (conv: any) => conv.status === "open"
        );

        if (activeConversation) {
          console.log("Found active conversation:", activeConversation);

          // Update state first
          setChatwootData((prev) => ({
            ...prev,
            conversationId: activeConversation.id.toString(),
          }));

          // Then store in AsyncStorage
          await AsyncStorage.setItem(
            "contactConversation",
            activeConversation.id.toString()
          );

          return activeConversation;
        }
      }

      // If no existing conversation found, create a new one
      const response = await fetch(
        `${CHATWOOT_CONFIG.apiUrl}inboxes/${CHATWOOT_CONFIG.inboxIdentifier}/contacts/${DEMO_USER.identifier}/conversations`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contact: {
              name: DEMO_USER.name,
              email: DEMO_USER.email,
            },
            message: {
              content: "Started a new conversation",
              echo_id: Date.now().toString(),
            },
            status: "open",
          }),
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
      console.log("New conversation created:", data);

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

      // Add message to local state
      addMessage("me", content);
      setInputText("");
    } catch (error) {
      console.error("Error in sendMessage:", error);
      setConnectionStatus(`Error: ${error?.message || "Unknown error"}`);
      throw error;
    }
  };

  const initializeWebSocket = () => {
    console.log("Initializing WebSocket");

    // Clear any existing reconnection timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    wsRef.current = new WebSocket(CHATWOOT_CONFIG.wsUrl);

    wsRef.current.onopen = () => {
      setConnectionStatus("Connected to Chatwoot");
      reconnectAttemptsRef.current = 0; // Reset reconnection attempts on successful connection

      // Subscribe to Chatwoot webhooks
      if (wsRef.current && chatwootData.contactPubsubToken) {
        console.log("Subscribing with token:", chatwootData.contactPubsubToken);
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
      console.log("WebSocket message received:", event.data);
      try {
        const json = JSON.parse(event.data);

        // Handle subscription confirmation
        if (json.type === "confirm_subscription") {
          console.log("Successfully subscribed to WebSocket");
        }

        // Handle message events
        if (json.message?.event === "message.created") {
          const messageData = json.message.data;
          console.log("Message created event:", messageData);

          // message_type: 0 is user message, 1 is agent message
          if (messageData.message_type === 1) {
            console.log("Agent message received:", messageData.content);
            addMessage(
              messageData.sender?.name || "Agent",
              messageData.content
            );
          }
        }

        // Handle conversation events
        if (json.message?.event === "conversation.created") {
          console.log("New conversation created:", json.message.data);
          // Store the conversation ID if we don't have one
          if (!chatwootData.conversationId) {
            const conversationId = json.message.data.id.toString();
            setChatwootData((prev) => ({
              ...prev,
              conversationId,
            }));
            AsyncStorage.setItem("contactConversation", conversationId);
          }
        }
      } catch (error) {
        console.error("WebSocket message parsing error:", error);
      }
    };

    wsRef.current.onerror = (e) => {
      console.error("WebSocket error:", e);
      setConnectionStatus("WebSocket Error");
    };

    wsRef.current.onclose = () => {
      console.log("WebSocket connection closed");
      setConnectionStatus("Disconnected");

      // Attempt to reconnect if we haven't exceeded max attempts
      if (reconnectAttemptsRef.current < CHATWOOT_CONFIG.maxReconnectAttempts) {
        reconnectAttemptsRef.current += 1;
        console.log(
          `Attempting to reconnect (${reconnectAttemptsRef.current}/${CHATWOOT_CONFIG.maxReconnectAttempts})`
        );

        reconnectTimeoutRef.current = setTimeout(() => {
          if (chatwootData.contactPubsubToken) {
            initializeWebSocket();
          }
        }, CHATWOOT_CONFIG.reconnectInterval);
      } else {
        console.log("Max reconnection attempts reached");
        setConnectionStatus("Connection failed. Please try again later.");
      }
    };
  };

  const fetchMessageHistory = async (conversationId: string) => {
    try {
      console.log("Fetching message history...");
      const response = await fetch(
        `${CHATWOOT_CONFIG.apiUrl}inboxes/${CHATWOOT_CONFIG.inboxIdentifier}/contacts/${DEMO_USER.identifier}/conversations/${conversationId}/messages`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch message history");
      }

      const data = await response.json();
      console.log("Message history:", data);

      // Process messages and add them to state
      data.forEach((message: any) => {
        const author =
          message.message_type === 0 ? "me" : message.sender?.name || "Agent";
        addMessage(author, message.content);
      });
    } catch (error) {
      console.error("Error fetching message history:", error);
    }
  };

  // Load existing conversation ID on mount
  useEffect(() => {
    const loadConversationId = async () => {
      try {
        const savedConversationId = await AsyncStorage.getItem(
          "contactConversation"
        );
        if (savedConversationId) {
          setChatwootData((prev) => ({
            ...prev,
            conversationId: savedConversationId,
          }));

          // Fetch message history for the existing conversation
          await fetchMessageHistory(savedConversationId);
        }
      } catch (error) {
        console.error("Error loading conversation ID:", error);
      }
    };

    loadConversationId();
  }, []);

  const addMessage = async (author: string, content: string) => {
    console.log(`Adding message from ${author}: ${content}`);
    messageCounterRef.current += 1;
    const newMessage = {
      id: `${Date.now()}-${messageCounterRef.current}`,
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
          trigger: null,
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
      {item.author !== "me" && (
        <Text style={styles.messageAuthor}>{item.author}</Text>
      )}
      <Text
        style={[
          styles.messageContent,
          item.author === "me" ? { color: "#fff" } : { color: "#000" },
        ]}
      >
        {item.content}
      </Text>
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
            contentContainerStyle={styles.messageListContent}
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
  messageListContent: {
    flexGrow: 1,
    justifyContent: "flex-end",
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
