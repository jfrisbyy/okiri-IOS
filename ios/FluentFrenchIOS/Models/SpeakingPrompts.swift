//
//  SpeakingPrompts.swift
//  FluentFrenchIOS
//
//  Guided speaking-prompt catalog mirroring the Expo app's prompt data.
//

import SwiftUI

nonisolated struct SpeakingPrompt: Identifiable, Hashable {
    let id: String
    let text: String
    let challenge: String
    let vocabularyFocus: [String]
}

nonisolated struct PromptCategory: Identifiable, Hashable {
    let id: String
    let name: String
    let icon: String
    let color: Color
    let cefr: String
    let prompts: [SpeakingPrompt]
}

nonisolated enum SpeakingData {
    static let categories: [PromptCategory] = [
        PromptCategory(id: "describe", name: "Describe & Explain", icon: "lightbulb.fill", color: Color(hex: "3B82F6"), cefr: "A2", prompts: [
            SpeakingPrompt(id: "d1", text: "Décris ta routine matinale en détail.", challenge: "Use the present tense", vocabularyFocus: ["se réveiller", "prendre", "ensuite", "d'habitude"]),
            SpeakingPrompt(id: "d2", text: "Explique comment préparer ton plat préféré.", challenge: "Sequence your steps", vocabularyFocus: ["d'abord", "mélanger", "ajouter", "cuire"]),
            SpeakingPrompt(id: "d3", text: "Décris ta ville et ce qu'on peut y faire.", challenge: "Describe places", vocabularyFocus: ["il y a", "se trouve", "quartier", "animé"]),
            SpeakingPrompt(id: "d4", text: "Explique ton travail ou tes études à un ami.", challenge: "Explain clearly", vocabularyFocus: ["je m'occupe de", "domaine", "responsable", "tâche"]),
        ]),
        PromptCategory(id: "opinions", name: "Opinions & Arguments", icon: "bubble.left.and.bubble.right.fill", color: Color(hex: "8B5CF6"), cefr: "B1", prompts: [
            SpeakingPrompt(id: "o1", text: "Penses-tu que les réseaux sociaux nous rapprochent ou nous éloignent ?", challenge: "Defend a position", vocabularyFocus: ["à mon avis", "d'une part", "cependant", "en revanche"]),
            SpeakingPrompt(id: "o2", text: "Le télétravail est-il une bonne chose ? Justifie.", challenge: "Give reasons", vocabularyFocus: ["car", "puisque", "avantage", "inconvénient"]),
            SpeakingPrompt(id: "o3", text: "Faut-il limiter le tourisme dans les grandes villes ?", challenge: "Nuance your view", vocabularyFocus: ["il faudrait", "selon moi", "en effet", "toutefois"]),
        ]),
        PromptCategory(id: "hypothetical", name: "Hypotheticals", icon: "sparkles", color: Color(hex: "EC4899"), cefr: "B1", prompts: [
            SpeakingPrompt(id: "h1", text: "Si tu pouvais vivre dans un autre pays, lequel et pourquoi ?", challenge: "Use the conditional", vocabularyFocus: ["je vivrais", "si je pouvais", "j'aimerais", "ce serait"]),
            SpeakingPrompt(id: "h2", text: "Que ferais-tu avec un million d'euros ?", challenge: "Conditional + future", vocabularyFocus: ["j'achèterais", "je voyagerais", "j'investirais", "je donnerais"]),
            SpeakingPrompt(id: "h3", text: "Si tu rencontrais ton héros, que lui dirais-tu ?", challenge: "Imagine a scene", vocabularyFocus: ["je lui demanderais", "je serais", "peut-être", "sans doute"]),
        ]),
        PromptCategory(id: "storytelling", name: "Storytelling", icon: "safari.fill", color: Color(hex: "10B981"), cefr: "B1", prompts: [
            SpeakingPrompt(id: "s1", text: "Raconte un voyage mémorable.", challenge: "Use the past tenses", vocabularyFocus: ["je suis allé", "c'était", "soudain", "finalement"]),
            SpeakingPrompt(id: "s2", text: "Raconte une journée où tout a mal tourné.", challenge: "Imparfait vs passé composé", vocabularyFocus: ["pendant que", "tout à coup", "heureusement", "à la fin"]),
            SpeakingPrompt(id: "s3", text: "Décris un souvenir d'enfance heureux.", challenge: "Set the scene", vocabularyFocus: ["quand j'étais petit", "nous avions", "chaque été", "je me souviens"]),
        ]),
        PromptCategory(id: "social", name: "Social Scenarios", icon: "person.2.fill", color: Color(hex: "F59E0B"), cefr: "A2", prompts: [
            SpeakingPrompt(id: "soc1", text: "Tu commandes au restaurant. Joue la scène.", challenge: "Be polite", vocabularyFocus: ["je voudrais", "l'addition", "s'il vous plaît", "la carte"]),
            SpeakingPrompt(id: "soc2", text: "Tu demandes ton chemin à un inconnu.", challenge: "Ask & thank", vocabularyFocus: ["excusez-moi", "où se trouve", "tout droit", "merci beaucoup"]),
            SpeakingPrompt(id: "soc3", text: "Tu présentes un ami à ta famille.", challenge: "Introduce people", vocabularyFocus: ["je te présente", "voici", "enchanté", "il s'appelle"]),
        ]),
        PromptCategory(id: "emotions", name: "Emotions & Feelings", icon: "heart.fill", color: Color(hex: "EF4444"), cefr: "B2", prompts: [
            SpeakingPrompt(id: "e1", text: "Parle d'un moment où tu étais vraiment fier de toi.", challenge: "Express feelings", vocabularyFocus: ["j'étais fier", "ému", "ça m'a touché", "soulagé"]),
            SpeakingPrompt(id: "e2", text: "Comment gères-tu le stress au quotidien ?", challenge: "Reflect", vocabularyFocus: ["je me sens", "ça m'aide", "respirer", "me détendre"]),
            SpeakingPrompt(id: "e3", text: "Décris ce qui te rend heureux.", challenge: "Nuance emotion", vocabularyFocus: ["me réjouir", "épanoui", "reconnaissant", "serein"]),
        ]),
    ]

    /// Free-speech session lengths. The minutes come from `Tuning` because each
    /// choice is a hard recording cap (E16), not a label.
    static var freeDurations: [(value: Int, label: String, description: String)] {
        Tuning.speakDurationChoicesMinutes.map { minutes in
            let description: String
            switch minutes {
            case ..<2: description = "Quick warm-up"
            case 2: description = minutes == Tuning.speakDefaultDurationMinutes ? "Recommended" : "Short session"
            case 3...4: description = "Build fluency"
            default: description = "Deep practice"
            }
            return (minutes, "\(minutes) min", description)
        }
    }

    static let tips: [String] = [
        "Talk about your day in French",
        "Describe what you see around you",
        "Narrate your thoughts out loud",
        "Practice conversations with yourself",
    ]
}
