import React from 'react';
import { FlatList, StyleSheet, View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { useImages } from '@/contexts/ImageContext';
import Colors from '@/constants/colors';
import { Trash2 } from 'lucide-react-native';

const { width } = Dimensions.get('window');
const numColumns = 3;
const imageSize = (width - 40 - (numColumns - 1) * 10) / numColumns;

export const ImageGrid: React.FC = () => {
  const { images, loading, removeImage } = useImages();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading images...</Text>
      </View>
    );
  }

  if (images.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No images uploaded yet</Text>
      </View>
    );
  }

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.imageContainer}>
      <Image
        source={{ uri: item.url }}
        style={styles.image}
        contentFit="cover"
      />
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => removeImage(item.id)}
      >
        <Trash2 size={16} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  return (
    <FlatList
      data={images}
      renderItem={renderItem}
      numColumns={numColumns}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.container}
      columnWrapperStyle={styles.row}
      showsVerticalScrollIndicator={false}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  imageContainer: {
    position: 'relative',
    width: imageSize,
    height: imageSize,
    borderRadius: 8,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  deleteButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.light.text,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.light.tabIconDefault,
    textAlign: 'center',
  },
});