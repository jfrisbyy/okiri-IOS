//
//  ListeningData.swift
//  FluentFrenchIOS
//
//  Bundled French listening scenarios (dialogues & stories) used by the Listen
//  feature. A curated cross-section of the catalogue across levels, types and
//  themes — kept moderate in size and read directly from Swift.
//

import Foundation

nonisolated enum ListeningDifficulty: String, Codable, CaseIterable {
    case beginner, intermediate, advanced
    var label: String { rawValue.capitalized }
}

nonisolated enum ListeningType: String, Codable, CaseIterable {
    case dialogue, story
    var label: String { self == .dialogue ? "Dialogue" : "Story" }
}

nonisolated struct ListeningTurn: Codable, Hashable, Identifiable {
    var id = UUID()
    var speaker: String   // "A" | "B" | "narrator"
    var french: String
    var english: String

    private enum CodingKeys: String, CodingKey { case id, speaker, french, english }
}

nonisolated struct ListeningItem: Codable, Hashable, Identifiable {
    var id: String
    var title: String
    var titleEnglish: String
    var description: String
    var emoji: String
    var difficulty: ListeningDifficulty
    var type: ListeningType
    var durationSeconds: Int
    var category: String
    var turns: [ListeningTurn]
}

nonisolated enum ListeningData {
    static func t(_ speaker: String, _ fr: String, _ en: String) -> ListeningTurn {
        ListeningTurn(speaker: speaker, french: fr, english: en)
    }

    static let items: [ListeningItem] = [
        // MARK: Beginner dialogues
        ListeningItem(
            id: "b-cafe-01", title: "Un Café, S'il Vous Plaît", titleEnglish: "A Coffee, Please",
            description: "Ordering a simple coffee at a café", emoji: "☕",
            difficulty: .beginner, type: .dialogue, durationSeconds: 30, category: "café",
            turns: [
                t("A", "Bonjour ! Je voudrais un café, s'il vous plaît.", "Hello! I would like a coffee, please."),
                t("B", "Un café. Vous le voulez grand ou petit ?", "A coffee. Would you like it large or small?"),
                t("A", "Petit, s'il vous plaît. Et un croissant aussi.", "Small, please. And a croissant too."),
                t("B", "Très bien. Ça fait trois euros cinquante.", "Very well. That will be three euros fifty."),
                t("A", "Voilà. Merci beaucoup !", "Here you go. Thank you very much!"),
                t("B", "Merci à vous. Bonne journée !", "Thank you. Have a nice day!"),
            ]
        ),
        ListeningItem(
            id: "b-shop-01", title: "À la Boulangerie", titleEnglish: "At the Bakery",
            description: "Buying bread at a bakery", emoji: "🥖",
            difficulty: .beginner, type: .dialogue, durationSeconds: 30, category: "shopping",
            turns: [
                t("A", "Bonjour ! Je voudrais une baguette, s'il vous plaît.", "Hello! I would like a baguette, please."),
                t("B", "Bien cuite ou pas trop cuite ?", "Well-baked or not too baked?"),
                t("A", "Bien cuite, s'il vous plaît.", "Well-baked, please."),
                t("B", "Voilà. Autre chose ?", "Here you go. Anything else?"),
                t("A", "Non, c'est tout. C'est combien ?", "No, that's all. How much is it?"),
                t("B", "Un euro dix, s'il vous plaît.", "One euro ten, please."),
            ]
        ),
        ListeningItem(
            id: "b-greet-01", title: "Enchanté !", titleEnglish: "Nice to Meet You!",
            description: "Meeting someone for the first time", emoji: "👋",
            difficulty: .beginner, type: .dialogue, durationSeconds: 30, category: "social",
            turns: [
                t("A", "Bonjour, je m'appelle Marie. Et vous ?", "Hello, my name is Marie. And you?"),
                t("B", "Bonjour Marie. Moi, c'est Thomas. Enchanté !", "Hello Marie. I'm Thomas. Nice to meet you!"),
                t("A", "Enchantée ! Vous êtes français ?", "Nice to meet you! Are you French?"),
                t("B", "Oui, je suis de Paris. Et vous ?", "Yes, I'm from Paris. And you?"),
                t("A", "Je suis de Lyon. J'habite ici depuis deux ans.", "I'm from Lyon. I've lived here for two years."),
                t("B", "Ah, Lyon est une belle ville !", "Ah, Lyon is a beautiful city!"),
            ]
        ),
        ListeningItem(
            id: "b-trans-01", title: "Le Chemin", titleEnglish: "The Way",
            description: "Asking for directions on the street", emoji: "🗺️",
            difficulty: .beginner, type: .dialogue, durationSeconds: 35, category: "transport",
            turns: [
                t("A", "Excusez-moi, où est la gare ?", "Excuse me, where is the train station?"),
                t("B", "La gare ? C'est tout droit, puis à gauche.", "The train station? It's straight ahead, then turn left."),
                t("A", "C'est loin d'ici ?", "Is it far from here?"),
                t("B", "Non, c'est à cinq minutes à pied.", "No, it's five minutes on foot."),
                t("A", "D'accord, merci beaucoup !", "Okay, thank you very much!"),
                t("B", "De rien. Bonne journée !", "You're welcome. Have a nice day!"),
            ]
        ),
        ListeningItem(
            id: "b-time-02", title: "Il Fait Beau", titleEnglish: "Nice Weather",
            description: "Talking about good weather", emoji: "☀️",
            difficulty: .beginner, type: .dialogue, durationSeconds: 30, category: "daily",
            turns: [
                t("A", "Il fait beau aujourd'hui, non ?", "Nice weather today, isn't it?"),
                t("B", "Oui, le soleil brille. C'est agréable.", "Yes, the sun is shining. It's pleasant."),
                t("A", "Il fait combien de degrés ?", "How many degrees is it?"),
                t("B", "Environ vingt-cinq degrés.", "About twenty-five degrees."),
                t("A", "Parfait pour une promenade !", "Perfect for a walk!"),
                t("B", "Oui, allons au parc !", "Yes, let's go to the park!"),
            ]
        ),
        ListeningItem(
            id: "b-shop-04", title: "À la Pharmacie", titleEnglish: "At the Pharmacy",
            description: "Buying medicine at a pharmacy", emoji: "💊",
            difficulty: .beginner, type: .dialogue, durationSeconds: 35, category: "shopping",
            turns: [
                t("A", "Bonjour, j'ai mal à la tête.", "Hello, I have a headache."),
                t("B", "Je vous conseille du paracétamol.", "I recommend paracetamol."),
                t("A", "D'accord. C'est combien ?", "Okay. How much is it?"),
                t("B", "Trois euros vingt. Prenez deux comprimés avec de l'eau.", "Three euros twenty. Take two tablets with water."),
                t("A", "Merci beaucoup pour le conseil.", "Thank you very much for the advice."),
                t("B", "De rien. Bonne guérison !", "You're welcome. Get well soon!"),
            ]
        ),

        // MARK: Beginner story
        ListeningItem(
            id: "b-story-01", title: "La Journée de Léa", titleEnglish: "Léa's Day",
            description: "A simple story about a girl's morning", emoji: "🌅",
            difficulty: .beginner, type: .story, durationSeconds: 45, category: "daily",
            turns: [
                t("narrator", "Léa se réveille à sept heures du matin.", "Léa wakes up at seven in the morning."),
                t("narrator", "Elle prend son petit déjeuner : un café et une tartine.", "She has her breakfast: a coffee and a slice of bread."),
                t("narrator", "Ensuite, elle prend le bus pour aller au travail.", "Then, she takes the bus to go to work."),
                t("narrator", "À midi, elle déjeune avec ses collègues.", "At noon, she has lunch with her colleagues."),
                t("narrator", "Le soir, elle rentre à la maison et lit un livre.", "In the evening, she comes home and reads a book."),
                t("narrator", "Puis elle se couche, fatiguée mais contente.", "Then she goes to bed, tired but happy."),
            ]
        ),

        // MARK: Intermediate dialogues
        ListeningItem(
            id: "i-work-01", title: "L'Entretien", titleEnglish: "The Interview",
            description: "A short job interview exchange", emoji: "💼",
            difficulty: .intermediate, type: .dialogue, durationSeconds: 50, category: "work",
            turns: [
                t("A", "Parlez-moi un peu de votre parcours professionnel.", "Tell me a little about your professional background."),
                t("B", "J'ai travaillé cinq ans dans le marketing avant de me reconvertir.", "I worked five years in marketing before changing careers."),
                t("A", "Qu'est-ce qui vous a motivé à postuler chez nous ?", "What motivated you to apply with us?"),
                t("B", "Votre entreprise a une réputation d'innovation que j'admire beaucoup.", "Your company has a reputation for innovation that I admire a lot."),
                t("A", "Très bien. Quelles sont vos disponibilités ?", "Very good. What's your availability?"),
                t("B", "Je suis disponible dès le début du mois prochain.", "I'm available from the beginning of next month."),
            ]
        ),
        ListeningItem(
            id: "i-social-01", title: "Au Restaurant", titleEnglish: "At the Restaurant",
            description: "Discussing the menu with a friend", emoji: "🍽️",
            difficulty: .intermediate, type: .dialogue, durationSeconds: 50, category: "social",
            turns: [
                t("A", "Qu'est-ce que tu vas prendre comme entrée ?", "What are you going to have as a starter?"),
                t("B", "Je hésite entre la soupe à l'oignon et la salade de chèvre chaud.", "I'm torn between the onion soup and the warm goat cheese salad."),
                t("A", "Prends la soupe, elle est excellente ici.", "Get the soup, it's excellent here."),
                t("B", "Bonne idée. Et toi, tu as choisi ton plat ?", "Good idea. And you, have you chosen your dish?"),
                t("A", "Oui, je vais prendre le magret de canard.", "Yes, I'm going to have the duck breast."),
                t("B", "Ça donne envie ! On commande une bouteille de vin ?", "That sounds tempting! Shall we order a bottle of wine?"),
            ]
        ),
        ListeningItem(
            id: "i-travel-01", title: "À l'Hôtel", titleEnglish: "At the Hotel",
            description: "Checking in and asking about services", emoji: "🏨",
            difficulty: .intermediate, type: .dialogue, durationSeconds: 50, category: "travel",
            turns: [
                t("A", "Bonjour, j'ai une réservation au nom de Dubois.", "Hello, I have a reservation under the name Dubois."),
                t("B", "Bienvenue. Une chambre double pour trois nuits, c'est bien ça ?", "Welcome. A double room for three nights, is that right?"),
                t("A", "Exactement. Le petit déjeuner est-il inclus ?", "Exactly. Is breakfast included?"),
                t("B", "Oui, il est servi de sept à dix heures au rez-de-chaussée.", "Yes, it's served from seven to ten on the ground floor."),
                t("A", "Parfait. Y a-t-il une connexion Wi-Fi dans les chambres ?", "Perfect. Is there Wi-Fi in the rooms?"),
                t("B", "Bien sûr, le code est sur votre clé. Bon séjour !", "Of course, the code is on your key. Enjoy your stay!"),
            ]
        ),

        // MARK: Intermediate story
        ListeningItem(
            id: "i-story-01", title: "Le Marché du Dimanche", titleEnglish: "The Sunday Market",
            description: "A walk through a lively French market", emoji: "🧺",
            difficulty: .intermediate, type: .story, durationSeconds: 60, category: "culture",
            turns: [
                t("narrator", "Chaque dimanche, le marché du village s'anime dès l'aube.", "Every Sunday, the village market comes alive at dawn."),
                t("narrator", "Les marchands installent leurs étals colorés sur la place.", "The merchants set up their colorful stalls in the square."),
                t("narrator", "On y trouve des fromages, des fruits et des fleurs fraîches.", "There you find cheeses, fruits and fresh flowers."),
                t("narrator", "Les habitants discutent et goûtent les produits locaux.", "The locals chat and taste the local products."),
                t("narrator", "Une odeur de pain chaud flotte dans l'air.", "A smell of warm bread floats in the air."),
                t("narrator", "C'est un moment de partage que tout le monde attend.", "It's a moment of sharing that everyone looks forward to."),
            ]
        ),

        // MARK: Advanced
        ListeningItem(
            id: "a-debate-01", title: "Le Télétravail", titleEnglish: "Remote Work",
            description: "A nuanced discussion about working from home", emoji: "💻",
            difficulty: .advanced, type: .dialogue, durationSeconds: 70, category: "society",
            turns: [
                t("A", "Tu ne trouves pas que le télétravail brouille la frontière entre vie pro et vie perso ?", "Don't you think remote work blurs the line between work and personal life?"),
                t("B", "Si, mais ça dépend surtout de la discipline qu'on s'impose.", "Yes, but it mostly depends on the discipline you set for yourself."),
                t("A", "Certes, pourtant l'isolement peut peser sur le moral à la longue.", "Sure, yet isolation can weigh on morale in the long run."),
                t("B", "C'est pourquoi un modèle hybride me semble le plus équilibré.", "That's why a hybrid model seems the most balanced to me."),
                t("A", "Je te rejoins là-dessus, à condition que l'entreprise joue le jeu.", "I agree with you on that, provided the company plays along."),
                t("B", "Exactement. La confiance reste la clé de voûte de tout ça.", "Exactly. Trust remains the cornerstone of all this."),
            ]
        ),
        ListeningItem(
            id: "a-story-01", title: "La Lettre Oubliée", titleEnglish: "The Forgotten Letter",
            description: "An evocative short narrative", emoji: "✉️",
            difficulty: .advanced, type: .story, durationSeconds: 75, category: "literature",
            turns: [
                t("narrator", "Dans le grenier poussiéreux, Camille découvrit une lettre jaunie par le temps.", "In the dusty attic, Camille discovered a letter yellowed by time."),
                t("narrator", "L'encre, presque effacée, racontait une histoire d'amour interrompue.", "The ink, almost faded, told a story of interrupted love."),
                t("narrator", "Elle hésita, puis se laissa happer par les mots d'un inconnu.", "She hesitated, then let herself be drawn in by a stranger's words."),
                t("narrator", "Chaque phrase ravivait un monde qu'elle n'avait jamais connu.", "Each sentence revived a world she had never known."),
                t("narrator", "En refermant la lettre, elle sentit une étrange mélancolie.", "As she closed the letter, she felt a strange melancholy."),
                t("narrator", "Le passé, soudain, lui paraissait étonnamment vivant.", "The past, suddenly, seemed astonishingly alive to her."),
            ]
        ),
    ]
}
