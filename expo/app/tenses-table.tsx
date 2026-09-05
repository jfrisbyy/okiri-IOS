import React, { useState, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  SafeAreaView,
  Animated,
} from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { safeGoBack } from '@/utils/navigation';
import { ArrowLeft, ChevronDown, ChevronUp, Book, X, Play } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { commonVerbs, tenseInfo, pronouns, pronounKeys, VerbConjugations } from '@/mocks/frenchTenses';

const exampleSentences: { [key: string]: { [tense: string]: { [pronoun: string]: { fr: string; en: string } } } } = {
  'être': {
    'Present': {
      je: { fr: "Je suis fatigué après le travail.", en: "I am tired after work." },
      tu: { fr: "Tu es très gentil avec moi.", en: "You are very kind to me." },
      il: { fr: "Il est médecin à l'hôpital.", en: "He is a doctor at the hospital." },
      nous: { fr: "Nous sommes contents de te voir.", en: "We are happy to see you." },
      vous: { fr: "Vous êtes les bienvenus chez nous.", en: "You are welcome at our place." },
      ils: { fr: "Ils sont en vacances en France.", en: "They are on vacation in France." },
    },
    'Passé Composé': {
      je: { fr: "J'ai été surpris par la nouvelle.", en: "I was surprised by the news." },
      tu: { fr: "Tu as été très courageux.", en: "You were very brave." },
      il: { fr: "Il a été malade la semaine dernière.", en: "He was sick last week." },
      nous: { fr: "Nous avons été impressionnés.", en: "We were impressed." },
      vous: { fr: "Vous avez été très patients.", en: "You were very patient." },
      ils: { fr: "Ils ont été invités à la fête.", en: "They were invited to the party." },
    },
    'Imparfait': {
      je: { fr: "J'étais jeune à cette époque.", en: "I was young at that time." },
      tu: { fr: "Tu étais toujours en retard.", en: "You were always late." },
      il: { fr: "Il était heureux dans son travail.", en: "He was happy in his job." },
      nous: { fr: "Nous étions souvent ensemble.", en: "We were often together." },
      vous: { fr: "Vous étiez très occupés.", en: "You were very busy." },
      ils: { fr: "Ils étaient les meilleurs amis.", en: "They were best friends." },
    },
    'Futur Simple': {
      je: { fr: "Je serai là demain matin.", en: "I will be there tomorrow morning." },
      tu: { fr: "Tu seras un grand artiste.", en: "You will be a great artist." },
      il: { fr: "Il sera célèbre un jour.", en: "He will be famous one day." },
      nous: { fr: "Nous serons prêts à partir.", en: "We will be ready to leave." },
      vous: { fr: "Vous serez les premiers informés.", en: "You will be the first to know." },
      ils: { fr: "Ils seront très contents.", en: "They will be very happy." },
    },
    'Conditionnel': {
      je: { fr: "Je serais ravi de vous aider.", en: "I would be delighted to help you." },
      tu: { fr: "Tu serais parfait pour ce rôle.", en: "You would be perfect for this role." },
      il: { fr: "Il serait intéressé par cette offre.", en: "He would be interested in this offer." },
      nous: { fr: "Nous serions honorés de vous recevoir.", en: "We would be honored to host you." },
      vous: { fr: "Vous seriez surpris de le savoir.", en: "You would be surprised to know." },
      ils: { fr: "Ils seraient les premiers à partir.", en: "They would be the first to leave." },
    },
    'Subjonctif': {
      je: { fr: "Il faut que je sois prudent.", en: "I must be careful." },
      tu: { fr: "Je veux que tu sois heureux.", en: "I want you to be happy." },
      il: { fr: "Il est important qu'il soit présent.", en: "It's important that he be present." },
      nous: { fr: "Elle souhaite que nous soyons là.", en: "She wishes we would be there." },
      vous: { fr: "Je préfère que vous soyez informés.", en: "I prefer that you be informed." },
      ils: { fr: "Il faut qu'ils soient prêts.", en: "They must be ready." },
    },
  },
  'avoir': {
    'Present': {
      je: { fr: "J'ai deux frères et une sœur.", en: "I have two brothers and one sister." },
      tu: { fr: "Tu as de la chance.", en: "You are lucky." },
      il: { fr: "Il a beaucoup d'amis.", en: "He has many friends." },
      nous: { fr: "Nous avons une grande maison.", en: "We have a big house." },
      vous: { fr: "Vous avez raison.", en: "You are right." },
      ils: { fr: "Ils ont faim.", en: "They are hungry." },
    },
    'Futur Simple': {
      je: { fr: "J'aurai vingt ans l'année prochaine.", en: "I will be twenty next year." },
      tu: { fr: "Tu auras le temps de finir.", en: "You will have time to finish." },
      il: { fr: "Il aura une promotion bientôt.", en: "He will get a promotion soon." },
      nous: { fr: "Nous aurons une réunion demain.", en: "We will have a meeting tomorrow." },
      vous: { fr: "Vous aurez les résultats lundi.", en: "You will have the results on Monday." },
      ils: { fr: "Ils auront besoin d'aide.", en: "They will need help." },
    },
  },
  'aller': {
    'Present': {
      je: { fr: "Je vais au marché ce matin.", en: "I am going to the market this morning." },
      tu: { fr: "Tu vas bien aujourd'hui ?", en: "Are you doing well today?" },
      il: { fr: "Il va à l'école en bus.", en: "He goes to school by bus." },
      nous: { fr: "Nous allons au cinéma ce soir.", en: "We are going to the cinema tonight." },
      vous: { fr: "Vous allez en France cet été ?", en: "Are you going to France this summer?" },
      ils: { fr: "Ils vont souvent au restaurant.", en: "They often go to the restaurant." },
    },
    'Futur Simple': {
      je: { fr: "J'irai te chercher à la gare.", en: "I will pick you up at the station." },
      tu: { fr: "Tu iras loin dans la vie.", en: "You will go far in life." },
      il: { fr: "Il ira à Paris la semaine prochaine.", en: "He will go to Paris next week." },
      nous: { fr: "Nous irons à la plage demain.", en: "We will go to the beach tomorrow." },
      vous: { fr: "Vous irez voir ce film ?", en: "Will you go see this movie?" },
      ils: { fr: "Ils iront en vacances en août.", en: "They will go on vacation in August." },
    },
  },
  'faire': {
    'Present': {
      je: { fr: "Je fais du sport tous les jours.", en: "I exercise every day." },
      tu: { fr: "Tu fais quoi ce week-end ?", en: "What are you doing this weekend?" },
      il: { fr: "Il fait beau aujourd'hui.", en: "The weather is nice today." },
      nous: { fr: "Nous faisons la cuisine ensemble.", en: "We cook together." },
      vous: { fr: "Vous faites un excellent travail.", en: "You do excellent work." },
      ils: { fr: "Ils font leurs devoirs.", en: "They do their homework." },
    },
    'Futur Simple': {
      je: { fr: "Je ferai de mon mieux.", en: "I will do my best." },
      tu: { fr: "Tu feras attention à toi.", en: "You will take care of yourself." },
      il: { fr: "Il fera froid demain.", en: "It will be cold tomorrow." },
      nous: { fr: "Nous ferons une fête.", en: "We will have a party." },
      vous: { fr: "Vous ferez comme vous voulez.", en: "You will do as you wish." },
      ils: { fr: "Ils feront le voyage ensemble.", en: "They will make the trip together." },
    },
  },
  'pouvoir': {
    'Present': {
      je: { fr: "Je peux t'aider si tu veux.", en: "I can help you if you want." },
      tu: { fr: "Tu peux venir ce soir ?", en: "Can you come tonight?" },
      il: { fr: "Il peut parler trois langues.", en: "He can speak three languages." },
      nous: { fr: "Nous pouvons partir maintenant.", en: "We can leave now." },
      vous: { fr: "Vous pouvez entrer.", en: "You may enter." },
      ils: { fr: "Ils peuvent rester ici.", en: "They can stay here." },
    },
    'Conditionnel': {
      je: { fr: "Je pourrais vous aider demain.", en: "I could help you tomorrow." },
      tu: { fr: "Tu pourrais faire mieux.", en: "You could do better." },
      il: { fr: "Il pourrait venir avec nous.", en: "He could come with us." },
      nous: { fr: "Nous pourrions dîner ensemble.", en: "We could have dinner together." },
      vous: { fr: "Vous pourriez m'expliquer ?", en: "Could you explain to me?" },
      ils: { fr: "Ils pourraient arriver en retard.", en: "They could arrive late." },
    },
  },
  'vouloir': {
    'Present': {
      je: { fr: "Je veux apprendre le français.", en: "I want to learn French." },
      tu: { fr: "Tu veux un café ?", en: "Do you want a coffee?" },
      il: { fr: "Il veut devenir médecin.", en: "He wants to become a doctor." },
      nous: { fr: "Nous voulons voyager.", en: "We want to travel." },
      vous: { fr: "Vous voulez autre chose ?", en: "Do you want anything else?" },
      ils: { fr: "Ils veulent partir tôt.", en: "They want to leave early." },
    },
    'Conditionnel': {
      je: { fr: "Je voudrais un croissant, s'il vous plaît.", en: "I would like a croissant, please." },
      tu: { fr: "Tu voudrais venir avec nous ?", en: "Would you like to come with us?" },
      il: { fr: "Il voudrait te parler.", en: "He would like to talk to you." },
      nous: { fr: "Nous voudrions réserver une table.", en: "We would like to book a table." },
      vous: { fr: "Vous voudriez du vin ?", en: "Would you like some wine?" },
      ils: { fr: "Ils voudraient partir en vacances.", en: "They would like to go on vacation." },
    },
  },
  'parler': {
    'Present': {
      je: { fr: "Je parle français couramment.", en: "I speak French fluently." },
      tu: { fr: "Tu parles trop vite.", en: "You speak too fast." },
      il: { fr: "Il parle quatre langues.", en: "He speaks four languages." },
      nous: { fr: "Nous parlons de nos projets.", en: "We talk about our plans." },
      vous: { fr: "Vous parlez anglais ?", en: "Do you speak English?" },
      ils: { fr: "Ils parlent souvent au téléphone.", en: "They often talk on the phone." },
    },
    'Futur Simple': {
      je: { fr: "Je parlerai au directeur demain.", en: "I will speak to the director tomorrow." },
      tu: { fr: "Tu parleras de nous ?", en: "Will you talk about us?" },
      il: { fr: "Il parlera à la réunion.", en: "He will speak at the meeting." },
      nous: { fr: "Nous parlerons plus tard.", en: "We will talk later." },
      vous: { fr: "Vous parlerez en premier.", en: "You will speak first." },
      ils: { fr: "Ils parleront de la situation.", en: "They will talk about the situation." },
    },
  },
  'manger': {
    'Present': {
      je: { fr: "Je mange à midi.", en: "I eat at noon." },
      tu: { fr: "Tu manges sainement.", en: "You eat healthily." },
      il: { fr: "Il mange beaucoup de légumes.", en: "He eats a lot of vegetables." },
      nous: { fr: "Nous mangeons ensemble le dimanche.", en: "We eat together on Sundays." },
      vous: { fr: "Vous mangez au restaurant ?", en: "Are you eating at the restaurant?" },
      ils: { fr: "Ils mangent des pâtes ce soir.", en: "They are eating pasta tonight." },
    },
  },
  'finir': {
    'Present': {
      je: { fr: "Je finis mon travail à 18h.", en: "I finish my work at 6pm." },
      tu: { fr: "Tu finis toujours en avance.", en: "You always finish early." },
      il: { fr: "Il finit son repas.", en: "He finishes his meal." },
      nous: { fr: "Nous finissons le projet cette semaine.", en: "We finish the project this week." },
      vous: { fr: "Vous finissez à quelle heure ?", en: "What time do you finish?" },
      ils: { fr: "Ils finissent leurs études en juin.", en: "They finish their studies in June." },
    },
  },
};

