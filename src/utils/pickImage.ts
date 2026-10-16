import * as ImagePicker from 'expo-image-picker';

export interface PickedImage {
  base64: string;
  name: string;
  uri: string;
}

/** Opens the system photo library / file browser. Resolves null when cancelled. */
export async function pickImage(): Promise<PickedImage | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    base64: true,
    // HEIC from the iOS library isn't decodable everywhere; ask for a JPEG/PNG representation.
    preferredAssetRepresentationMode:
      ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  if (!asset.base64) throw new Error('Could not read this image.');
  return { base64: asset.base64, name: asset.fileName ?? 'image', uri: asset.uri };
}
