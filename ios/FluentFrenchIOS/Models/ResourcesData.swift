//
//  ResourcesData.swift
//  FluentFrenchIOS
//
//  Bundled, offline content for the Home resource pages: French idioms,
//  pronunciation categories, and verb-tense conjugation references.
//

import SwiftUI

// MARK: - Idioms

nonisolated enum IdiomCategory: String, CaseIterable, Identifiable {
    case animals, food, body, weather, emotions, money, time, relationships, work, everyday
    var id: String { rawValue }

    var label: String {
        switch self {
        case .animals: return "Animals"
        case .food: return "Food & Drink"
        case .body: return "Body Parts"
        case .weather: return "Weather & Nature"
        case .emotions: return "Emotions & Feelings"
        case .money: return "Money & Business"
        case .time: return "Time & Age"
        case .relationships: return "Relationships"
        case .work: return "Work & Effort"
        case .everyday: return "Everyday Life"
        }
    }

    var emoji: String {
        switch self {
        case .animals: return "🐾"
        case .food: return "🍽️"
        case .body: return "🫀"
        case .weather: return "🌤️"
        case .emotions: return "💭"
        case .money: return "💰"
        case .time: return "⏰"
        case .relationships: return "👥"
        case .work: return "💼"
        case .everyday: return "🏠"
        }
    }
}

nonisolated struct FrenchIdiom: Identifiable, Hashable {
    let id: String
    let french: String
    let literal: String
    let meaning: String
    let example: String
    let exampleTranslation: String
    let category: IdiomCategory
}

