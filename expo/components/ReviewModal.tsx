import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import { X, Star } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Order } from '@/types/marketplace';

interface ReviewModalProps {
  visible: boolean;
  order: Order | null;
  onClose: () => void;
  onSubmit: (rating: number, comment: string) => void;
}

export default function ReviewModal({ visible, order, onClose, onSubmit }: ReviewModalProps) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  const handleSubmit = () => {
    if (rating > 0) {
      onSubmit(rating, comment);
      setRating(5);
      setComment('');
      onClose();
    }
  };

  if (!order) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Laisser un avis</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={styles.sectionTitle}>Commande #{order.id.slice(-8).toUpperCase()}</Text>
            
            <View style={styles.productsPreview}>
              {order.items.map((item, index) => (
                <Text key={index} style={styles.productName} numberOfLines={1}>
                  • {item.product.title}
                </Text>
              ))}
            </View>

            <View style={styles.ratingSection}>
              <Text style={styles.ratingLabel}>Note globale</Text>
              <View style={styles.starsContainer}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => setRating(star)}
                    activeOpacity={0.7}
                  >
                    <Star
                      size={40}
                      color={star <= rating ? '#F59E0B' : '#E5E7EB'}
                      fill={star <= rating ? '#F59E0B' : 'transparent'}
                      strokeWidth={2}
                    />
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.ratingText}>
                {rating === 1 && 'Très mauvais'}
                {rating === 2 && 'Mauvais'}
                {rating === 3 && 'Moyen'}
                {rating === 4 && 'Bien'}
                {rating === 5 && 'Excellent'}
              </Text>
            </View>

            <View style={styles.commentSection}>
              <Text style={styles.commentLabel}>Votre commentaire (optionnel)</Text>
              <TextInput
                style={styles.commentInput}
                placeholder="Partagez votre expérience..."
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
                value={comment}
                onChangeText={setComment}
                textAlignVertical="top"
              />
            </View>

            <TouchableOpacity
              onPress={handleSubmit}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#1E3A8A', '#3B82F6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.submitButton}
              >
                <Text style={styles.submitButtonText}>Publier l&apos;avis</Text>
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#000',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#666',
    marginBottom: 12,
  },
  productsPreview: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 12,
    marginBottom: 24,
  },
  productName: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  ratingSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  ratingLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#000',
    marginBottom: 16,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  ratingText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1E3A8A',
  },
  commentSection: {
    marginBottom: 24,
  },
  commentLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#000',
    marginBottom: 12,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: '#000',
    minHeight: 120,
    backgroundColor: '#F9FAFB',
  },
  submitButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
});
