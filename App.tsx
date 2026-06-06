import type { ComponentProps } from 'react';
import { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, type BarcodeScanningResult, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

type IconName = ComponentProps<typeof Ionicons>['name'];

type NutritionFacts = {
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  sugar: number | null;
  sodium: number | null;
};

type NutritionResult = {
  title: string;
  subtitle?: string;
  serving: string;
  source: string;
  confidence: 'High' | 'Medium' | 'Low';
  facts: NutritionFacts;
  imageUri?: string;
  grade?: string;
  novaGroup?: number;
  notes: string[];
};

type FoodRecord = {
  name: string;
  aliases: string[];
  serving: string;
  facts: NutritionFacts;
};

type FeatureAction = 'barcode' | 'camera' | 'gallery' | 'search';

type Feature = {
  key: FeatureAction;
  label: string;
  accent: string;
  icon: IconName;
};

const EMPTY_FACTS: NutritionFacts = {
  calories: null,
  protein: null,
  carbs: null,
  fat: null,
  fiber: null,
  sugar: null,
  sodium: null,
};

// Average cooked-food portions used only after the user confirms a match.
const FOOD_LIBRARY: FoodRecord[] = [
  {
    name: 'Cooked white rice',
    aliases: ['rice', 'white rice', 'cooked rice', 'plain rice'],
    serving: '1 cup cooked (158 g)',
    facts: { calories: 205, protein: 4.3, carbs: 44.5, fat: 0.4, fiber: 0.6, sugar: 0.1, sodium: 2 },
  },
  {
    name: 'Chapati',
    aliases: ['chapati', 'roti', 'phulka'],
    serving: '1 medium (40 g)',
    facts: { calories: 120, protein: 3.5, carbs: 18, fat: 3.7, fiber: 2.6, sugar: 0.9, sodium: 120 },
  },
  {
    name: 'Dal',
    aliases: ['dal', 'daal', 'lentil curry', 'lentils'],
    serving: '1 cup (198 g)',
    facts: { calories: 230, protein: 13.2, carbs: 35.4, fat: 4.2, fiber: 8, sugar: 3.6, sodium: 360 },
  },
  {
    name: 'Idli',
    aliases: ['idli', 'idly'],
    serving: '2 pieces (78 g)',
    facts: { calories: 117, protein: 4, carbs: 24, fat: 0.7, fiber: 1.6, sugar: 0.4, sodium: 180 },
  },
  {
    name: 'Plain dosa',
    aliases: ['dosa', 'plain dosa'],
    serving: '1 medium (100 g)',
    facts: { calories: 168, protein: 3.9, carbs: 29, fat: 3.7, fiber: 1.3, sugar: 0.5, sodium: 94 },
  },
  {
    name: 'Banana',
    aliases: ['banana', 'elaichi banana'],
    serving: '1 medium (118 g)',
    facts: { calories: 105, protein: 1.3, carbs: 27, fat: 0.4, fiber: 3.1, sugar: 14.4, sodium: 1 },
  },
  {
    name: 'Apple',
    aliases: ['apple'],
    serving: '1 medium (182 g)',
    facts: { calories: 95, protein: 0.5, carbs: 25.1, fat: 0.3, fiber: 4.4, sugar: 18.9, sodium: 2 },
  },
  {
    name: 'Boiled egg',
    aliases: ['egg', 'boiled egg', 'hard boiled egg'],
    serving: '1 large (50 g)',
    facts: { calories: 78, protein: 6.3, carbs: 0.6, fat: 5.3, fiber: 0, sugar: 0.6, sodium: 62 },
  },
  {
    name: 'Grilled chicken breast',
    aliases: ['chicken', 'chicken breast', 'grilled chicken'],
    serving: '100 g cooked',
    facts: { calories: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0, sugar: 0, sodium: 74 },
  },
  {
    name: 'Paneer',
    aliases: ['paneer', 'cottage cheese'],
    serving: '100 g',
    facts: { calories: 296, protein: 18.3, carbs: 4.5, fat: 22, fiber: 0, sugar: 2.4, sodium: 22 },
  },
  {
    name: 'Milk',
    aliases: ['milk', 'whole milk'],
    serving: '1 cup (244 ml)',
    facts: { calories: 149, protein: 7.7, carbs: 11.7, fat: 8, fiber: 0, sugar: 12.3, sodium: 105 },
  },
  {
    name: 'Oats',
    aliases: ['oats', 'oatmeal', 'porridge'],
    serving: '1 cup cooked (234 g)',
    facts: { calories: 154, protein: 6, carbs: 27.4, fat: 3.2, fiber: 4, sugar: 1.1, sodium: 9 },
  },
  {
    name: 'Vegetable salad',
    aliases: ['salad', 'veg salad', 'vegetable salad'],
    serving: '1 bowl (150 g)',
    facts: { calories: 70, protein: 2.5, carbs: 12, fat: 2, fiber: 4, sugar: 5, sodium: 95 },
  },
  {
    name: 'Cheese pizza',
    aliases: ['pizza', 'cheese pizza'],
    serving: '1 slice (107 g)',
    facts: { calories: 285, protein: 12.2, carbs: 35.7, fat: 10.4, fiber: 2.5, sugar: 3.8, sodium: 640 },
  },
];

const FEATURES: Feature[] = [
  { key: 'barcode', label: 'Barcode', icon: 'barcode-outline', accent: '#1A7F64' },
  { key: 'camera', label: 'Meal Photo', icon: 'camera-outline', accent: '#E45D3D' },
  { key: 'gallery', label: 'Gallery', icon: 'images-outline', accent: '#457B9D' },
  { key: 'search', label: 'Food Search', icon: 'search-outline', accent: '#A76B00' },
];

const QUICK_FOODS = ['rice', 'chapati', 'dal', 'banana', 'egg', 'paneer'];

const OPEN_FOOD_FACTS_FIELDS = [
  'code',
  'product_name',
  'brands',
  'quantity',
  'serving_size',
  'image_front_url',
  'nutriments',
  'nutrition_data',
  'nutrition_grades',
  'nova_group',
].join(',');

const PRODUCT_BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'] as const;

const toNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

const multiplyFacts = (facts: NutritionFacts, multiplier: number): NutritionFacts => ({
  calories: facts.calories === null ? null : facts.calories * multiplier,
  protein: facts.protein === null ? null : facts.protein * multiplier,
  carbs: facts.carbs === null ? null : facts.carbs * multiplier,
  fat: facts.fat === null ? null : facts.fat * multiplier,
  fiber: facts.fiber === null ? null : facts.fiber * multiplier,
  sugar: facts.sugar === null ? null : facts.sugar * multiplier,
  sodium: facts.sodium === null ? null : facts.sodium * multiplier,
});

const formatNumber = (value: number | null, decimals = 1) => {
  if (value === null) {
    return '--';
  }

  if (Math.abs(value) >= 100 || decimals === 0) {
    return `${Math.round(value)}`;
  }

  return value.toFixed(decimals).replace('.0', '');
};

const parsePortions = (value: string) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1;
  }

  return Math.min(parsed, 10);
};

