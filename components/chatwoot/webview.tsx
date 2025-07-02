import { Linking, StyleSheet } from 'react-native';
import type { WebViewNavigation } from 'react-native-webview';
import { WebView } from 'react-native-webview';
import { generateScripts, getMessage, isJsonString, storeHelper   } from './utils';
import type {User, CustomAttributes} from './utils';
import { useState } from 'react';

type ColorScheme = 'light' | 'dark' | 'auto';

interface WebViewComponentProps {
  websiteToken: string;
  baseUrl: string;
  cwCookie?: string;
  colorScheme?: ColorScheme;
  user: User;
  locale?: string;
  customAttributes?: CustomAttributes;
  closeModal: () => void;
}

interface WebViewRequest {
  url: string;
}

interface LoadedEventMessage {
  event: 'loaded';
  config: {
    authToken: string;
  };
}

interface CloseWidgetMessage {
  type: 'close-widget';
}

type ChatwootMessage = LoadedEventMessage | CloseWidgetMessage;

const WebViewComponent: React.FC<WebViewComponentProps> = ({
  baseUrl,
  websiteToken,
  cwCookie = '',
  locale = 'en',
  colorScheme = 'light',
  user,
  customAttributes = {},
  closeModal,
}) => {
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  let widgetUrl = `${baseUrl}/widget?website_token=${websiteToken}&locale=${locale}`;

  if (cwCookie) {
    widgetUrl = `${widgetUrl}&cw_conversation=${cwCookie}`;
  }

  const injectedJavaScript = generateScripts({
    user,
    locale,
    customAttributes,
    colorScheme,
  });

  const onShouldStartLoadWithRequest = (request: WebViewRequest): boolean => {
    const isMessageView = currentUrl?.includes('#/messages');
    const isAttachmentUrl = !widgetUrl.includes(request.url);
    // Open the attachments only in the external browser
    const shouldRedirectToBrowser = isMessageView && isAttachmentUrl;
    if (shouldRedirectToBrowser) {
      void Linking.openURL(request.url);
      return false;
    }

    return true;
  };

  const handleWebViewNavigationStateChange = (newNavState: WebViewNavigation): void => {
    setCurrentUrl(newNavState.url);
  };

  return (
    <WebView
      source={{
        uri: widgetUrl,
      }}
      onMessage={(event) => {
        const { data } = event.nativeEvent;
        const message = getMessage(data);
        if (isJsonString(message)) {
          const parsedMessage = JSON.parse(message) as ChatwootMessage;
          if ('event' in parsedMessage) {
            const { config: { authToken } } = parsedMessage;
            void storeHelper.storeCookie(authToken);
          }
          if ('type' in parsedMessage) {
            closeModal();
          }
        }
      }}
      scalesPageToFit
      useWebKit
      sharedCookiesEnabled
      javaScriptEnabled={true}
      domStorageEnabled={true}
      style={styles.webViewContainer}
      injectedJavaScript={injectedJavaScript}
      onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
      onNavigationStateChange={handleWebViewNavigationStateChange}
      scrollEnabled
    />
  );
};

const styles = StyleSheet.create({
  webViewContainer: {
    flex: 1,
  },
});

export default WebViewComponent;