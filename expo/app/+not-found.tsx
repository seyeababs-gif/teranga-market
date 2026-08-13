import { Link, Stack } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Page introuvable' }} />
      <View style={styles.container}>
        <Text style={styles.title}>Page introuvable</Text>
        <Link href="/(tabs)" style={styles.link}>
          <Text style={styles.linkText}>Retour à l'accueil</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#FFF8F0',
  },
  title: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#2C1810',
    marginBottom: 16,
  },
  link: {
    marginTop: 8,
  },
  linkText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#00853F',
  },
});