const findFood = (query: string) => {
  const search = normalize(query);
  if (!search) {
    return null;
  }

  return (
    FOOD_LIBRARY.find((food) =>
      food.aliases.some((alias) => {
        const normalizedAlias = normalize(alias);
        return search === normalizedAlias || search.includes(normalizedAlias) || normalizedAlias.includes(search);
      }),
    ) ?? null
  );
};

const getFactCoverage = (facts: NutritionFacts) =>
  [facts.calories, facts.protein, facts.carbs, facts.fat].filter((value) => value !== null).length;

function buildProductFacts(product: Record<string, any>): NutritionFacts {
  const nutriments = product.nutriments ?? {};
  const sodiumGrams = toNumber(nutriments.sodium_100g ?? nutriments.sodium);

  return {
    calories: toNumber(nutriments['energy-kcal_100g'] ?? nutriments['energy-kcal']),
    protein: toNumber(nutriments.proteins_100g ?? nutriments.proteins),
    carbs: toNumber(nutriments.carbohydrates_100g ?? nutriments.carbohydrates),
    fat: toNumber(nutriments.fat_100g ?? nutriments.fat),
    fiber: toNumber(nutriments.fiber_100g ?? nutriments.fiber),
    sugar: toNumber(nutriments.sugars_100g ?? nutriments.sugars),
    sodium: sodiumGrams === null ? null : sodiumGrams * 1000,
  };
}

