import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLocales } from "expo-localization";
import { I18n } from "i18n-js";
import da from "./da";
import de from "./de";
import en from "./en";
import es from "./es";
import fr from "./fr";
import it from "./it";
import nl from "./nl";
import tr from "./tr";

const i18n = new I18n({
  da: da,
  de: de,
  en: en,
  es: es,
  fr: fr,
  it: it,
  nl: nl,
  tr: tr,
});

i18n.fallbacks = true;

export const initializeLanguage = async () => {
  try {
    const storedLang = await AsyncStorage.getItem("lang");
    const locales = getLocales();
    const resolvedLang =
      storedLang || (locales.length > 0 ? locales[0].languageCode : "en");
    i18n.locale = resolvedLang || "en";
    return resolvedLang;
  } catch (error) {
    console.error("Failed to load language from AsyncStorage:", error);
    i18n.locale = "en";
    return "en";
  }
};

export default i18n;
