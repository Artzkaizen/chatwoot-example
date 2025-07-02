import React, { useEffect, useState } from 'react';
import { SafeAreaView, Appearance } from 'react-native';
import Modal from 'react-native-modal';
import { storeHelper, findColors } from './utils';
import type { User, CustomAttributes } from './utils';
import WebView from './webview';
import styles from './styles';
import { COLOR_WHITE } from './constants';

type ColorScheme = 'light' | 'dark' | 'auto';

interface ChatWootWidgetProps {
  isModalVisible: boolean;
  websiteToken: string;
  baseUrl: string;
  cwCookie?: string;
  user?: Partial<User>;
  locale?: string;
  colorScheme?: ColorScheme;
  customAttributes?: CustomAttributes;
  closeModal: () => void;
}

const ChatWootWidget: React.FC<ChatWootWidgetProps> = ({
  isModalVisible,
  baseUrl,
  websiteToken,
  user = {},
  locale = 'en',
  colorScheme = 'light',
  customAttributes = {},
  closeModal,
}) => {
  const [cwCookie, setCookie] = useState<string>('');

  useEffect(() => {
    const fetchData = async () => {
      const value = await storeHelper.getCookie();
      if (value) {
        setCookie(value);
      }
    };
    
    void fetchData();
  }, []);

  const appColorScheme = Appearance.getColorScheme();

  const { headerBackgroundColor, mainBackgroundColor } = findColors({
    colorScheme,
    appColorScheme: appColorScheme ?? 'light',
  });

  return (
    <Modal
      backdropColor={COLOR_WHITE}
      coverScreen
      isVisible={isModalVisible}
      onBackButtonPress={closeModal}
      onBackdropPress={closeModal}
      style={styles.modal}>
      <SafeAreaView style={[styles.headerView, { backgroundColor: headerBackgroundColor }]} />
      <SafeAreaView style={[styles.mainView, { backgroundColor: mainBackgroundColor }]}>
        <WebView
          websiteToken={websiteToken}
          cwCookie={cwCookie}
          user={user as User}
          baseUrl={baseUrl}
          locale={locale}
          colorScheme={colorScheme}
          customAttributes={customAttributes}
          closeModal={closeModal}
        />
      </SafeAreaView>
    </Modal>
  );
};

export default ChatWootWidget;