async function fetchProductByBarcode(barcode: string): Promise<NutritionResult> {
  const headers: Record<string, string> =
    Platform.OS === 'web'
      ? {}
      : {
          'User-Agent': 'NutritionScan/1.0 (local-development)',
        };

  const response = await fetch(
    `https://world.openfoodfacts.org/api/v3/product/${encodeURIComponent(
      barcode,
    )}.json?fields=${OPEN_FOOD_FACTS_FIELDS}`,
    { headers },
  );

  if (!response.ok) {
    throw new Error(`Open Food Facts returned ${response.status}`);
  }

  const payload = await response.json();
  const product = payload.product;

  if (payload.status !== 'success' || !product) {
    return {
      title: 'Product not found',
      subtitle: barcode,
      serving: 'No label data',
      source: 'Barcode lookup',
      confidence: 'Low',
      facts: EMPTY_FACTS,
      notes: ['No nutrition values were shown because this barcode was not found.'],
    };
  }

  const facts = buildProductFacts(product);
  const coverage = getFactCoverage(facts);
  const productName = product.product_name || 'Scanned product';
  const brand = product.brands ? String(product.brands).split(',')[0].trim() : undefined;

  return {
    title: productName,
    subtitle: brand || product.quantity || barcode,
    serving: 'Per 100 g',
    source: 'Open Food Facts barcode data',
    confidence: coverage >= 4 ? 'High' : coverage >= 2 ? 'Medium' : 'Low',
    facts,
    imageUri: product.image_front_url,
    grade: typeof product.nutrition_grades === 'string' ? product.nutrition_grades.toUpperCase() : undefined,
    novaGroup: toNumber(product.nova_group) ?? undefined,
    notes: [
      product.serving_size ? `Label serving: ${product.serving_size}` : 'Serving size was not listed.',
      coverage >= 4 ? 'Core macros were available from the barcode record.' : 'Some nutrition fields were missing from the barcode record.',
    ],
  };
}

function createFoodEstimate(query: string, portionsText: string, imageUri?: string): NutritionResult {
  const matchedFood = findFood(query);

  if (!matchedFood) {
    return {
      title: 'Food not matched',
      subtitle: query.trim() || 'No food name',
      serving: 'Awaiting match',
      source: 'Confirmed-food estimate',
      confidence: 'Low',
      facts: EMPTY_FACTS,
      imageUri,
      notes: ['No nutrition estimate was shown because the food name was not recognized.'],
    };
  }

  const portions = parsePortions(portionsText);
  const facts = multiplyFacts(matchedFood.facts, portions);

  return {
    title: matchedFood.name,
    subtitle: portions === 1 ? undefined : `${formatNumber(portions)} portions`,
    serving: `${formatNumber(portions)} x ${matchedFood.serving}`,
    source: 'Confirmed-food estimate',
    confidence: 'Medium',
    facts,
    imageUri,
    notes: ['Average values can change with recipe, oil, brand, and portion size.'],
  };
}

