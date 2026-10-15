import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/** Writes the JSON to the app cache and opens the share sheet so it can be saved or sent. */
export async function saveJsonFile(fileName: string, json: string): Promise<void> {
  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  file.write(json);

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    UTI: 'public.json',
    dialogTitle: fileName,
  });
}
