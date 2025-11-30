import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ImageData {
  id: string;
  url: string;
  uploadedAt: Date;
  fileName: string;
}

export const [ImageContext, useImages] = createContextHook(() => {
  const [images, setImages] = useState<ImageData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadImages = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem('uploaded_images');
      if (stored) {
        setImages(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load images:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load images from AsyncStorage on app start
  useEffect(() => {
    loadImages();
  }, [loadImages]);

  const addImage = useCallback(async (url: string, fileName: string) => {
    const newImage: ImageData = {
      id: Date.now().toString(),
      url,
      fileName,
      uploadedAt: new Date()
    };

    const updatedImages = [...images, newImage];
    setImages(updatedImages);

    // Persist to AsyncStorage
    await AsyncStorage.setItem('uploaded_images', JSON.stringify(updatedImages));
  }, [images]);

  const removeImage = useCallback(async (id: string) => {
    const updatedImages = images.filter(img => img.id !== id);
    setImages(updatedImages);
    await AsyncStorage.setItem('uploaded_images', JSON.stringify(updatedImages));
  }, [images]);

  return useMemo(() => ({
    images,
    loading,
    addImage,
    removeImage,
    loadImages
  }), [images, loading, addImage, removeImage, loadImages]);
});