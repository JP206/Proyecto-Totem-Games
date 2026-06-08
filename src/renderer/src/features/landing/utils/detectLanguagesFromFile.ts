import {
  AVAILABLE_LANGUAGES,
  type LanguageOption,
} from "../../../constants/languages";
import DesktopManager from "../../../utils/desktop";

export async function detectLanguagesFromFile(
  filePath: string,
): Promise<LanguageOption[]> {
  const headers = await DesktopManager.getInstance().readLocalizeFileHeaders(
    filePath,
  );
  const langHeaders = headers
    .slice(2)
    .map((header) => header.trim().toLowerCase())
    .filter(Boolean);

  if (!langHeaders.length) return [];

  return AVAILABLE_LANGUAGES.filter((lang) =>
    langHeaders.includes(lang.name.toLowerCase()),
  );
}