nonisolated enum IdiomData {
    static func search(_ query: String, in list: [FrenchIdiom]) -> [FrenchIdiom] {
        let q = query.lowercased().trimmingCharacters(in: .whitespaces)
        guard !q.isEmpty else { return list }
        return list.filter {
            $0.french.lowercased().contains(q) ||
            $0.meaning.lowercased().contains(q) ||
            $0.literal.lowercased().contains(q)
        }
    }

    static let all: [FrenchIdiom] = animals + food + body + weather + emotions + money + time + relationships + work + everyday

    static let animals: [FrenchIdiom] = [
        .init(id: "a1", french: "Avoir le cafard", literal: "To have the cockroach", meaning: "To feel down or depressed", example: "Depuis qu'elle est partie, j'ai le cafard.", exampleTranslation: "Since she left, I've been feeling down.", category: .animals),
        .init(id: "a2", french: "Poser un lapin", literal: "To put down a rabbit", meaning: "To stand someone up", example: "Il lui a posé un lapin hier soir.", exampleTranslation: "He stood her up last night.", category: .animals),
        .init(id: "a3", french: "Avoir une faim de loup", literal: "To have a wolf's hunger", meaning: "To be extremely hungry", example: "Après la randonnée, j'avais une faim de loup.", exampleTranslation: "After the hike, I was starving.", category: .animals),
        .init(id: "a4", french: "Quand les poules auront des dents", literal: "When hens have teeth", meaning: "When pigs fly (never)", example: "Il rangera sa chambre quand les poules auront des dents.", exampleTranslation: "He'll clean his room when pigs fly.", category: .animals),
        .init(id: "a5", french: "Être comme un poisson dans l'eau", literal: "To be like a fish in water", meaning: "To feel completely at ease", example: "Sur scène, elle est comme un poisson dans l'eau.", exampleTranslation: "On stage, she's in her element.", category: .animals),
        .init(id: "a6", french: "Avoir d'autres chats à fouetter", literal: "To have other cats to whip", meaning: "To have other fish to fry", example: "Je n'ai pas le temps, j'ai d'autres chats à fouetter.", exampleTranslation: "I don't have time, I have bigger fish to fry.", category: .animals),
        .init(id: "a7", french: "Donner sa langue au chat", literal: "To give your tongue to the cat", meaning: "To give up guessing", example: "Je ne sais pas, je donne ma langue au chat.", exampleTranslation: "I don't know, I give up.", category: .animals),
        .init(id: "a8", french: "Il pleut des cordes", literal: "It's raining ropes", meaning: "It's raining cats and dogs", example: "Prends ton parapluie, il pleut des cordes.", exampleTranslation: "Take your umbrella, it's pouring.", category: .animals),
        .init(id: "a9", french: "Être une poule mouillée", literal: "To be a wet hen", meaning: "To be a coward", example: "Ne sois pas une poule mouillée, saute !", exampleTranslation: "Don't be a chicken, jump!", category: .animals),
        .init(id: "a10", french: "Avoir une mémoire d'éléphant", literal: "To have an elephant's memory", meaning: "To have an excellent memory", example: "Ma grand-mère a une mémoire d'éléphant.", exampleTranslation: "My grandmother has an excellent memory.", category: .animals),
        .init(id: "a11", french: "Être têtu comme une mule", literal: "To be stubborn like a mule", meaning: "To be very stubborn", example: "Il est têtu comme une mule.", exampleTranslation: "He's as stubborn as a mule.", category: .animals),
        .init(id: "a12", french: "Chercher la petite bête", literal: "To look for the little beast", meaning: "To nitpick / find fault", example: "Arrête de chercher la petite bête.", exampleTranslation: "Stop nitpicking.", category: .animals),
        .init(id: "a13", french: "Avoir des fourmis dans les jambes", literal: "To have ants in your legs", meaning: "To have pins and needles", example: "J'ai des fourmis dans les jambes.", exampleTranslation: "My legs are falling asleep.", category: .animals),
        .init(id: "a14", french: "Appeler un chat un chat", literal: "To call a cat a cat", meaning: "To call a spade a spade", example: "J'appelle un chat un chat : c'est un échec.", exampleTranslation: "I'll be frank: it's a failure.", category: .animals),
        .init(id: "a15", french: "Avoir le bourdon", literal: "To have the bumblebee", meaning: "To feel sad or melancholic", example: "Elle a le bourdon depuis qu'il est parti.", exampleTranslation: "She's been feeling blue since he left.", category: .animals),
        .init(id: "a16", french: "Être rusé comme un renard", literal: "To be cunning like a fox", meaning: "To be very clever/cunning", example: "Méfie-toi de lui, il est rusé comme un renard.", exampleTranslation: "Be wary of him, he's as cunning as a fox.", category: .animals),
        .init(id: "a17", french: "Sauter du coq à l'âne", literal: "To jump from the rooster to the donkey", meaning: "To jump from one topic to another", example: "Elle saute toujours du coq à l'âne.", exampleTranslation: "She always jumps from one topic to another.", category: .animals),
        .init(id: "a18", french: "Avoir un chat dans la gorge", literal: "To have a cat in the throat", meaning: "To have a frog in your throat", example: "Excuse-moi, j'ai un chat dans la gorge.", exampleTranslation: "Excuse me, I have a frog in my throat.", category: .animals),
        .init(id: "a19", french: "Prendre le taureau par les cornes", literal: "To take the bull by the horns", meaning: "To tackle a problem head-on", example: "Il faut prendre le taureau par les cornes.", exampleTranslation: "We need to take the bull by the horns.", category: .animals),
        .init(id: "a20", french: "Avoir le cœur sur la main", literal: "To have the heart on the hand", meaning: "To be very generous", example: "Elle a le cœur sur la main, elle aide tout le monde.", exampleTranslation: "She's very generous, she helps everyone.", category: .animals),
    ]

    static let food: [FrenchIdiom] = [
        .init(id: "f1", french: "Raconter des salades", literal: "To tell salads", meaning: "To tell lies or tall tales", example: "Arrête de raconter des salades !", exampleTranslation: "Stop telling tall tales!", category: .food),
        .init(id: "f2", french: "Mettre du beurre dans les épinards", literal: "To put butter in the spinach", meaning: "To earn extra money", example: "Ce petit travail met du beurre dans les épinards.", exampleTranslation: "This side job helps make ends meet.", category: .food),
        .init(id: "f3", french: "Tomber dans les pommes", literal: "To fall in the apples", meaning: "To faint", example: "Il faisait si chaud qu'elle est tombée dans les pommes.", exampleTranslation: "It was so hot that she fainted.", category: .food),
        .init(id: "f4", french: "Avoir la pêche", literal: "To have the peach", meaning: "To be full of energy", example: "Ce matin, j'ai vraiment la pêche !", exampleTranslation: "I'm feeling great this morning!", category: .food),
        .init(id: "f5", french: "Avoir la banane", literal: "To have the banana", meaning: "To have a big smile", example: "Regarde-le, il a la banane.", exampleTranslation: "Look at him, he's grinning.", category: .food),
        .init(id: "f6", french: "Avoir du pain sur la planche", literal: "To have bread on the board", meaning: "To have a lot of work to do", example: "On a du pain sur la planche.", exampleTranslation: "We have our work cut out for us.", category: .food),
        .init(id: "f7", french: "Mettre son grain de sel", literal: "To put your grain of salt", meaning: "To give unsolicited advice", example: "Il met toujours son grain de sel.", exampleTranslation: "He always butts in with his opinion.", category: .food),
        .init(id: "f8", french: "Couper la poire en deux", literal: "To cut the pear in half", meaning: "To meet halfway / compromise", example: "On peut couper la poire en deux.", exampleTranslation: "We can meet halfway.", category: .food),
        .init(id: "f9", french: "En faire tout un fromage", literal: "To make a whole cheese out of it", meaning: "To make a big deal out of nothing", example: "N'en fais pas tout un fromage.", exampleTranslation: "Don't make a mountain out of a molehill.", category: .food),
        .init(id: "f10", french: "Être soupe au lait", literal: "To be milk soup", meaning: "To be quick-tempered", example: "Fais attention, elle est très soupe au lait.", exampleTranslation: "Be careful, she has a short temper.", category: .food),
        .init(id: "f11", french: "C'est pas de la tarte", literal: "It's not pie", meaning: "It's not easy", example: "Apprendre le français, c'est pas de la tarte.", exampleTranslation: "Learning French is no piece of cake.", category: .food),
        .init(id: "f12", french: "Les carottes sont cuites", literal: "The carrots are cooked", meaning: "It's all over", example: "On a perdu, les carottes sont cuites.", exampleTranslation: "We lost, it's all over.", category: .food),
        .init(id: "f13", french: "Rouler quelqu'un dans la farine", literal: "To roll someone in flour", meaning: "To trick or deceive someone", example: "Ce vendeur nous a roulés dans la farine.", exampleTranslation: "That seller tricked us.", category: .food),
        .init(id: "f14", french: "Avoir un cœur d'artichaut", literal: "To have an artichoke heart", meaning: "To fall in love easily", example: "Elle a un cœur d'artichaut.", exampleTranslation: "She falls in love at the drop of a hat.", category: .food),
        .init(id: "f15", french: "Mettre de l'eau dans son vin", literal: "To put water in your wine", meaning: "To compromise / moderate", example: "Il devra mettre de l'eau dans son vin.", exampleTranslation: "He'll have to compromise.", category: .food),
        .init(id: "f16", french: "Se mettre en quatre", literal: "To put oneself in four", meaning: "To bend over backwards", example: "Elle se met en quatre pour ses invités.", exampleTranslation: "She bends over backwards for her guests.", category: .food),
    ]

    static let body: [FrenchIdiom] = [
        .init(id: "b1", french: "Coûter les yeux de la tête", literal: "To cost the eyes of the head", meaning: "To cost an arm and a leg", example: "Cette voiture m'a coûté les yeux de la tête.", exampleTranslation: "This car cost me an arm and a leg.", category: .body),
        .init(id: "b2", french: "Avoir la tête dans les nuages", literal: "To have the head in the clouds", meaning: "To be a daydreamer", example: "Il a toujours la tête dans les nuages.", exampleTranslation: "He's always got his head in the clouds.", category: .body),
        .init(id: "b3", french: "Mettre les pieds dans le plat", literal: "To put your feet in the dish", meaning: "To put your foot in your mouth", example: "Il a mis les pieds dans le plat.", exampleTranslation: "He put his foot in it.", category: .body),
        .init(id: "b4", french: "Se creuser la tête", literal: "To dig one's head", meaning: "To rack your brains", example: "Je me creuse la tête mais je ne trouve pas.", exampleTranslation: "I'm racking my brains but can't find it.", category: .body),
        .init(id: "b5", french: "Casser les pieds", literal: "To break the feet", meaning: "To annoy someone", example: "Arrête de me casser les pieds !", exampleTranslation: "Stop bugging me!", category: .body),
        .init(id: "b6", french: "Avoir le bras long", literal: "To have the long arm", meaning: "To have connections / influence", example: "Il a le bras long, il connaît tout le monde.", exampleTranslation: "He has connections everywhere.", category: .body),
        .init(id: "b7", french: "Prendre ses jambes à son cou", literal: "To take your legs to your neck", meaning: "To run away very fast", example: "Il a pris ses jambes à son cou.", exampleTranslation: "He ran for his life.", category: .body),
        .init(id: "b8", french: "Avoir la main verte", literal: "To have the green hand", meaning: "To have a green thumb", example: "Ma mère a la main verte.", exampleTranslation: "My mother has a green thumb.", category: .body),
        .init(id: "b9", french: "Faire la sourde oreille", literal: "To make the deaf ear", meaning: "To turn a deaf ear", example: "Il fait la sourde oreille à mes conseils.", exampleTranslation: "He turns a deaf ear to my advice.", category: .body),
        .init(id: "b10", french: "Avoir un poil dans la main", literal: "To have a hair in the hand", meaning: "To be lazy", example: "Il a un poil dans la main.", exampleTranslation: "He's lazy, he never does anything.", category: .body),
        .init(id: "b11", french: "Garder la tête froide", literal: "To keep the head cold", meaning: "To keep a cool head", example: "Il faut garder la tête froide.", exampleTranslation: "We need to keep a cool head.", category: .body),
        .init(id: "b12", french: "Ne pas avoir la langue dans sa poche", literal: "To not have the tongue in one's pocket", meaning: "To be outspoken", example: "Elle n'a pas la langue dans sa poche.", exampleTranslation: "She speaks her mind.", category: .body),
        .init(id: "b13", french: "Avoir l'estomac dans les talons", literal: "To have the stomach in the heels", meaning: "To be starving", example: "J'ai l'estomac dans les talons !", exampleTranslation: "I'm starving!", category: .body),
        .init(id: "b14", french: "Avoir le cœur gros", literal: "To have a big heart", meaning: "To be sad / heavy-hearted", example: "J'ai le cœur gros de partir.", exampleTranslation: "I'm sad to leave.", category: .body),
        .init(id: "b15", french: "Faire les gros yeux", literal: "To make big eyes", meaning: "To give a stern look", example: "La mère a fait les gros yeux à son fils.", exampleTranslation: "The mother gave her son a stern look.", category: .body),
        .init(id: "b16", french: "Avoir les yeux plus gros que le ventre", literal: "To have eyes bigger than the belly", meaning: "To bite off more than you can chew", example: "J'ai eu les yeux plus gros que le ventre.", exampleTranslation: "I bit off more than I could chew.", category: .body),
    ]

    static let weather: [FrenchIdiom] = [
        .init(id: "w1", french: "Être dans le brouillard", literal: "To be in the fog", meaning: "To be confused or lost", example: "Je suis dans le brouillard.", exampleTranslation: "I'm completely lost.", category: .weather),
        .init(id: "w2", french: "Après la pluie, le beau temps", literal: "After the rain, nice weather", meaning: "Every cloud has a silver lining", example: "Ne t'inquiète pas, après la pluie, le beau temps.", exampleTranslation: "Don't worry, things will get better.", category: .weather),
        .init(id: "w3", french: "Faire un froid de canard", literal: "To make a duck cold", meaning: "To be freezing cold", example: "Il fait un froid de canard.", exampleTranslation: "It's freezing outside.", category: .weather),
        .init(id: "w4", french: "Être au septième ciel", literal: "To be in the seventh sky", meaning: "To be on cloud nine", example: "Elle est au septième ciel.", exampleTranslation: "She's on cloud nine.", category: .weather),
        .init(id: "w5", french: "Remuer ciel et terre", literal: "To move sky and earth", meaning: "To move heaven and earth", example: "Il a remué ciel et terre pour la retrouver.", exampleTranslation: "He moved heaven and earth to find her.", category: .weather),
        .init(id: "w6", french: "Être au bout du tunnel", literal: "To be at the end of the tunnel", meaning: "To see light at the end of the tunnel", example: "On est au bout du tunnel.", exampleTranslation: "We're at the end of the tunnel.", category: .weather),
        .init(id: "w7", french: "Faire la pluie et le beau temps", literal: "To make the rain and nice weather", meaning: "To call the shots", example: "C'est lui qui fait la pluie et le beau temps.", exampleTranslation: "He's the one who calls the shots.", category: .weather),
        .init(id: "w8", french: "Avoir le vent en poupe", literal: "To have wind in the stern", meaning: "To be on a roll", example: "Son entreprise a le vent en poupe.", exampleTranslation: "His business is doing great.", category: .weather),
        .init(id: "w9", french: "Faire boule de neige", literal: "To make a snowball", meaning: "To snowball / escalate", example: "Le problème a fait boule de neige.", exampleTranslation: "The problem snowballed.", category: .weather),
        .init(id: "w10", french: "Tomber des nues", literal: "To fall from the clouds", meaning: "To be completely surprised", example: "Je suis tombé des nues.", exampleTranslation: "I was floored.", category: .weather),
        .init(id: "w11", french: "Être dans la lune", literal: "To be in the moon", meaning: "To be daydreaming", example: "Réveille-toi, tu es dans la lune !", exampleTranslation: "Wake up, you're daydreaming!", category: .weather),
        .init(id: "w12", french: "Promettre la lune", literal: "To promise the moon", meaning: "To promise the impossible", example: "Les politiciens promettent toujours la lune.", exampleTranslation: "Politicians always promise the moon.", category: .weather),
    ]

    static let emotions: [FrenchIdiom] = [
        .init(id: "e1", french: "Être aux anges", literal: "To be with the angels", meaning: "To be overjoyed", example: "Elle était aux anges.", exampleTranslation: "She was over the moon.", category: .emotions),
        .init(id: "e2", french: "Avoir le moral dans les chaussettes", literal: "To have morale in the socks", meaning: "To feel very down", example: "J'ai le moral dans les chaussettes.", exampleTranslation: "I'm feeling really low.", category: .emotions),
        .init(id: "e3", french: "En avoir ras le bol", literal: "To have it up to the bowl", meaning: "To be fed up", example: "J'en ai ras le bol de ce travail !", exampleTranslation: "I'm fed up with this job!", category: .emotions),
        .init(id: "e4", french: "Broyer du noir", literal: "To grind black", meaning: "To be depressed", example: "Depuis sa rupture, il broie du noir.", exampleTranslation: "Since his breakup, he's been in a dark place.", category: .emotions),
        .init(id: "e5", french: "Voir la vie en rose", literal: "To see life in pink", meaning: "To see through rose-tinted glasses", example: "Elle voit toujours la vie en rose.", exampleTranslation: "She always looks on the bright side.", category: .emotions),
        .init(id: "e6", french: "Péter les plombs", literal: "To blow the fuses", meaning: "To lose it / go crazy", example: "Il a pété les plombs.", exampleTranslation: "He lost it.", category: .emotions),
        .init(id: "e7", french: "Avoir le cœur brisé", literal: "To have a broken heart", meaning: "To be heartbroken", example: "Elle a le cœur brisé.", exampleTranslation: "She's heartbroken.", category: .emotions),
        .init(id: "e8", french: "Rire jaune", literal: "To laugh yellow", meaning: "To give a forced laugh", example: "Il a ri jaune.", exampleTranslation: "He gave a forced laugh.", category: .emotions),
        .init(id: "e9", french: "Être vert de jalousie", literal: "To be green with jealousy", meaning: "To be green with envy", example: "Elle était verte de jalousie.", exampleTranslation: "She was green with envy.", category: .emotions),
        .init(id: "e10", french: "Avoir le sang qui bout", literal: "To have blood that boils", meaning: "To be furious", example: "J'avais le sang qui bouillait.", exampleTranslation: "My blood was boiling.", category: .emotions),
        .init(id: "e11", french: "Avoir la peur au ventre", literal: "To have fear in the belly", meaning: "To be scared stiff", example: "J'avais la peur au ventre avant mon discours.", exampleTranslation: "I was terrified before my speech.", category: .emotions),
        .init(id: "e12", french: "Être fou de joie", literal: "To be crazy with joy", meaning: "To be overjoyed", example: "Elle était folle de joie.", exampleTranslation: "She was overjoyed.", category: .emotions),
    ]

    static let money: [FrenchIdiom] = [
        .init(id: "m1", french: "Coûter bonbon", literal: "To cost candy", meaning: "To cost a lot of money", example: "Ces vacances nous ont coûté bonbon.", exampleTranslation: "This vacation cost us a fortune.", category: .money),
        .init(id: "m2", french: "Être sans le sou", literal: "To be without the penny", meaning: "To be broke", example: "À la fin du mois, je suis sans le sou.", exampleTranslation: "I'm broke at the end of the month.", category: .money),
        .init(id: "m3", french: "Rouler sur l'or", literal: "To roll on gold", meaning: "To be rolling in money", example: "Il roule sur l'or.", exampleTranslation: "He's rolling in money.", category: .money),
        .init(id: "m4", french: "Jeter l'argent par les fenêtres", literal: "To throw money out the windows", meaning: "To waste money", example: "Arrête de jeter l'argent par les fenêtres !", exampleTranslation: "Stop throwing your money away!", category: .money),
        .init(id: "m5", french: "Payer les pots cassés", literal: "To pay the broken pots", meaning: "To take the blame", example: "C'est toujours moi qui paie les pots cassés.", exampleTranslation: "I'm always left to pick up the pieces.", category: .money),
        .init(id: "m6", french: "Tirer le diable par la queue", literal: "To pull the devil by the tail", meaning: "To struggle to make ends meet", example: "Ils tirent le diable par la queue.", exampleTranslation: "They struggle to make ends meet.", category: .money),
        .init(id: "m7", french: "Mettre la main à la pâte", literal: "To put the hand in the dough", meaning: "To pitch in", example: "Tout le monde doit mettre la main à la pâte.", exampleTranslation: "Everyone needs to pitch in.", category: .money),
        .init(id: "m8", french: "Avoir carte blanche", literal: "To have a white card", meaning: "To have free rein", example: "Il lui a donné carte blanche.", exampleTranslation: "He gave her free rein.", category: .money),
        .init(id: "m9", french: "Être dans le rouge", literal: "To be in the red", meaning: "To be in debt", example: "Mon compte est dans le rouge.", exampleTranslation: "My account is in the red.", category: .money),
        .init(id: "m10", french: "Serrer la ceinture", literal: "To tighten the belt", meaning: "To cut expenses", example: "Ce mois-ci, il faut serrer la ceinture.", exampleTranslation: "This month, we need to tighten our belts.", category: .money),
        .init(id: "m11", french: "Avoir l'embarras du choix", literal: "To have the embarrassment of choice", meaning: "To be spoiled for choice", example: "On a l'embarras du choix.", exampleTranslation: "We're spoiled for choice.", category: .money),
        .init(id: "m12", french: "Faire des affaires en or", literal: "To do golden business", meaning: "To do great business", example: "Ce magasin fait des affaires en or.", exampleTranslation: "This store does amazing business.", category: .money),
    ]

    static let time: [FrenchIdiom] = [
        .init(id: "t1", french: "Il y a belle lurette", literal: "There is beautiful lurette", meaning: "A long time ago", example: "Il y a belle lurette que je ne l'ai pas vu.", exampleTranslation: "I haven't seen him in ages.", category: .time),
        .init(id: "t2", french: "En un clin d'œil", literal: "In a blink of an eye", meaning: "In the blink of an eye", example: "Le temps est passé en un clin d'œil.", exampleTranslation: "Time passed in the blink of an eye.", category: .time),
        .init(id: "t3", french: "Tuer le temps", literal: "To kill time", meaning: "To kill time", example: "Je joue pour tuer le temps.", exampleTranslation: "I play to kill time.", category: .time),
        .init(id: "t4", french: "Prendre son temps", literal: "To take one's time", meaning: "To take your time", example: "Prends ton temps.", exampleTranslation: "Take your time.", category: .time),
        .init(id: "t5", french: "Être dans la fleur de l'âge", literal: "To be in the flower of age", meaning: "To be in the prime of life", example: "Elle est dans la fleur de l'âge.", exampleTranslation: "She's in the prime of her life.", category: .time),
        .init(id: "t6", french: "Avoir de la bouteille", literal: "To have bottle", meaning: "To be seasoned / experienced", example: "Ce manager a de la bouteille.", exampleTranslation: "This manager is experienced.", category: .time),
        .init(id: "t7", french: "Remettre aux calendes grecques", literal: "To postpone to the Greek calends", meaning: "To postpone indefinitely", example: "Le projet a été remis aux calendes grecques.", exampleTranslation: "The project was postponed indefinitely.", category: .time),
        .init(id: "t8", french: "Mieux vaut tard que jamais", literal: "Better late than never", meaning: "Better late than never", example: "Il s'est excusé. Mieux vaut tard que jamais !", exampleTranslation: "He apologized. Better late than never!", category: .time),
        .init(id: "t9", french: "Être vieux jeu", literal: "To be old game", meaning: "To be old-fashioned", example: "Ses idées sont un peu vieux jeu.", exampleTranslation: "His ideas are a bit old-fashioned.", category: .time),
        .init(id: "t10", french: "Au fil du temps", literal: "Along the thread of time", meaning: "Over time", example: "Au fil du temps, j'ai appris à l'apprécier.", exampleTranslation: "Over time, I learned to appreciate him.", category: .time),
    ]

    static let relationships: [FrenchIdiom] = [
        .init(id: "r1", french: "Avoir un coup de foudre", literal: "To have a lightning strike", meaning: "To fall in love at first sight", example: "Quand je l'ai vue, j'ai eu le coup de foudre.", exampleTranslation: "When I saw her, it was love at first sight.", category: .relationships),
        .init(id: "r2", french: "Être le mouton noir", literal: "To be the black sheep", meaning: "To be the black sheep", example: "Il est le mouton noir de la famille.", exampleTranslation: "He's the black sheep of the family.", category: .relationships),
        .init(id: "r3", french: "Se mettre sur son trente-et-un", literal: "To put oneself on one's thirty-one", meaning: "To dress to the nines", example: "Elle s'est mise sur son trente-et-un.", exampleTranslation: "She dressed to the nines.", category: .relationships),
        .init(id: "r4", french: "Être comme cul et chemise", literal: "To be like butt and shirt", meaning: "To be thick as thieves", example: "Ces deux-là sont comme cul et chemise.", exampleTranslation: "Those two are thick as thieves.", category: .relationships),
        .init(id: "r5", french: "Faire les quatre cents coups", literal: "To do the four hundred blows", meaning: "To raise hell / be wild", example: "Il a fait les quatre cents coups.", exampleTranslation: "He raised hell.", category: .relationships),
        .init(id: "r6", french: "S'entendre comme chien et chat", literal: "To get along like dog and cat", meaning: "To fight like cats and dogs", example: "Mes frères s'entendent comme chien et chat.", exampleTranslation: "My brothers fight like cats and dogs.", category: .relationships),
        .init(id: "r7", french: "Connaître quelqu'un comme sa poche", literal: "To know someone like your pocket", meaning: "To know someone inside out", example: "Je le connais comme ma poche.", exampleTranslation: "I know him inside out.", category: .relationships),
        .init(id: "r8", french: "Tourner autour du pot", literal: "To turn around the pot", meaning: "To beat around the bush", example: "Arrête de tourner autour du pot.", exampleTranslation: "Stop beating around the bush.", category: .relationships),
        .init(id: "r9", french: "Prendre quelqu'un sous son aile", literal: "To take someone under one's wing", meaning: "To take someone under your wing", example: "Le mentor l'a pris sous son aile.", exampleTranslation: "The mentor took him under his wing.", category: .relationships),
        .init(id: "r10", french: "Tomber dans les bras de Morphée", literal: "To fall into the arms of Morpheus", meaning: "To fall asleep", example: "Je suis tombé dans les bras de Morphée.", exampleTranslation: "I fell fast asleep.", category: .relationships),
    ]

    static let work: [FrenchIdiom] = [
        .init(id: "wo1", french: "Mettre les bouchées doubles", literal: "To put double mouthfuls", meaning: "To work twice as hard", example: "Il faut mettre les bouchées doubles.", exampleTranslation: "We need to work twice as hard.", category: .work),
        .init(id: "wo2", french: "Se retrousser les manches", literal: "To roll up one's sleeves", meaning: "To get to work", example: "On se retrousse les manches et on y va.", exampleTranslation: "Let's roll up our sleeves and get to it.", category: .work),
        .init(id: "wo3", french: "Brûler la chandelle par les deux bouts", literal: "To burn the candle at both ends", meaning: "To burn the candle at both ends", example: "Il brûle la chandelle par les deux bouts.", exampleTranslation: "He's burning the candle at both ends.", category: .work),
        .init(id: "wo4", french: "Faire d'une pierre deux coups", literal: "To make two hits with one stone", meaning: "To kill two birds with one stone", example: "Je fais d'une pierre deux coups.", exampleTranslation: "Two birds with one stone.", category: .work),
        .init(id: "wo5", french: "Être débordé", literal: "To be overflowing", meaning: "To be swamped with work", example: "Je suis débordé en ce moment.", exampleTranslation: "I'm swamped right now.", category: .work),
        .init(id: "wo6", french: "Aller droit au but", literal: "To go straight to the goal", meaning: "To get straight to the point", example: "Je vais aller droit au but.", exampleTranslation: "I'll get straight to the point.", category: .work),
        .init(id: "wo7", french: "Repartir de zéro", literal: "To start again from zero", meaning: "To start from scratch", example: "Il faut repartir de zéro.", exampleTranslation: "We have to start from scratch.", category: .work),
        .init(id: "wo8", french: "Être sur la bonne voie", literal: "To be on the good path", meaning: "To be on the right track", example: "Tu es sur la bonne voie.", exampleTranslation: "You're on the right track.", category: .work),
        .init(id: "wo9", french: "Jeter l'éponge", literal: "To throw the sponge", meaning: "To throw in the towel", example: "Il a jeté l'éponge.", exampleTranslation: "He threw in the towel.", category: .work),
        .init(id: "wo10", french: "Faire ses preuves", literal: "To make one's proofs", meaning: "To prove oneself", example: "Elle a fait ses preuves rapidement.", exampleTranslation: "She proved herself quickly.", category: .work),
        .init(id: "wo11", french: "Être au four et au moulin", literal: "To be at the oven and at the mill", meaning: "To juggle many tasks at once", example: "Je ne peux pas être au four et au moulin !", exampleTranslation: "I can't be in two places at once!", category: .work),
    ]

    static let everyday: [FrenchIdiom] = [
        .init(id: "ev1", french: "C'est la goutte d'eau qui fait déborder le vase", literal: "The drop that makes the vase overflow", meaning: "The straw that broke the camel's back", example: "C'était la goutte d'eau qui fait déborder le vase.", exampleTranslation: "It was the last straw.", category: .everyday),
        .init(id: "ev2", french: "Être à côté de la plaque", literal: "To be beside the plate", meaning: "To be off the mark / clueless", example: "Sa réponse était à côté de la plaque.", exampleTranslation: "His answer was off the mark.", category: .everyday),
        .init(id: "ev3", french: "Tourner en rond", literal: "To turn in circles", meaning: "To go around in circles", example: "Cette réunion tourne en rond.", exampleTranslation: "This meeting is going in circles.", category: .everyday),
        .init(id: "ev4", french: "Être au bout du rouleau", literal: "To be at the end of the roll", meaning: "To be at the end of your rope", example: "Je suis au bout du rouleau.", exampleTranslation: "I'm at the end of my rope.", category: .everyday),
        .init(id: "ev5", french: "Dormir comme un loir", literal: "To sleep like a dormouse", meaning: "To sleep like a log", example: "J'ai dormi comme un loir.", exampleTranslation: "I slept like a log.", category: .everyday),
        .init(id: "ev6", french: "Faire la grasse matinée", literal: "To make the fat morning", meaning: "To sleep in", example: "J'adore faire la grasse matinée.", exampleTranslation: "I love sleeping in.", category: .everyday),
        .init(id: "ev7", french: "Être sur les rotules", literal: "To be on the kneecaps", meaning: "To be exhausted", example: "J'étais sur les rotules.", exampleTranslation: "I was exhausted.", category: .everyday),
        .init(id: "ev8", french: "Avoir le mal du pays", literal: "To have the sickness of the country", meaning: "To be homesick", example: "J'ai le mal du pays.", exampleTranslation: "I feel homesick.", category: .everyday),
        .init(id: "ev9", french: "Ne pas être dans son assiette", literal: "To not be in one's plate", meaning: "To feel under the weather", example: "Je ne suis pas dans mon assiette.", exampleTranslation: "I'm feeling under the weather.", category: .everyday),
        .init(id: "ev10", french: "Tomber à pic", literal: "To fall at peak", meaning: "To come at the right time", example: "Tu tombes à pic !", exampleTranslation: "You came at just the right time!", category: .everyday),
        .init(id: "ev11", french: "Mettre la charrue avant les bœufs", literal: "To put the cart before the oxen", meaning: "To put the cart before the horse", example: "Ne mets pas la charrue avant les bœufs.", exampleTranslation: "Don't put the cart before the horse.", category: .everyday),
        .init(id: "ev12", french: "Marcher sur des œufs", literal: "To walk on eggs", meaning: "To walk on eggshells", example: "Il faut toujours marcher sur des œufs.", exampleTranslation: "You always have to walk on eggshells.", category: .everyday),
    ]
}