const getExample = (verb: string, tense: string, pronoun: string): { fr: string; en: string } | null => {
  if (exampleSentences[verb]?.[tense]?.[pronoun]) {
    return exampleSentences[verb][tense][pronoun];
  }
  return null;
};

export const unstable_settings = {
  headerShown: false,
};

export default function TensesTableScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const [selectedTense, setSelectedTense] = useState('Present');
  const [expandedVerb, setExpandedVerb] = useState<string | null>('être');
  const [selectedConjugation, setSelectedConjugation] = useState<{ verb: string; pronoun: string } | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const currentTenseInfo = tenseInfo.find(t => t.name === selectedTense);

  const toggleVerb = (infinitive: string) => {
    setExpandedVerb(expandedVerb === infinitive ? null : infinitive);
    setSelectedConjugation(null);
  };

  const handleTenseChange = (tense: string) => {
    setSelectedTense(tense);
    setSelectedConjugation(null);
  };

  return (
    <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <Pressable onPress={() => safeGoBack()} style={styles.backButton}>
              <ArrowLeft size={24} color={Colors.primary} />
            </Pressable>
          </View>
        </SafeAreaView>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.tenseSelectorContainer}>
          <Text style={styles.sectionLabel}>Select Tense</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.tenseScroller}
          >
            {tenseInfo.map((tense) => (
              <Pressable
                key={tense.name}
                style={[
                  styles.tenseChip,
                  selectedTense === tense.name && styles.tenseChipActive,
                ]}
                onPress={() => handleTenseChange(tense.name)}
              >
                <Text
                  style={[
                    styles.tenseChipText,
                    selectedTense === tense.name && styles.tenseChipTextActive,
                  ]}
                >
                  {tense.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {currentTenseInfo && (
          <View style={styles.tenseInfoCard}>
            <View style={styles.tenseInfoHeader}>
              <Book size={20} color={Colors.primary} />
              <Text style={styles.tenseInfoTitle}>{currentTenseInfo.frenchName}</Text>
            </View>
            <Text style={styles.tenseInfoDescription}>{currentTenseInfo.description}</Text>
            <Text style={styles.tenseInfoUsage}>
              <Text style={styles.tenseInfoLabel}>Usage: </Text>
              {currentTenseInfo.usage}
            </Text>
            <View style={styles.exampleContainer}>
              <Text style={styles.exampleText}>{currentTenseInfo.example}</Text>
            </View>
            <Pressable 
              style={styles.practiceButton}
              onPress={() => router.push(`/tense-practice?tense=${selectedTense}&frenchName=${currentTenseInfo.frenchName}`)}
            >
              <Play size={18} color="#FFFFFF" />
              <Text style={styles.practiceButtonText}>Practice {selectedTense}</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.verbsTitle}>Common Verbs</Text>

        {commonVerbs.map((verb) => (
          <View key={verb.infinitive} style={styles.verbCard}>
            <Pressable
              style={styles.verbHeader}
              onPress={() => toggleVerb(verb.infinitive)}
            >
              <View style={styles.verbInfo}>
                <Text style={styles.verbInfinitive}>{verb.infinitive}</Text>
                <Text style={styles.verbMeaning}>{verb.meaning}</Text>
                <View style={styles.verbGroupBadge}>
                  <Text style={styles.verbGroupText}>{verb.group}</Text>
                </View>
              </View>
              {expandedVerb === verb.infinitive ? (
                <ChevronUp size={20} color={Colors.textSecondary} />
              ) : (
                <ChevronDown size={20} color={Colors.textSecondary} />
              )}
            </Pressable>

            {expandedVerb === verb.infinitive && (
              <View style={styles.conjugationTable}>
                {verb.tenses[selectedTense] && (
                  <>
                    {pronounKeys.map((key, index) => {
                      const isSelected = selectedConjugation?.verb === verb.infinitive && selectedConjugation?.pronoun === key;
                      const example = getExample(verb.infinitive, selectedTense, key);
                      const hasExample = example !== null;
                      
                      return (
                        <View key={key}>
                          <Pressable 
                            style={[
                              styles.conjugationRow,
                              isSelected && styles.conjugationRowSelected,
                              hasExample && styles.conjugationRowClickable,
                            ]}
                            onPress={() => {
                              if (hasExample) {
                                setSelectedConjugation(
                                  isSelected ? null : { verb: verb.infinitive, pronoun: key }
                                );
                              }
                            }}
                          >
                            <Text style={styles.pronounText}>{pronouns[index]}</Text>
                            <Text style={[
                              styles.conjugationText,
                              hasExample && styles.conjugationTextClickable,
                            ]}>
                              {verb.tenses[selectedTense][key]}
                            </Text>
                          </Pressable>
                          {isSelected && example && (
                            <View style={styles.exampleSentenceContainer}>
                              <Text style={styles.exampleFrench}>{example.fr}</Text>
                              <Text style={styles.exampleEnglish}>{example.en}</Text>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </>
                )}
              </View>
            )}
          </View>
        ))}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeArea: {
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  tenseSelectorContainer: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  tenseScroller: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  tenseChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.backgroundCard,
    marginRight: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tenseChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  tenseChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  tenseChipTextActive: {
    color: '#FFFFFF',
  },
  tenseInfoCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tenseInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  tenseInfoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  tenseInfoDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 8,
    lineHeight: 20,
  },
  tenseInfoUsage: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  tenseInfoLabel: {
    fontWeight: '600',
    color: Colors.text,
  },
  exampleContainer: {
    backgroundColor: Colors.primaryLight + '20',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  exampleText: {
    fontSize: 14,
    color: Colors.primary,
    fontStyle: 'italic',
    fontWeight: '500',
  },
  verbsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
  },
  verbCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  verbHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  verbInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  verbInfinitive: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  verbMeaning: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  verbGroupBadge: {
    backgroundColor: Colors.primaryLight + '30',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  verbGroupText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
    textTransform: 'uppercase',
  },
  conjugationTable: {
    backgroundColor: Colors.background,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  conjugationRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border + '50',
  },
  pronounText: {
    width: 100,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  conjugationText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: Colors.primary,
  },
  conjugationTextClickable: {
    textDecorationLine: 'underline',
  },
  conjugationRowSelected: {
    backgroundColor: Colors.primaryLight + '20',
  },
  conjugationRowClickable: {
    cursor: 'pointer',
  },
  exampleSentenceContainer: {
    backgroundColor: Colors.primaryLight + '15',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 8,
    marginLeft: 100,
  },
  exampleFrench: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
    fontStyle: 'italic',
    marginBottom: 4,
  },
  exampleEnglish: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  practiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginTop: 16,
  },
  practiceButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  bottomSpacer: {
    height: 40,
  },
});
