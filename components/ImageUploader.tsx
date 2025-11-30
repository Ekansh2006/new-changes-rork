import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Platform, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { uploadImage } from '@/services/firebase';

interface ImageUploaderProps {
  onUploadComplete: (url: string) => void;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onUploadComplete }) => {
  const [uploading, setUploading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);

  // Web drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  // Mobile image picker
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      await handleImageUpload(result.assets[0]);
    }
  };

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadImage(file, file.name, setProgress);
      onUploadComplete(url);
    } catch (error: any) {
      Alert.alert('Upload failed', error?.message || 'Please try again.');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleImageUpload = async (asset: ImagePicker.ImagePickerAsset) => {
    setUploading(true);
    try {
      // Convert ImagePickerAsset to Blob for mobile
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const fileName = `image_${Date.now()}.jpg`;
      
      const url = await uploadImage(blob, fileName, setProgress);
      onUploadComplete(url);
    } catch (error: any) {
      console.error('Upload failed', error?.message);
      Alert.alert('Upload failed', 'Please try again.');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <View>
      {Platform.OS === 'web' ? (
        <div
          onDrop={handleDragOver}
          onDragOver={(e) => e.preventDefault()}
          style={{
            border: '2px dashed #ccc',
            padding: 20,
            textAlign: 'center',
            cursor: 'pointer'
          }}
        >
          <Text>Drag and drop images here or click to upload</Text>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
          />
        </div>
      ) : (
        <TouchableOpacity onPress={pickImage}>
          <Text>Tap to upload image</Text>
        </TouchableOpacity>
      )}

      {uploading && (
        <View>
          <Text>Uploading: {Math.round(progress)}%</Text>
        </View>
      )}
    </View>
  );
};