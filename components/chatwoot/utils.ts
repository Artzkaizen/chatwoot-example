import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  BG_COLOR_DARK,
  BG_COLOR_WHITE,
  COLOR_WHITE,
  POST_MESSAGE_EVENTS,
  WOOT_PREFIX,
} from "./constants";

export const isJsonString = (string: string) => {
  try {
    JSON.parse(string);
  } catch {
    return false;
  }
  return true;
};

export const createWootPostMessage = (object: Record<string, unknown>) => {
  const stringfyObject = `'${WOOT_PREFIX}${JSON.stringify(object)}'`;
  const script = `window.postMessage(${stringfyObject});`;
  return script;
};

export const getMessage = (data: string) => data.replace(WOOT_PREFIX, "");

export interface User {
  identifier: string;
  name: string;
  email: string;
  phone: string;
  avatar: string;
}
export type CustomAttributes = Record<string, unknown>;

interface GenerateScriptsProps {
  colorScheme: string;
  user: User;
  locale: string;
  customAttributes: CustomAttributes;
}
export const generateScripts = ({
  colorScheme,
  user,
  locale,
  customAttributes,
}: GenerateScriptsProps) => {
  let script = "";
  const userObject = {
    event: POST_MESSAGE_EVENTS.SET_USER,
    identifier: user.identifier,
    user,
  };
  script += createWootPostMessage(userObject);
  if (locale) {
    const localeObject = { event: POST_MESSAGE_EVENTS.SET_LOCALE, locale };
    script += createWootPostMessage(localeObject);
  }
  const attributeObject = {
    event: POST_MESSAGE_EVENTS.SET_CUSTOM_ATTRIBUTES,
    customAttributes,
  };
  script += createWootPostMessage(attributeObject);
  if (colorScheme) {
    const themeObject = {
      event: POST_MESSAGE_EVENTS.SET_COLOR_SCHEME,
      darkMode: colorScheme,
    };
    script += createWootPostMessage(themeObject);
  }
  return script;
};

export const storeHelper = {
  getCookie: async () => {
    const cookie = await AsyncStorage.getItem("cwCookie");
    return cookie;
  },
  storeCookie: async (value: string) => {
    await AsyncStorage.setItem("cwCookie", value);
  },
};

export const findColors = ({
  colorScheme,
  appColorScheme,
}: {
  colorScheme: string;
  appColorScheme: string;
}) => {
  let headerBackgroundColor = COLOR_WHITE;
  let mainBackgroundColor = BG_COLOR_WHITE;

  if (
    colorScheme === "dark" ||
    (colorScheme === "auto" && appColorScheme === "dark")
  ) {
    headerBackgroundColor = BG_COLOR_DARK;
    mainBackgroundColor = BG_COLOR_DARK;
  } else if (colorScheme === "auto" && appColorScheme === "light") {
    headerBackgroundColor = COLOR_WHITE;
    mainBackgroundColor = BG_COLOR_WHITE;
  }

  return {
    headerBackgroundColor,
    mainBackgroundColor,
  };
};