// MARK: - Pronunciation

nonisolated struct PronunciationWord: Identifiable, Hashable {
    let id: String
    let word: String
    let ipa: String
    let translation: String
    let audioHint: String
}

nonisolated struct PronunciationCategory: Identifiable, Hashable {
    let id: String
    let name: String
    let detail: String
    let emoji: String
    let colorHex: String
    let difficulty: String
    let tips: [String]
    let words: [PronunciationWord]

    var color: Color { Color(hex: colorHex) }
}

nonisolated enum PronunciationData {
    static let categories: [PronunciationCategory] = [
        .init(id: "nasal-vowels", name: "Nasal Vowels", detail: "Master the unique French nasal sounds", emoji: "👃", colorHex: "8B5CF6", difficulty: "Intermediate",
              tips: ["Let air flow through your nose while making the sound", "Don't pronounce the final \"n\" or \"m\" — they just nasalize the vowel", "Practice humming while making the vowel sound"],
              words: [
                .init(id: "n1", word: "bon", ipa: "/bɔ̃/", translation: "good", audioHint: "The \"on\" is nasal — no \"n\" sound at end"),
                .init(id: "n2", word: "vin", ipa: "/vɛ̃/", translation: "wine", audioHint: "The \"in\" is nasal like \"van\" but through nose"),
                .init(id: "n3", word: "blanc", ipa: "/blɑ̃/", translation: "white", audioHint: "The \"an\" is a deep nasal \"ah\""),
                .init(id: "n4", word: "un", ipa: "/œ̃/", translation: "one/a", audioHint: "Round your lips like \"uh\" but nasal"),
                .init(id: "n5", word: "jambon", ipa: "/ʒɑ̃.bɔ̃/", translation: "ham", audioHint: "Two nasal vowels: \"an\" then \"on\""),
                .init(id: "n6", word: "enfant", ipa: "/ɑ̃.fɑ̃/", translation: "child", audioHint: "Same nasal \"an\" sound twice"),
                .init(id: "n7", word: "pain", ipa: "/pɛ̃/", translation: "bread", audioHint: "The \"ain\" sounds like nasal \"an\""),
                .init(id: "n8", word: "important", ipa: "/ɛ̃.pɔʁ.tɑ̃/", translation: "important", audioHint: "Starts with nasal \"in\", ends with nasal \"an\""),
              ]),
        .init(id: "french-r", name: "French R", detail: "The guttural R sound from the throat", emoji: "🗣️", colorHex: "EC4899", difficulty: "Advanced",
              tips: ["The sound comes from the back of your throat, not the front", "It's like a gentle gargling sound", "Practice saying \"h\" from deep in your throat"],
              words: [
                .init(id: "r1", word: "rue", ipa: "/ʁy/", translation: "street", audioHint: "Start with throat R, then round lips for \"u\""),
                .init(id: "r2", word: "rouge", ipa: "/ʁuʒ/", translation: "red", audioHint: "Throat R then \"oozh\""),
                .init(id: "r3", word: "Paris", ipa: "/pa.ʁi/", translation: "Paris", audioHint: "The R is between the vowels"),
                .init(id: "r4", word: "merci", ipa: "/mɛʁ.si/", translation: "thank you", audioHint: "R comes after \"meh\""),
                .init(id: "r5", word: "très", ipa: "/tʁɛ/", translation: "very", audioHint: "TR blend — tongue stays down"),
                .init(id: "r6", word: "grand", ipa: "/ɡʁɑ̃/", translation: "big/tall", audioHint: "GR blend with nasal ending"),
                .init(id: "r7", word: "restaurant", ipa: "/ʁɛs.to.ʁɑ̃/", translation: "restaurant", audioHint: "R at start and in middle"),
                .init(id: "r8", word: "partir", ipa: "/paʁ.tiʁ/", translation: "to leave", audioHint: "R in middle and at end"),
              ]),
        .init(id: "u-ou", name: "U vs OU", detail: "Distinguish the tight \"u\" from the round \"ou\"", emoji: "👄", colorHex: "06B6D4", difficulty: "Intermediate",
              tips: ["For \"u\" (/y/): say \"ee\" but round your lips tightly", "For \"ou\" (/u/): like English \"oo\" in \"food\"", "The French \"u\" doesn't exist in English — it's unique!"],
              words: [
                .init(id: "u1", word: "tu", ipa: "/ty/", translation: "you", audioHint: "Tight lips, tongue high — NOT \"too\""),
                .init(id: "u2", word: "tout", ipa: "/tu/", translation: "all/everything", audioHint: "Like English \"too\""),
                .init(id: "u3", word: "rue", ipa: "/ʁy/", translation: "street", audioHint: "Tight French \"u\" after R"),
                .init(id: "u4", word: "roue", ipa: "/ʁu/", translation: "wheel", audioHint: "Round \"oo\" after R"),
                .init(id: "u5", word: "vu", ipa: "/vy/", translation: "seen", audioHint: "Tight \"u\" sound"),
                .init(id: "u6", word: "vous", ipa: "/vu/", translation: "you (formal)", audioHint: "Round \"oo\" like \"voo\""),
                .init(id: "u7", word: "sur", ipa: "/syʁ/", translation: "on/over", audioHint: "Starts with tight \"u\""),
                .init(id: "u8", word: "plus", ipa: "/ply/", translation: "more", audioHint: "End with tight French \"u\""),
              ]),
        .init(id: "silent-letters", name: "Silent Letters", detail: "Know when NOT to pronounce letters", emoji: "🤫", colorHex: "F59E0B", difficulty: "Beginner",
              tips: ["Most final consonants are silent (except C, R, F, L — \"CaReFuL\")", "The final \"e\" is usually silent", "H is always silent in French"],
              words: [
                .init(id: "s1", word: "petit", ipa: "/pə.ti/", translation: "small", audioHint: "The final \"t\" is silent"),
                .init(id: "s2", word: "beaucoup", ipa: "/bo.ku/", translation: "a lot", audioHint: "The \"p\" is silent"),
                .init(id: "s3", word: "temps", ipa: "/tɑ̃/", translation: "time", audioHint: "Both \"p\" and \"s\" are silent"),
                .init(id: "s4", word: "homme", ipa: "/ɔm/", translation: "man", audioHint: "H is silent, double M sounds single"),
                .init(id: "s5", word: "français", ipa: "/fʁɑ̃.sɛ/", translation: "French", audioHint: "The \"s\" at end is silent"),
                .init(id: "s6", word: "chocolat", ipa: "/ʃɔ.kɔ.la/", translation: "chocolate", audioHint: "The final \"t\" is silent"),
                .init(id: "s7", word: "trois", ipa: "/tʁwa/", translation: "three", audioHint: "The \"s\" is silent"),
                .init(id: "s8", word: "doigt", ipa: "/dwa/", translation: "finger", audioHint: "The \"g\" and \"t\" are silent"),
              ]),
        .init(id: "vowel-sounds", name: "French Vowels", detail: "Pure, crisp French vowel sounds", emoji: "🎵", colorHex: "EF4444", difficulty: "Beginner",
              tips: ["French vowels are \"pure\" — they don't glide like English vowels", "Keep your mouth position steady throughout the sound", "The é is like \"ay\" but cut short"],
              words: [
                .init(id: "v1", word: "été", ipa: "/e.te/", translation: "summer", audioHint: "Both vowels are pure \"ay\" sounds"),
                .init(id: "v2", word: "père", ipa: "/pɛʁ/", translation: "father", audioHint: "Open \"eh\" sound like in \"bed\""),
                .init(id: "v3", word: "beau", ipa: "/bo/", translation: "beautiful", audioHint: "Pure \"oh\" — lips rounded, no glide"),
                .init(id: "v4", word: "peu", ipa: "/pø/", translation: "little/few", audioHint: "Round lips, say \"uh\""),
                .init(id: "v5", word: "café", ipa: "/ka.fe/", translation: "coffee", audioHint: "End with crisp \"ay\""),
                .init(id: "v6", word: "lait", ipa: "/lɛ/", translation: "milk", audioHint: "Open \"eh\" sound"),
                .init(id: "v7", word: "bleu", ipa: "/blø/", translation: "blue", audioHint: "Rounded \"eu\" sound"),
                .init(id: "v8", word: "je", ipa: "/ʒə/", translation: "I", audioHint: "Schwa — unstressed \"uh\""),
              ]),
    ]
}

