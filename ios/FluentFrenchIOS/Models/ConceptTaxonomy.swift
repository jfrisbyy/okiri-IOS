//
//  ConceptTaxonomy.swift
//  FluentFrenchIOS
//
//  Starter taxonomy of common French concepts spanning A1–B1. Prerequisites are
//  wired so foundational skills (articles, noun gender, present tense) are listed
//  as prerequisites of the skills that build on them — forming a dependency graph
//  the selection engine walks when deciding what's reachable next.
//

import Foundation

nonisolated enum ConceptTaxonomy {
    /// Seed concepts. Ids are stable slugs referenced by `prerequisites` and by
    /// gaps' `conceptId`, so do not rename existing ids.
    static func seed() -> [Concept] {
        func c(_ id: String, _ name: String, _ cat: GapCategory, _ lvl: CEFRLevel,
               _ prereqs: [String], _ desc: String) -> Concept {
            Concept(id: id, name: name, category: cat, cefrLevel: lvl, prerequisites: prereqs, description: desc)
        }

        return [
            // MARK: A1 — core grammar foundations (no prerequisites)
            c("definite-articles", "Definite articles (le, la, les)", .grammar, .A1, [],
              "Choosing le / la / les to match a noun's gender and number."),
            c("indefinite-articles", "Indefinite articles (un, une, des)", .grammar, .A1, [],
              "Using un / une / des for unspecified nouns."),
            c("noun-gender", "Noun gender", .grammar, .A1, [],
              "Knowing whether a noun is masculine or feminine."),
            c("subject-pronouns", "Subject pronouns", .grammar, .A1, [],
              "Using je, tu, il/elle, nous, vous, ils/elles correctly."),
            c("present-er-verbs", "Present tense: -er verbs", .grammar, .A1, [],
              "Conjugating regular -er verbs in the present."),
            c("present-irregular", "Present tense: être, avoir, aller, faire", .grammar, .A1, [],
              "The high-frequency irregular present-tense verbs."),
            c("basic-prepositions", "Basic prepositions", .grammar, .A1, [],
              "Using à, de, dans, sur, sous, avec, pour, chez."),

            // MARK: A1 — core grammar (first dependents)
            c("plurals", "Noun plurals", .grammar, .A1, ["noun-gender"],
              "Forming plurals: -s, -eaux, -aux and the irregulars."),
            c("negation", "Negation (ne… pas)", .grammar, .A1, ["present-er-verbs"],
              "Making sentences negative with ne… pas and friends."),
            c("questions", "Questions (yes/no & information)", .grammar, .A1, ["subject-pronouns"],
              "Asking with est-ce que, intonation, inversion and question words."),
            c("possessive-adjectives", "Possessive adjectives", .grammar, .A1, ["noun-gender"],
              "Using mon/ma/mes, ton/ta/tes, son/sa/ses and so on."),
            c("c-est-il-y-a", "C'est / il y a", .grammar, .A1, ["indefinite-articles"],
              "Pointing things out and saying what exists."),

            // MARK: A1 — vocabulary themes
            c("everyday-vocab", "Everyday vocabulary", .vocabulary, .A1, [],
              "Core words for food, family, home and daily life."),
            c("numbers-time", "Numbers, time & dates", .vocabulary, .A1, [],
              "Counting, telling time and giving dates."),
            c("family-vocab", "Family", .vocabulary, .A1, [],
              "Words for parents, siblings and relatives."),
            c("food-drink-vocab", "Food & drink", .vocabulary, .A1, [],
              "Common foods, drinks and meals."),
            c("home-vocab", "The home", .vocabulary, .A1, [],
              "Rooms and everyday objects around the house."),
            c("colors-vocab", "Colours", .vocabulary, .A1, [],
              "The basic colours and how they agree."),
            c("body-vocab", "The body", .vocabulary, .A1, [],
              "Parts of the body for health and description."),
            c("clothing-vocab", "Clothing", .vocabulary, .A1, [],
              "Everyday clothes and what people wear."),
            c("weather-vocab", "Weather", .vocabulary, .A1, [],
              "Talking about the weather with il fait / il y a."),
            c("places-town-vocab", "Places around town", .vocabulary, .A1, [],
              "Shops, stations and everyday locations."),
            c("directions-vocab", "Directions", .vocabulary, .A1, ["places-town-vocab"],
              "Asking for and giving simple directions."),
            c("jobs-vocab", "Jobs", .vocabulary, .A1, [],
              "Common professions and how to say what you do."),
            c("days-months-seasons", "Days, months & seasons", .vocabulary, .A1, ["numbers-time"],
              "The days, months and seasons of the year."),
            c("common-adjectives", "Common adjectives", .vocabulary, .A1, [],
              "High-frequency describing words."),
            c("common-verbs", "Common verbs", .vocabulary, .A1, [],
              "The most useful everyday verbs."),

            // MARK: A1 — pronunciation & register
            c("guttural-r", "The French guttural R", .pronunciation, .A1, [],
              "Producing the R at the back of the throat, not rolled."),
            c("nasal-vowels", "Nasal vowels (on, an, in)", .pronunciation, .A1, [],
              "Pronouncing the French nasal vowel sounds."),
            c("greetings-politeness", "Greetings & politeness", .register, .A1, [],
              "Everyday greetings and polite formulas."),

            // MARK: A1/A2 — first dependents
            c("tu-vs-vous", "Tu vs vous", .register, .A1, ["subject-pronouns"],
              "Choosing informal tu or formal vous for the listener."),
            c("adjective-agreement", "Adjective agreement", .grammar, .A2, ["noun-gender", "definite-articles"],
              "Matching adjectives to a noun's gender and number."),
            c("adjective-placement", "Adjective placement", .grammar, .A2, ["adjective-agreement"],
              "Knowing which adjectives go before or after the noun."),
            c("partitive-articles", "Partitive articles (du, de la)", .grammar, .A2, ["indefinite-articles"],
              "Expressing 'some' of an uncountable noun."),
            c("near-future", "Near future (aller + infinitive)", .grammar, .A2, ["present-irregular"],
              "Talking about what's about to happen with aller."),
            c("reflexive-verbs", "Reflexive verbs", .grammar, .A2, ["present-er-verbs"],
              "Using se laver, se lever and other reflexive verbs."),
            c("passe-compose-avoir", "Passé composé with avoir", .grammar, .A2, ["present-irregular"],
              "Forming the compound past with the auxiliary avoir."),
            c("passe-compose-etre", "Passé composé with être", .grammar, .A2, ["passe-compose-avoir"],
              "The movement/state verbs that take être and agree."),
            c("prepositions-place-time", "Prepositions of place & time", .grammar, .A2, ["everyday-vocab"],
              "Using à, de, en, dans, chez and time prepositions."),
            c("liaison", "Liaison in connected speech", .pronunciation, .A2, ["nasal-vowels"],
              "Linking final consonants to following vowels."),
            c("everyday-connectors", "Everyday connectors", .phrasing, .A2, ["greetings-politeness"],
              "Joining ideas with mais, donc, parce que, alors."),

            // MARK: B1 — higher dependents
            c("imparfait", "Imparfait", .grammar, .B1, ["passe-compose-avoir"],
              "Describing ongoing or habitual past situations."),
            c("imparfait-vs-pc", "Imparfait vs passé composé", .grammar, .B1, ["imparfait", "passe-compose-etre"],
              "Choosing the right past tense for description vs events."),
            c("object-pronouns", "Object pronouns (le, la, lui, leur)", .grammar, .B1, ["subject-pronouns", "passe-compose-avoir"],
              "Replacing direct and indirect objects with pronouns."),
            c("subjunctive-intro", "Subjunctive after il faut que", .grammar, .B1, ["present-irregular"],
              "Triggering the subjunctive with expressions of necessity."),
            c("savoir-vs-connaitre", "Savoir vs connaître", .vocabulary, .B1, ["present-irregular"],
              "Knowing a fact / how-to vs being familiar with something."),
            c("spoken-fillers", "Spoken fillers (du coup, quoi)", .phrasing, .B1, ["everyday-connectors"],
              "Natural spoken connectors and discourse markers."),
            c("idioms", "Common idioms", .phrasing, .B1, ["everyday-vocab"],
              "Fixed expressions whose meaning isn't literal."),
            c("formal-register", "Formal vs informal register", .register, .B1, ["tu-vs-vous"],
              "Shifting tone and vocabulary for formal contexts."),
        ]
    }

    /// Quick lookup helper used by the offline heuristic tagger fallback.
    static var ids: Set<String> { Set(seed().map { $0.id }) }

    /// The A1 base concepts that define "the basics" — used as the coverage proxy
    /// for the readiness gate and as the Foundation track's spine. Only vocabulary,
    /// grammar and core greetings count: pronunciation roots are excluded because a
    /// text placement test can't fairly judge them. This now spans the full A1 set
    /// (vocabulary themes + core grammar), so reading unlocks only once a learner has
    /// genuinely built the basics — not just the original 9-skill sliver.
    static let baseConceptIds: Set<String> = [
        // Core A1 grammar
        "definite-articles", "indefinite-articles", "noun-gender", "subject-pronouns",
        "present-er-verbs", "present-irregular", "basic-prepositions", "plurals",
        "negation", "questions", "possessive-adjectives", "c-est-il-y-a",
        // A1 vocabulary themes
        "everyday-vocab", "numbers-time", "family-vocab", "food-drink-vocab",
        "home-vocab", "colors-vocab", "body-vocab", "clothing-vocab", "weather-vocab",
        "places-town-vocab", "directions-vocab", "jobs-vocab", "days-months-seasons",
        "common-adjectives", "common-verbs",
        // Core greetings (taught in Foundation; not seeded by the text test)
        "greetings-politeness",
    ]
}
