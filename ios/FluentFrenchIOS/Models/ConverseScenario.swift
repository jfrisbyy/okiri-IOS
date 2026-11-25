//
//  ConverseScenario.swift
//  FluentFrenchIOS
//
//  The conversation scenarios: a model, not a view. It used to be declared at the
//  bottom of Views/ConverseView.swift, which left ConverseService -- a service --
//  depending on a type defined in a SwiftUI file. Moved here unchanged so the
//  engine stays view-free and the Linux harness can compile ConverseService.
//

import Foundation

nonisolated struct ConverseScenario: Identifiable, Hashable {
    let id: String
    let title: String
    let titleFrench: String
    let description: String
    let emoji: String
    let requiredLevel: CEFRLevel
    let greetingFrench: String
    let greetingEnglish: String
    let starterPhraseFrench: String
    let starterPhraseEnglish: String

    static let all: [ConverseScenario] = [
        .init(id: "cafe", title: "At a Café", titleFrench: "Au café",
              description: "Order drinks, pastries, and chat with the barista about your day.",
              emoji: "☕", requiredLevel: .A1,
              greetingFrench: "Bonjour ! Bienvenue. Qu'est-ce que je vous sers aujourd'hui ?",
              greetingEnglish: "Hello! Welcome. What can I get you today?",
              starterPhraseFrench: "Je voudrais un café, s'il vous plaît.",
              starterPhraseEnglish: "I would like a coffee, please."),
        .init(id: "directions", title: "Asking for Directions", titleFrench: "Demander son chemin",
              description: "Navigate a French city by asking locals how to get to landmarks.",
              emoji: "🗺️", requiredLevel: .A1,
              greetingFrench: "Bonjour ! Vous avez l'air perdu. Je peux vous aider ?",
              greetingEnglish: "Hello! You look lost. Can I help you?",
              starterPhraseFrench: "Excusez-moi, où se trouve la gare ?",
              starterPhraseEnglish: "Excuse me, where is the train station?"),
        .init(id: "restaurant", title: "Ordering at a Restaurant", titleFrench: "Commander au restaurant",
              description: "Read the menu, ask for recommendations, and handle the bill.",
              emoji: "🍽️", requiredLevel: .A1,
              greetingFrench: "Bonsoir et bienvenue ! Avez-vous choisi votre table ?",
              greetingEnglish: "Good evening and welcome! Have you chosen your table?",
              starterPhraseFrench: "Qu'est-ce que vous me recommandez ?",
              starterPhraseEnglish: "What do you recommend?"),
        .init(id: "making-friends", title: "Making Friends", titleFrench: "Se faire des amis",
              description: "Strike up a conversation at a party and make plans to hang out.",
              emoji: "🤝", requiredLevel: .A2,
              greetingFrench: "Salut ! On ne s'est jamais rencontrés, non ? Moi c'est Julien.",
              greetingEnglish: "Hi! We've never met, right? I'm Julien.",
              starterPhraseFrench: "Enchanté ! Qu'est-ce que tu fais dans la vie ?",
              starterPhraseEnglish: "Nice to meet you! What do you do for a living?"),
        .init(id: "doctor", title: "At the Doctor", titleFrench: "Chez le médecin",
              description: "Describe symptoms and understand the doctor's advice.",
              emoji: "🩺", requiredLevel: .A2,
              greetingFrench: "Bonjour, installez-vous. Qu'est-ce qui vous amène aujourd'hui ?",
              greetingEnglish: "Hello, have a seat. What brings you in today?",
              starterPhraseFrench: "J'ai mal à la gorge depuis trois jours.",
              starterPhraseEnglish: "I've had a sore throat for three days."),
        .init(id: "shopping", title: "Shopping for Clothes", titleFrench: "Acheter des vêtements",
              description: "Ask about sizes, colors, and try things on at a boutique.",
              emoji: "👗", requiredLevel: .A2,
              greetingFrench: "Bonjour ! Je peux vous aider à trouver quelque chose ?",
              greetingEnglish: "Hello! Can I help you find something?",
              starterPhraseFrench: "Est-ce que vous avez ceci en taille M ?",
              starterPhraseEnglish: "Do you have this in size medium?"),
        .init(id: "job-interview", title: "Job Interview", titleFrench: "Entretien d'embauche",
              description: "Answer common interview questions and present your experience.",
              emoji: "💼", requiredLevel: .B1,
              greetingFrench: "Bonjour, merci d'être venu. Parlez-moi un peu de vous.",
              greetingEnglish: "Hello, thank you for coming. Tell me a little about yourself.",
              starterPhraseFrench: "J'ai plusieurs années d'expérience dans ce domaine.",
              starterPhraseEnglish: "I have several years of experience in this field."),
        .init(id: "free", title: "Free Conversation", titleFrench: "Conversation libre",
              description: "Talk about anything you want — the tutor adapts to your topic.",
              emoji: "💬", requiredLevel: .A1,
              greetingFrench: "Salut ! De quoi as-tu envie de parler aujourd'hui ?",
              greetingEnglish: "Hi! What would you like to talk about today?",
              starterPhraseFrench: "J'aimerais parler de mes projets pour le week-end.",
              starterPhraseEnglish: "I'd like to talk about my plans for the weekend."),
    ]
}