// MARK: - Tenses

nonisolated struct VerbConjugation: Hashable {
    let je: String
    let tu: String
    let il: String
    let nous: String
    let vous: String
    let ils: String

    func forms() -> [(pronoun: String, form: String)] {
        [("je", je), ("tu", tu), ("il/elle/on", il), ("nous", nous), ("vous", vous), ("ils/elles", ils)]
    }
}

nonisolated struct FrenchVerb: Identifiable, Hashable {
    let infinitive: String
    let meaning: String
    let group: String
    let tenses: [String: VerbConjugation]
    var id: String { infinitive }
}

nonisolated struct FrenchTense: Identifiable, Hashable {
    let name: String
    let frenchName: String
    let detail: String
    let usage: String
    let example: String
    var id: String { name }
}

nonisolated enum TensesData {
    static let tenses: [FrenchTense] = [
        .init(name: "Present", frenchName: "Présent", detail: "Actions happening now or habitual actions", usage: "Daily routines, current states, general truths", example: "Je parle français. (I speak French.)"),
        .init(name: "Passé Composé", frenchName: "Passé Composé", detail: "Completed past actions", usage: "Single events in the past, completed actions", example: "J'ai mangé une pomme. (I ate an apple.)"),
        .init(name: "Imparfait", frenchName: "Imparfait", detail: "Ongoing or habitual past actions", usage: "Descriptions, background, repeated past actions", example: "Je mangeais souvent là. (I often ate there.)"),
        .init(name: "Futur Simple", frenchName: "Futur Simple", detail: "Future actions", usage: "Plans, predictions, promises", example: "Je parlerai demain. (I will speak tomorrow.)"),
        .init(name: "Conditionnel", frenchName: "Conditionnel Présent", detail: "Hypothetical or polite requests", usage: "Wishes, polite requests, hypothetical situations", example: "Je voudrais un café. (I would like a coffee.)"),
        .init(name: "Subjonctif", frenchName: "Subjonctif Présent", detail: "Doubt, emotion, necessity", usage: "After \"que\" with emotions, wishes, doubt", example: "Il faut que je parle. (I must speak.)"),
    ]

    static let verbs: [FrenchVerb] = [
        .init(infinitive: "être", meaning: "to be", group: "irregular", tenses: [
            "Present": .init(je: "suis", tu: "es", il: "est", nous: "sommes", vous: "êtes", ils: "sont"),
            "Passé Composé": .init(je: "ai été", tu: "as été", il: "a été", nous: "avons été", vous: "avez été", ils: "ont été"),
            "Imparfait": .init(je: "étais", tu: "étais", il: "était", nous: "étions", vous: "étiez", ils: "étaient"),
            "Futur Simple": .init(je: "serai", tu: "seras", il: "sera", nous: "serons", vous: "serez", ils: "seront"),
            "Conditionnel": .init(je: "serais", tu: "serais", il: "serait", nous: "serions", vous: "seriez", ils: "seraient"),
            "Subjonctif": .init(je: "sois", tu: "sois", il: "soit", nous: "soyons", vous: "soyez", ils: "soient"),
        ]),
        .init(infinitive: "avoir", meaning: "to have", group: "irregular", tenses: [
            "Present": .init(je: "ai", tu: "as", il: "a", nous: "avons", vous: "avez", ils: "ont"),
            "Passé Composé": .init(je: "ai eu", tu: "as eu", il: "a eu", nous: "avons eu", vous: "avez eu", ils: "ont eu"),
            "Imparfait": .init(je: "avais", tu: "avais", il: "avait", nous: "avions", vous: "aviez", ils: "avaient"),
            "Futur Simple": .init(je: "aurai", tu: "auras", il: "aura", nous: "aurons", vous: "aurez", ils: "auront"),
            "Conditionnel": .init(je: "aurais", tu: "aurais", il: "aurait", nous: "aurions", vous: "auriez", ils: "auraient"),
            "Subjonctif": .init(je: "aie", tu: "aies", il: "ait", nous: "ayons", vous: "ayez", ils: "aient"),
        ]),
        .init(infinitive: "aller", meaning: "to go", group: "irregular", tenses: [
            "Present": .init(je: "vais", tu: "vas", il: "va", nous: "allons", vous: "allez", ils: "vont"),
            "Passé Composé": .init(je: "suis allé(e)", tu: "es allé(e)", il: "est allé", nous: "sommes allé(e)s", vous: "êtes allé(e)(s)", ils: "sont allés"),
            "Imparfait": .init(je: "allais", tu: "allais", il: "allait", nous: "allions", vous: "alliez", ils: "allaient"),
            "Futur Simple": .init(je: "irai", tu: "iras", il: "ira", nous: "irons", vous: "irez", ils: "iront"),
            "Conditionnel": .init(je: "irais", tu: "irais", il: "irait", nous: "irions", vous: "iriez", ils: "iraient"),
            "Subjonctif": .init(je: "aille", tu: "ailles", il: "aille", nous: "allions", vous: "alliez", ils: "aillent"),
        ]),
        .init(infinitive: "faire", meaning: "to do/make", group: "irregular", tenses: [
            "Present": .init(je: "fais", tu: "fais", il: "fait", nous: "faisons", vous: "faites", ils: "font"),
            "Passé Composé": .init(je: "ai fait", tu: "as fait", il: "a fait", nous: "avons fait", vous: "avez fait", ils: "ont fait"),
            "Imparfait": .init(je: "faisais", tu: "faisais", il: "faisait", nous: "faisions", vous: "faisiez", ils: "faisaient"),
            "Futur Simple": .init(je: "ferai", tu: "feras", il: "fera", nous: "ferons", vous: "ferez", ils: "feront"),
            "Conditionnel": .init(je: "ferais", tu: "ferais", il: "ferait", nous: "ferions", vous: "feriez", ils: "feraient"),
            "Subjonctif": .init(je: "fasse", tu: "fasses", il: "fasse", nous: "fassions", vous: "fassiez", ils: "fassent"),
        ]),
        .init(infinitive: "pouvoir", meaning: "to be able to", group: "irregular", tenses: [
            "Present": .init(je: "peux", tu: "peux", il: "peut", nous: "pouvons", vous: "pouvez", ils: "peuvent"),
            "Passé Composé": .init(je: "ai pu", tu: "as pu", il: "a pu", nous: "avons pu", vous: "avez pu", ils: "ont pu"),
            "Imparfait": .init(je: "pouvais", tu: "pouvais", il: "pouvait", nous: "pouvions", vous: "pouviez", ils: "pouvaient"),
            "Futur Simple": .init(je: "pourrai", tu: "pourras", il: "pourra", nous: "pourrons", vous: "pourrez", ils: "pourront"),
            "Conditionnel": .init(je: "pourrais", tu: "pourrais", il: "pourrait", nous: "pourrions", vous: "pourriez", ils: "pourraient"),
            "Subjonctif": .init(je: "puisse", tu: "puisses", il: "puisse", nous: "puissions", vous: "puissiez", ils: "puissent"),
        ]),
        .init(infinitive: "vouloir", meaning: "to want", group: "irregular", tenses: [
            "Present": .init(je: "veux", tu: "veux", il: "veut", nous: "voulons", vous: "voulez", ils: "veulent"),
            "Passé Composé": .init(je: "ai voulu", tu: "as voulu", il: "a voulu", nous: "avons voulu", vous: "avez voulu", ils: "ont voulu"),
            "Imparfait": .init(je: "voulais", tu: "voulais", il: "voulait", nous: "voulions", vous: "vouliez", ils: "voulaient"),
            "Futur Simple": .init(je: "voudrai", tu: "voudras", il: "voudra", nous: "voudrons", vous: "voudrez", ils: "voudront"),
            "Conditionnel": .init(je: "voudrais", tu: "voudrais", il: "voudrait", nous: "voudrions", vous: "voudriez", ils: "voudraient"),
            "Subjonctif": .init(je: "veuille", tu: "veuilles", il: "veuille", nous: "voulions", vous: "vouliez", ils: "veuillent"),
        ]),
        .init(infinitive: "parler", meaning: "to speak", group: "er", tenses: [
            "Present": .init(je: "parle", tu: "parles", il: "parle", nous: "parlons", vous: "parlez", ils: "parlent"),
            "Passé Composé": .init(je: "ai parlé", tu: "as parlé", il: "a parlé", nous: "avons parlé", vous: "avez parlé", ils: "ont parlé"),
            "Imparfait": .init(je: "parlais", tu: "parlais", il: "parlait", nous: "parlions", vous: "parliez", ils: "parlaient"),
            "Futur Simple": .init(je: "parlerai", tu: "parleras", il: "parlera", nous: "parlerons", vous: "parlerez", ils: "parleront"),
            "Conditionnel": .init(je: "parlerais", tu: "parlerais", il: "parlerait", nous: "parlerions", vous: "parleriez", ils: "parleraient"),
            "Subjonctif": .init(je: "parle", tu: "parles", il: "parle", nous: "parlions", vous: "parliez", ils: "parlent"),
        ]),
        .init(infinitive: "finir", meaning: "to finish", group: "ir", tenses: [
            "Present": .init(je: "finis", tu: "finis", il: "finit", nous: "finissons", vous: "finissez", ils: "finissent"),
            "Passé Composé": .init(je: "ai fini", tu: "as fini", il: "a fini", nous: "avons fini", vous: "avez fini", ils: "ont fini"),
            "Imparfait": .init(je: "finissais", tu: "finissais", il: "finissait", nous: "finissions", vous: "finissiez", ils: "finissaient"),
            "Futur Simple": .init(je: "finirai", tu: "finiras", il: "finira", nous: "finirons", vous: "finirez", ils: "finiront"),
            "Conditionnel": .init(je: "finirais", tu: "finirais", il: "finirait", nous: "finirions", vous: "finiriez", ils: "finiraient"),
            "Subjonctif": .init(je: "finisse", tu: "finisses", il: "finisse", nous: "finissions", vous: "finissiez", ils: "finissent"),
        ]),
        .init(infinitive: "prendre", meaning: "to take", group: "re", tenses: [
            "Present": .init(je: "prends", tu: "prends", il: "prend", nous: "prenons", vous: "prenez", ils: "prennent"),
            "Passé Composé": .init(je: "ai pris", tu: "as pris", il: "a pris", nous: "avons pris", vous: "avez pris", ils: "ont pris"),
            "Imparfait": .init(je: "prenais", tu: "prenais", il: "prenait", nous: "prenions", vous: "preniez", ils: "prenaient"),
            "Futur Simple": .init(je: "prendrai", tu: "prendras", il: "prendra", nous: "prendrons", vous: "prendrez", ils: "prendront"),
            "Conditionnel": .init(je: "prendrais", tu: "prendrais", il: "prendrait", nous: "prendrions", vous: "prendriez", ils: "prendraient"),
            "Subjonctif": .init(je: "prenne", tu: "prennes", il: "prenne", nous: "prenions", vous: "preniez", ils: "prennent"),
        ]),
    ]
}