function AppContent() {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scannerLocked, setScannerLocked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [foodQuery, setFoodQuery] = useState('');
  const [portionCount, setPortionCount] = useState('1');
  const [selectedImage, setSelectedImage] = useState<string | undefined>();
  const [result, setResult] = useState<NutritionResult>({
    title: 'Ready to scan',
    serving: 'Choose a feature',
    source: 'NutritionScan',
    confidence: 'Medium',
    facts: EMPTY_FACTS,
    notes: ['Barcode results use product records. Meal results need a confirmed food name.'],
  });
  const { width } = useWindowDimensions();
  const tileWidth = useMemo(() => (width >= 720 ? '23.5%' : '48%'), [width]);

  const openBarcodeScanner = async () => {
    if (!cameraPermission?.granted) {
      const permission = await requestCameraPermission();
      if (!permission.granted) {
        Alert.alert('Camera blocked', 'Camera access is needed for barcode scanning.');
        return;
      }
    }

    setScannerLocked(false);
    setScannerVisible(true);
  };

  const handleBarcodeScanned = async ({ data }: BarcodeScanningResult) => {
    if (scannerLocked) {
      return;
    }

    const barcode = data.replace(/\D/g, '');
    if (!barcode) {
      return;
    }

    setScannerLocked(true);
    setScannerVisible(false);
    setIsLoading(true);

    try {
      const barcodeResult = await fetchProductByBarcode(barcode);
      setSelectedImage(undefined);
      setResult(barcodeResult);
    } catch (error) {
      setResult({
        title: 'Lookup failed',
        subtitle: barcode,
        serving: 'Try again',
        source: 'Barcode lookup',
        confidence: 'Low',
        facts: EMPTY_FACTS,
        notes: [error instanceof Error ? error.message : 'The nutrition service could not be reached.'],
      });
    } finally {
      setIsLoading(false);
      setScannerLocked(false);
    }
  };

  const captureMealImage = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera blocked', 'Camera access is needed for meal photos.');
      return;
    }

    const cameraResult = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.85,
    });

    if (!cameraResult.canceled) {
      const uri = cameraResult.assets[0]?.uri;
      setSelectedImage(uri);
      setResult(createFoodEstimate(foodQuery, portionCount, uri));
    }
  };

  const pickMealImage = async () => {
    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.85,
    });

    if (!pickerResult.canceled) {
      const uri = pickerResult.assets[0]?.uri;
      setSelectedImage(uri);
      setResult(createFoodEstimate(foodQuery, portionCount, uri));
    }
  };

  const estimateCurrentFood = () => {
    setResult(createFoodEstimate(foodQuery, portionCount, selectedImage));
  };

  const runFeature = (feature: FeatureAction) => {
    if (feature === 'barcode') {
      openBarcodeScanner();
      return;
    }

    if (feature === 'camera') {
      captureMealImage();
      return;
    }

    if (feature === 'gallery') {
      pickMealImage();
      return;
    }

    estimateCurrentFood();
  };

  return (
    <SafeAreaView style={styles.app}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardView}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <View style={styles.brandLockup}>
                <View style={styles.brandMark}>
                  <Ionicons name="scan-outline" size={28} color="#FFFFFF" />
                </View>
                <View>
                  <Text style={styles.brandName}>NutritionScan</Text>
                  <Text style={styles.brandMeta}>Scan. Verify. Track.</Text>
                </View>
              </View>
              <View style={styles.confidencePill}>
                <Ionicons name="shield-checkmark-outline" size={17} color="#1A7F64" />
                <Text style={styles.confidenceText}>{result.confidence}</Text>
              </View>
            </View>
          </View>

          <View style={styles.featureGrid}>
            {FEATURES.map((feature) => (
              <Pressable
                key={feature.key}
                onPress={() => runFeature(feature.key)}
                style={({ pressed }) => [
                  styles.featureTile,
                  { width: tileWidth, borderTopColor: feature.accent },
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.featureIcon, { backgroundColor: `${feature.accent}18` }]}>
                  <Ionicons name={feature.icon} size={34} color={feature.accent} />
                </View>
                <Text style={styles.featureLabel}>{feature.label}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.searchPanel}>
            <View style={styles.inputRow}>
              <Ionicons name="fast-food-outline" size={22} color="#5C6962" />
              <TextInput
                value={foodQuery}
                onChangeText={setFoodQuery}
                placeholder="Food name"
                placeholderTextColor="#8B968F"
                returnKeyType="search"
                onSubmitEditing={estimateCurrentFood}
                style={styles.foodInput}
              />
              <TextInput
                value={portionCount}
                onChangeText={setPortionCount}
                keyboardType="decimal-pad"
                placeholder="1"
                placeholderTextColor="#8B968F"
                style={styles.portionInput}
              />
              <Pressable onPress={estimateCurrentFood} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
                <Ionicons name="arrow-forward" size={22} color="#FFFFFF" />
              </Pressable>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickFoodRow}>
              {QUICK_FOODS.map((food) => (
                <Pressable
                  key={food}
                  onPress={() => {
                    setFoodQuery(food);
                    setResult(createFoodEstimate(food, portionCount, selectedImage));
                  }}
                  style={({ pressed }) => [styles.quickFoodButton, pressed && styles.pressed]}
                >
                  <Text style={styles.quickFoodText}>{food}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <View style={styles.resultCard}>
            {isLoading ? (
              <View style={styles.loadingState}>
                <ActivityIndicator size="large" color="#1A7F64" />
                <Text style={styles.loadingText}>Checking nutrition data</Text>
              </View>
            ) : (
              <>
                <View style={styles.resultHeader}>
                  {result.imageUri ? (
                    <Image source={{ uri: result.imageUri }} style={styles.resultImage} />
                  ) : (
                    <View style={styles.resultImageFallback}>
                      <Ionicons name="restaurant-outline" size={30} color="#1A7F64" />
                    </View>
                  )}
                  <View style={styles.resultTitleBlock}>
                    <Text style={styles.resultTitle}>{result.title}</Text>
                    {result.subtitle ? <Text style={styles.resultSubtitle}>{result.subtitle}</Text> : null}
                    <Text style={styles.resultSource}>{result.source}</Text>
                  </View>
                </View>

                <View style={styles.servingRow}>
                  <Text style={styles.servingLabel}>Serving</Text>
                  <Text style={styles.servingValue}>{result.serving}</Text>
                </View>

                <View style={styles.statsGrid}>
                  <NutritionStat label="Calories" value={formatNumber(result.facts.calories, 0)} unit="kcal" tone="#1A7F64" />
                  <NutritionStat label="Protein" value={formatNumber(result.facts.protein)} unit="g" tone="#457B9D" />
                  <NutritionStat label="Carbs" value={formatNumber(result.facts.carbs)} unit="g" tone="#A76B00" />
                  <NutritionStat label="Fat" value={formatNumber(result.facts.fat)} unit="g" tone="#E45D3D" />
                  <NutritionStat label="Fiber" value={formatNumber(result.facts.fiber)} unit="g" tone="#607D3B" />
                  <NutritionStat label="Sodium" value={formatNumber(result.facts.sodium, 0)} unit="mg" tone="#6E5A9A" />
                </View>

                {(result.grade || result.novaGroup) && (
                  <View style={styles.badgeRow}>
                    {result.grade ? (
                      <View style={styles.dataBadge}>
                        <Text style={styles.dataBadgeLabel}>Nutri-Score</Text>
                        <Text style={styles.dataBadgeValue}>{result.grade}</Text>
                      </View>
                    ) : null}
                    {result.novaGroup ? (
                      <View style={styles.dataBadge}>
                        <Text style={styles.dataBadgeLabel}>NOVA</Text>
                        <Text style={styles.dataBadgeValue}>{result.novaGroup}</Text>
                      </View>
                    ) : null}
                  </View>
                )}

                <View style={styles.notesBlock}>
                  {result.notes.map((note) => (
                    <View key={note} style={styles.noteRow}>
                      <View style={styles.noteDot} />
                      <Text style={styles.noteText}>{note}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={scannerVisible} animationType="slide" onRequestClose={() => setScannerVisible(false)}>
        <View style={styles.scannerScreen}>
          {cameraPermission?.granted ? (
            <CameraView
              active={scannerVisible}
              barcodeScannerSettings={{ barcodeTypes: [...PRODUCT_BARCODE_TYPES] }}
              facing="back"
              onBarcodeScanned={scannerLocked ? undefined : handleBarcodeScanned}
              style={styles.camera}
            />
          ) : (
            <View style={styles.permissionScreen}>
              <Ionicons name="camera-outline" size={40} color="#1A7F64" />
              <Text style={styles.permissionTitle}>Camera access needed</Text>
              <Pressable onPress={requestCameraPermission} style={styles.permissionButton}>
                <Text style={styles.permissionButtonText}>Allow camera</Text>
              </Pressable>
            </View>
          )}

          <SafeAreaView pointerEvents="box-none" style={styles.scannerOverlay}>
            <View style={styles.scannerTopBar}>
              <Pressable onPress={() => setScannerVisible(false)} style={styles.closeButton}>
                <Ionicons name="close" size={26} color="#FFFFFF" />
              </Pressable>
              <Text style={styles.scannerTitle}>Barcode</Text>
              <View style={styles.closeButtonPlaceholder} />
            </View>
            <View style={styles.scanFrame}>
              <View style={styles.scanCornerTopLeft} />
              <View style={styles.scanCornerTopRight} />
              <View style={styles.scanCornerBottomLeft} />
              <View style={styles.scanCornerBottomRight} />
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function NutritionStat({ label, value, unit, tone }: { label: string; value: string; unit: string; tone: string }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statAccent, { backgroundColor: tone }]} />
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statValueRow}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statUnit}>{unit}</Text>
      </View>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: '#F7F8F3',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    gap: 22,
    padding: 20,
    paddingBottom: 36,
  },
  header: {
    gap: 14,
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  brandLockup: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    gap: 12,
  },
  brandMark: {
    alignItems: 'center',
    backgroundColor: '#1A7F64',
    borderRadius: 8,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  brandName: {
    color: '#10231D',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0,
  },
  brandMeta: {
    color: '#5C6962',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0,
    marginTop: 2,
  },
  confidencePill: {
    alignItems: 'center',
    backgroundColor: '#E5F3ED',
    borderColor: '#BBDCCF',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 38,
    paddingHorizontal: 10,
  },
  confidenceText: {
    color: '#1A7F64',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  featureTile: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E0E5DE',
    borderRadius: 8,
    borderTopWidth: 4,
    borderWidth: 1,
    gap: 16,
    minHeight: 138,
    padding: 16,
    boxShadow: '0 8px 12px rgba(16, 35, 29, 0.06)',
  },
  featureIcon: {
    alignItems: 'center',
    borderRadius: 8,
    height: 60,
    justifyContent: 'center',
    width: 60,
  },
  featureLabel: {
    color: '#10231D',
    flexShrink: 1,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.99 }],
  },
  searchPanel: {
    gap: 12,
  },
  inputRow: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE4DC',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 60,
    paddingLeft: 14,
    paddingRight: 6,
  },
  foodInput: {
    color: '#10231D',
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0,
    minHeight: 52,
    minWidth: 84,
  },
  portionInput: {
    backgroundColor: '#F2F5F0',
    borderRadius: 8,
    color: '#10231D',
    fontSize: 16,
    fontWeight: '800',
    height: 44,
    letterSpacing: 0,
    textAlign: 'center',
    width: 54,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: '#1A7F64',
    borderRadius: 8,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  quickFoodRow: {
    gap: 8,
    paddingRight: 20,
  },
  quickFoodButton: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE4DC',
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  quickFoodText: {
    color: '#38463F',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'capitalize',
  },
  resultCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE4DC',
    borderRadius: 8,
    borderWidth: 1,
    gap: 16,
    minHeight: 360,
    padding: 16,
    boxShadow: '0 10px 18px rgba(16, 35, 29, 0.07)',
  },
  loadingState: {
    alignItems: 'center',
    flex: 1,
    gap: 14,
    justifyContent: 'center',
    minHeight: 300,
  },
  loadingText: {
    color: '#5C6962',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0,
  },
  resultHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  resultImage: {
    backgroundColor: '#EFF3EC',
    borderRadius: 8,
    height: 76,
    width: 76,
  },
  resultImageFallback: {
    alignItems: 'center',
    backgroundColor: '#E5F3ED',
    borderRadius: 8,
    height: 76,
    justifyContent: 'center',
    width: 76,
  },
  resultTitleBlock: {
    flex: 1,
    gap: 4,
  },
  resultTitle: {
    color: '#10231D',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0,
  },
  resultSubtitle: {
    color: '#5C6962',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0,
  },
  resultSource: {
    color: '#1A7F64',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
  },
  servingRow: {
    alignItems: 'center',
    backgroundColor: '#F2F5F0',
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  servingLabel: {
    color: '#5C6962',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
  },
  servingValue: {
    color: '#10231D',
    flex: 1,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
    textAlign: 'right',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  statCard: {
    backgroundColor: '#FAFBF8',
    borderColor: '#E1E6DF',
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 92,
    overflow: 'hidden',
    padding: 12,
    width: '48%',
  },
  statAccent: {
    height: 4,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  statLabel: {
    color: '#66726B',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    marginTop: 6,
  },
  statValueRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 5,
    marginTop: 10,
  },
  statValue: {
    color: '#10231D',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0,
  },
  statUnit: {
    color: '#66726B',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dataBadge: {
    backgroundColor: '#FFF6E3',
    borderColor: '#E6C774',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minHeight: 54,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dataBadgeLabel: {
    color: '#7C5E16',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0,
  },
  dataBadgeValue: {
    color: '#342607',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0,
    marginTop: 3,
  },
  notesBlock: {
    gap: 8,
  },
  noteRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
  },
  noteDot: {
    backgroundColor: '#1A7F64',
    borderRadius: 4,
    height: 7,
    marginTop: 7,
    width: 7,
  },
  noteText: {
    color: '#5C6962',
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 19,
  },
  scannerScreen: {
    backgroundColor: '#050A08',
    flex: 1,
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
  },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    padding: 20,
  },
  scannerTopBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(16, 35, 29, 0.72)',
    borderRadius: 8,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  closeButtonPlaceholder: {
    height: 44,
    width: 44,
  },
  scannerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0,
  },
  scanFrame: {
    alignSelf: 'center',
    height: 240,
    marginBottom: 120,
    position: 'relative',
    width: '82%',
  },
  scanCornerTopLeft: {
    borderColor: '#FFFFFF',
    borderLeftWidth: 5,
    borderTopWidth: 5,
    height: 54,
    left: 0,
    position: 'absolute',
    top: 0,
    width: 54,
  },
  scanCornerTopRight: {
    borderColor: '#FFFFFF',
    borderRightWidth: 5,
    borderTopWidth: 5,
    height: 54,
    position: 'absolute',
    right: 0,
    top: 0,
    width: 54,
  },
  scanCornerBottomLeft: {
    borderBottomWidth: 5,
    borderColor: '#FFFFFF',
    borderLeftWidth: 5,
    bottom: 0,
    height: 54,
    left: 0,
    position: 'absolute',
    width: 54,
  },
  scanCornerBottomRight: {
    borderBottomWidth: 5,
    borderColor: '#FFFFFF',
    borderRightWidth: 5,
    bottom: 0,
    height: 54,
    position: 'absolute',
    right: 0,
    width: 54,
  },
  permissionScreen: {
    alignItems: 'center',
    backgroundColor: '#F7F8F3',
    flex: 1,
    gap: 16,
    justifyContent: 'center',
    padding: 24,
  },
  permissionTitle: {
    color: '#10231D',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0,
  },
  permissionButton: {
    backgroundColor: '#1A7F64',
    borderRadius: 8,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
  },
});
