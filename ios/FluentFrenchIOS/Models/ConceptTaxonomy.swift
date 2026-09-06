//
//  ConceptTaxonomy.swift
//  FluentFrenchIOS
//
//  The full A1–C1 map of what an English speaker has to master to go from
//  absolute beginner to fluent French. Prerequisites are wired so foundational
//  skills (articles, noun gender, present tense) are listed as prerequisites of
//  the skills that build on them — forming a dependency graph the selection
//  engine walks when deciding what's reachable next.
//
//  Ids are permanent: they are referenced by persisted learner state, by
//  `baseConceptIds` and by the skill ids in Resources/FoundationContent.json.
//  Add concepts freely; never rename, remove or re-level one.
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

            // MARK: A1 — sound and spelling (the rules that make French readable aloud)
            c("silent-final-consonants", "Silent final consonants", .pronunciation, .A1, [],
              "Knowing that most final consonants aren't said: petit, vous, beaucoup."),
            c("accent-marks", "Accent marks", .pronunciation, .A1, [],
              "What é, è, ê and ç do to the sound of a word."),
            c("elision", "Elision (j', l', d')", .pronunciation, .A1, ["definite-articles"],
              "Dropping a vowel before another vowel: je + ai becomes j'ai."),
            c("avoir-expressions", "Expressions with avoir", .grammar, .A1, ["present-irregular"],
              "Using avoir where English uses 'to be': j'ai faim, j'ai vingt ans."),

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


            // MARK: A2 — the verb system widens
            c("present-ir-re-verbs", "Present tense: -ir and -re verbs", .grammar, .A2, ["present-er-verbs"],
              "Conjugating finir, choisir, vendre and attendre in the present."),
            c("imperative", "The imperative", .grammar, .A2, ["present-er-verbs", "subject-pronouns"],
              "Telling someone what to do: Regarde ! Allons-y ! N'oublie pas."),
            c("modal-verbs", "Pouvoir, vouloir, devoir", .grammar, .A2, ["present-irregular"],
              "The three verbs of ability, wanting and obligation, each followed by an infinitive."),
            c("il-faut-necessity", "Il faut (what has to happen)", .grammar, .A2, ["present-irregular"],
              "Saying something is necessary with il faut plus a noun or an infinitive."),
            c("futur-simple", "Simple future", .grammar, .A2, ["near-future"],
              "The -rai, -ras, -ra endings, and when they beat aller + infinitive."),
            c("venir-de-recent-past", "Venir de (having just done)", .grammar, .A2, ["present-irregular"],
              "Je viens de manger — the immediate past, with no past tense involved."),
            c("etre-en-train-de", "Ongoing action (être en train de)", .grammar, .A2, ["present-er-verbs"],
              "French has no -ing tense: the present covers it, or être en train de insists on it."),
            c("on-pronoun", "On (we, people, someone)", .grammar, .A2, ["subject-pronouns"],
              "On stands in for nous in speech and for 'people' or 'someone' in general statements."),
            c("stressed-pronouns", "Stressed pronouns (moi, toi, eux)", .grammar, .A2, ["subject-pronouns"],
              "The forms used after a preposition, for emphasis, or standing on their own."),

            // MARK: A2 — determiners, comparison and description
            c("contractions-au-du", "Contractions (au, aux, du, des)", .grammar, .A2, ["definite-articles", "basic-prepositions"],
              "à + le becomes au and de + le becomes du — the merged form is compulsory."),
            c("de-after-negation", "De after a negative", .grammar, .A2, ["negation", "partitive-articles"],
              "Un, une, du and des all collapse to de after a negative: je n'ai pas de voiture."),
            c("quantity-expressions", "Expressions of quantity", .grammar, .A2, ["partitive-articles"],
              "beaucoup de, un peu de, trop de — quantity words take plain de, never du."),
            c("demonstrative-adjectives", "Demonstratives (ce, cette, ces)", .grammar, .A2, ["noun-gender"],
              "Pointing at one particular noun with ce, cet, cette and ces."),
            c("comparatives-superlatives", "Comparatives & superlatives", .grammar, .A2, ["adjective-agreement"],
              "plus grand que, moins cher que, and le plus / le moins for the top of the list."),
            c("adverb-formation", "Adverbs in -ment", .grammar, .A2, ["adjective-agreement"],
              "Building an adverb from an adjective, and knowing where the adverb then goes."),

            // MARK: A2 — place and time
            c("countries-prepositions", "Prepositions with countries & cities", .grammar, .A2, ["basic-prepositions", "places-town-vocab"],
              "en France, au Japon, aux États-Unis, à Paris — the choice follows the place's gender."),
            c("depuis-pendant-il-y-a", "Depuis, pendant, il y a", .grammar, .A2, ["numbers-time", "present-er-verbs"],
              "How long something has gone on — depuis takes the present where English takes 'have been'."),

            // MARK: A2 — vocabulary for getting through a day
            c("shopping-money-vocab", "Shopping & money", .vocabulary, .A2, ["numbers-time"],
              "Prices, paying, sizes and the words a shop actually uses."),
            c("travel-transport-vocab", "Travel & transport", .vocabulary, .A2, ["places-town-vocab"],
              "Tickets, platforms, luggage and getting from one place to another."),
            c("health-vocab", "Health & the doctor", .vocabulary, .A2, ["body-vocab"],
              "Symptoms, appointments and asking for something at the pharmacy."),
            c("daily-routine-vocab", "Daily routine", .vocabulary, .A2, ["reflexive-verbs"],
              "Describing an ordinary day, mostly with reflexive verbs."),
            c("leisure-sports-vocab", "Free time & sport", .vocabulary, .A2, ["common-verbs"],
              "Hobbies, sport and what you did at the weekend."),
            c("describing-people", "Describing people", .vocabulary, .A2, ["common-adjectives", "adjective-agreement"],
              "Appearance and character, with the adjectives agreeing as they go."),
            c("feelings-vocab", "Feelings & moods", .vocabulary, .A2, ["common-adjectives"],
              "Saying how you feel, from content to inquiet to énervé."),

            // MARK: A2 — how it sounds, and how you ask
            c("e-muet", "The mute e", .pronunciation, .A2, ["silent-final-consonants"],
              "The e that vanishes in ordinary speech: p'tit, j'te vois."),
            c("vowel-contrasts", "Vowel contrasts (u vs ou, é vs è)", .pronunciation, .A2, ["nasal-vowels"],
              "Hearing and making the pairs English doesn't have: tu / tout, les / lait."),
            c("rhythm-and-stress", "Rhythm & stress", .pronunciation, .A2, ["liaison"],
              "French leans on the end of a phrase, not on one syllable inside a word."),
            c("everyday-transactions", "Getting served", .phrasing, .A2, ["greetings-politeness", "numbers-time"],
              "The fixed lines of a café, a shop or a ticket window."),
            c("polite-requests", "Polite requests", .register, .A2, ["tu-vs-vous", "greetings-politeness"],
              "Softening an ask with je voudrais, pourriez-vous and s'il vous plaît."),

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

            // MARK: B1 — the pronoun system in full
            c("en-y-pronouns", "The pronouns en and y", .grammar, .B1, ["object-pronouns"],
              "Replacing de + something with en, and à + something with y."),
            c("pronoun-order", "Two pronouns at once", .grammar, .B1, ["object-pronouns", "en-y-pronouns"],
              "Je le lui donne — the fixed order object pronouns take in front of the verb."),
            c("imperative-with-pronouns", "Imperative with pronouns", .grammar, .B1, ["imperative", "object-pronouns"],
              "Donne-le-moi — and how the order flips back again in the negative."),
            c("possessive-pronouns", "Possessive pronouns (le mien)", .grammar, .B1, ["possessive-adjectives", "stressed-pronouns"],
              "Saying mine, yours and theirs without repeating the noun."),
            c("demonstrative-pronouns", "Demonstrative pronouns (celui, ce que)", .grammar, .B1, ["demonstrative-adjectives"],
              "celui, celle, ceux — and ce qui, ce que, ce dont for 'what'."),
            c("reversed-verbs-manquer-plaire", "Manquer, plaire and reversed subjects", .grammar, .B1, ["object-pronouns"],
              "Tu me manques means I miss you — French swaps the subject and the object round."),

            // MARK: B1 — joining clauses and asking properly
            c("relative-qui-que", "Relative pronouns qui & que", .grammar, .B1, ["object-pronouns"],
              "Joining two clauses: qui when it's the subject, que when it's the object."),
            c("relative-dont-ou", "Relative pronouns dont & où", .grammar, .B1, ["relative-qui-que"],
              "dont for verbs and nouns built with de, où for place and for time."),
            c("interrogative-pronouns", "Question pronouns (qui, que, lequel)", .grammar, .B1, ["questions", "relative-qui-que"],
              "qu'est-ce qui against qu'est-ce que, and lequel when there's a choice to make."),

            // MARK: B1 — the tense and mood system deepens
            c("plus-que-parfait", "Plus-que-parfait", .grammar, .B1, ["imparfait"],
              "The past behind the past: j'avais déjà mangé quand il est arrivé."),
            c("past-participle-agreement", "Past participle agreement", .grammar, .B1, ["passe-compose-etre", "object-pronouns"],
              "Agreeing the participle with être, and with a direct object that comes before the verb."),
            c("conditionnel-present", "Conditional", .grammar, .B1, ["futur-simple"],
              "Would: polite asks, wishes, and situations that aren't real."),
            c("si-clauses-present", "Si clauses: real conditions", .grammar, .B1, ["futur-simple"],
              "Si + present → future: what happens if it does happen."),
            c("si-clauses-imperfect", "Si clauses: unreal conditions", .grammar, .B1, ["si-clauses-present", "conditionnel-present", "imparfait"],
              "Si + imparfait → conditional: what would happen if it did."),
            c("future-after-quand", "Future after quand and dès que", .grammar, .B1, ["futur-simple"],
              "Quand j'aurai le temps — French uses the future where English keeps the present."),
            c("subjunctive-after-emotion", "Subjunctive after wanting, emotion & doubt", .grammar, .B1, ["subjunctive-intro"],
              "je veux que, je suis content que, je doute que — the triggers beyond il faut."),
            c("gerund-en-participle", "Gérondif (en + -ant)", .grammar, .B1, ["present-er-verbs", "present-ir-re-verbs"],
              "en faisant — doing one thing while, by, or on doing another."),
            c("infinitive-complements", "Verbs + à or de + infinitive", .grammar, .B1, ["modal-verbs"],
              "commencer à, essayer de, and the verbs that take the infinitive bare."),
            c("pronominal-verbs-uses", "Pronominal verbs beyond reflexive", .grammar, .B1, ["reflexive-verbs"],
              "Reciprocal (ils se parlent) and passive (ça se dit) uses of se."),
            c("impersonal-expressions", "Impersonal il", .grammar, .B1, ["il-faut-necessity"],
              "il pleut, il vaut mieux, il s'agit de — an il that stands for nobody."),
            c("negation-beyond-pas", "Negation beyond ne… pas", .grammar, .B1, ["negation", "de-after-negation"],
              "ne… jamais, rien, personne, plus, que — and where each half sits."),
            c("irregular-comparatives", "Meilleur vs mieux", .grammar, .B1, ["comparatives-superlatives"],
              "English says 'better' for both; French splits the adjective from the adverb."),
            c("written-homophones", "Homophones in writing", .grammar, .B1, ["accent-marks", "present-irregular", "possessive-adjectives"],
              "a and à, ou and où, ce and se, son and sont — same sound, different sentence."),

            // MARK: B1 — vocabulary that opens real topics
            c("work-and-study-vocab", "Talking about work", .vocabulary, .B1, ["jobs-vocab", "passe-compose-avoir"],
              "Your job, your studies, colleagues, meetings and pay."),
            c("technology-internet-vocab", "Technology & the internet", .vocabulary, .B1, ["everyday-vocab", "imperative"],
              "Phones, accounts, files and everything that happens online."),
            c("false-friends", "False friends", .vocabulary, .B1, ["everyday-vocab", "describing-people"],
              "Words that look English and aren't: actuellement, sensible, librairie."),
            c("leaving-verbs", "Partir, sortir, quitter, laisser", .vocabulary, .B1, ["common-verbs", "passe-compose-etre"],
              "Four French verbs where English only offers 'to leave'."),
            c("bringing-taking-verbs", "Apporter, amener, emporter, emmener", .vocabulary, .B1, ["common-verbs", "passe-compose-avoir"],
              "Bringing or taking, a thing or a person — French makes you choose both."),

            // MARK: B1 — sounding like the sentence you mean
            c("liaison-rules", "Liaison: compulsory, forbidden, optional", .pronunciation, .B1, ["liaison"],
              "Which links you must make, which you must never make, and which are a matter of style."),
            c("intonation", "Intonation", .pronunciation, .B1, ["rhythm-and-stress"],
              "The melody that turns a statement into a question, or a request into an order."),
            c("sequencing-a-story", "Telling something in order", .phrasing, .B1, ["everyday-connectors", "imparfait-vs-pc"],
              "d'abord, ensuite, puis, enfin — holding a sequence of events together."),
            c("expressing-opinion", "Giving an opinion", .phrasing, .B1, ["everyday-connectors"],
              "je pense que, à mon avis, je trouve que — and what has to follow each one."),
            c("spoken-vs-written-french", "Spoken vs written French", .register, .B1, ["formal-register"],
              "The dropped ne, on for nous, and questions asked by intonation alone."),

            // MARK: B2 — the subjunctive completed
            c("subjunctive-after-conjunctions", "Subjunctive after conjunctions", .grammar, .B2, ["subjunctive-after-emotion"],
              "bien que, pour que, avant que, à moins que — conjunctions that force the mood."),
            c("subjunctive-past", "Past subjunctive", .grammar, .B2, ["subjunctive-after-conjunctions"],
              "qu'il ait fini — the subjunctive for something that is already done."),
            c("subjunctive-vs-indicative", "Subjunctive or indicative?", .grammar, .B2, ["subjunctive-after-conjunctions"],
              "je pense que against je ne pense pas que — where doubt tips the mood over."),

            // MARK: B2 — hypotheticals, reporting and the passive
            c("conditionnel-passe", "Past conditional", .grammar, .B2, ["conditionnel-present", "plus-que-parfait"],
              "J'aurais dû — what would have happened, and regret about what didn't."),
            c("si-clauses-past", "Si clauses: the past you can't change", .grammar, .B2, ["si-clauses-imperfect", "conditionnel-passe"],
              "Si + plus-que-parfait → past conditional: if I had known, I would have come."),
            c("reported-speech", "Reported speech", .grammar, .B2, ["plus-que-parfait", "conditionnel-present"],
              "Il a dit qu'il viendrait — shifting the tense, the pronouns and the time words."),
            c("reported-questions", "Reported questions & orders", .grammar, .B2, ["reported-speech", "interrogative-pronouns"],
              "Il m'a demandé ce que je faisais, il m'a dit de partir."),
            c("passive-voice", "The passive", .grammar, .B2, ["past-participle-agreement"],
              "être + past participle, with par or de in front of the agent."),
            c("passive-alternatives", "What French uses instead of the passive", .grammar, .B2, ["passive-voice", "on-pronoun", "pronominal-verbs-uses"],
              "on, se faire and pronominal verbs, where English would reach for the passive."),
            c("causative-faire", "Faire + infinitive", .grammar, .B2, ["object-pronouns"],
              "Having something done: je fais réparer la voiture, je me fais couper les cheveux."),

            // MARK: B2 — precision in the sentence
            c("relative-lequel", "Relatives after a preposition (lequel)", .grammar, .B2, ["relative-dont-ou"],
              "la personne à laquelle, le sujet sur lequel, ce à quoi je pense."),
            c("futur-anterieur", "Future perfect", .grammar, .B2, ["futur-simple", "past-participle-agreement"],
              "Quand j'aurai fini — the future that is over before the other one starts."),
            c("participle-agreement-pronominal", "Agreement with pronominal verbs", .grammar, .B2, ["past-participle-agreement", "reflexive-verbs"],
              "elle s'est lavée, but elle s'est lavé les mains."),
            c("infinitive-clauses", "Avant de, après avoir + infinitive", .grammar, .B2, ["infinitive-complements"],
              "Where English uses -ing after a time word, French uses an infinitive."),
            c("adjective-position-meaning", "Adjectives that change meaning", .grammar, .B2, ["adjective-placement", "false-friends"],
              "un ancien élève against un bâtiment ancien — the position carries the meaning."),
            c("indefinite-pronouns", "Tout, chacun, n'importe quel", .grammar, .B2, ["demonstrative-pronouns"],
              "The indefinites: tout in all its forms, chacun, quelconque, n'importe quoi."),
            c("prepositions-nuance", "Prepositions with a fine edge", .grammar, .B2, ["prepositions-place-time", "infinitive-complements"],
              "en against dans for time, par against pour, and the preposition each verb insists on."),
            c("stylistic-inversion", "Inversion in writing", .grammar, .B2, ["questions", "spoken-vs-written-french"],
              "Peut-être a-t-il raison — the inversion that marks careful written French."),

            // MARK: B2 — vocabulary for opinions about the world
            c("news-and-media-vocab", "News & media", .vocabulary, .B2, ["everyday-vocab", "reported-speech"],
              "Following an article or a bulletin: what happened, to whom, and who says so."),
            c("society-politics-vocab", "Society & politics", .vocabulary, .B2, ["news-and-media-vocab"],
              "Elections, institutions, rights and the arguments that fill French media."),
            c("business-and-economy-vocab", "Work & the economy", .vocabulary, .B2, ["work-and-study-vocab"],
              "Companies, contracts, markets and money at a professional level."),
            c("science-environment-vocab", "Science & the environment", .vocabulary, .B2, ["news-and-media-vocab"],
              "Climate, energy, health and research as the press writes about them."),
            c("arts-culture-vocab", "Arts & culture", .vocabulary, .B2, ["everyday-vocab", "expressing-opinion"],
              "Books, films, exhibitions — and how to say what you thought of them."),
            c("word-building", "Word families & suffixes", .vocabulary, .B2, ["false-friends"],
              "Reading -tion, -ment, -eur and -able to work out a word you've never met."),

            // MARK: B2 — speech at speed
            c("spoken-reductions", "Fast speech reductions", .pronunciation, .B2, ["e-muet", "liaison-rules"],
              "chuis, t'as, y a, i'faut — what the words become at full speed."),
            c("linking-and-enchainement", "Enchaînement", .pronunciation, .B2, ["liaison-rules"],
              "Words running into each other so a whole phrase sounds like one long word."),

            // MARK: B2 — phrasing: saying it the way French says it
            c("verb-noun-collocations", "Collocations (prendre une décision)", .phrasing, .B2, ["idioms"],
              "The verb French puts with a noun: prendre une décision, faire attention, poser une question."),
            c("argument-connectors", "Connectors for an argument", .phrasing, .B2, ["everyday-connectors", "expressing-opinion"],
              "cependant, en revanche, néanmoins, d'ailleurs — the joints of a written argument."),
            c("structuring-an-argument", "Structuring an argument", .phrasing, .B2, ["argument-connectors"],
              "d'une part… d'autre part, en effet, ainsi — building a case that holds together."),
            c("hedging-and-nuance", "Hedging", .phrasing, .B2, ["conditionnel-present"],
              "il semblerait que, dans une certaine mesure, plutôt — saying it without committing to it."),
            c("polite-disagreement", "Disagreeing politely", .phrasing, .B2, ["expressing-opinion", "hedging-and-nuance"],
              "je ne suis pas convaincu, c'est discutable — pushing back without giving offence."),
            c("cleft-and-dislocation", "Emphasis (c'est… qui, moi, je…)", .phrasing, .B2, ["stressed-pronouns", "spoken-vs-written-french"],
              "French emphasises by moving words around, not by leaning on them."),
            c("reformulating", "Reformulating & summarising", .phrasing, .B2, ["argument-connectors"],
              "autrement dit, bref, c'est-à-dire — saying it again, shorter and clearer."),
            c("fixed-prepositional-phrases", "Set phrases built on prepositions", .phrasing, .B2, ["prepositions-nuance"],
              "en fonction de, à partir de, au fur et à mesure — learnt whole, never assembled."),

            // MARK: B2 — register you can choose
            c("soutenu-courant-familier", "The three registers", .register, .B2, ["formal-register"],
              "The same idea in soutenu, courant and familier — and what mixing them costs you."),
            c("professional-writing-register", "Professional email & letters", .register, .B2, ["formal-register", "polite-requests"],
              "How a work email opens, closes and keeps its distance."),

            // MARK: C1 — the literary and formal system
            c("passe-simple", "Passé simple", .grammar, .C1, ["imparfait-vs-pc", "stylistic-inversion"],
              "The written narrative past — il alla, ils furent — which you read but never speak."),
            c("literary-tenses", "The other literary tenses", .grammar, .C1, ["passe-simple", "subjunctive-past"],
              "Passé antérieur and the imperfect subjunctive, recognised in older or formal writing."),
            c("subjunctive-in-relative-clauses", "Subjunctive in relative clauses", .grammar, .C1, ["subjunctive-vs-indicative"],
              "je cherche quelqu'un qui sache — the mood admits the person may not exist."),
            c("subjunctive-after-superlative", "Subjunctive after a superlative", .grammar, .C1, ["subjunctive-vs-indicative", "comparatives-superlatives"],
              "le seul livre qui vaille — superlatives, le premier and le dernier take the subjunctive."),
            c("sequence-of-tenses", "Concordance des temps", .grammar, .C1, ["reported-speech", "subjunctive-past"],
              "Keeping every tense in step across a long, layered sentence."),
            c("conditional-of-report", "Conditional for unverified news", .grammar, .C1, ["conditionnel-present", "news-and-media-vocab"],
              "Le ministre aurait démissionné — the conditional that means 'reportedly'."),
            c("ne-expletif", "The expletive ne", .grammar, .C1, ["subjunctive-after-conjunctions"],
              "The ne in avant qu'il ne parte that negates nothing at all."),
            c("soutenu-negation", "Ne on its own", .grammar, .C1, ["negation-beyond-pas", "soutenu-courant-familier"],
              "In careful French, pouvoir, savoir, oser and cesser are negated with ne alone."),
            c("participle-agreement-edge-cases", "Agreement: the hard cases", .grammar, .C1, ["participle-agreement-pronominal"],
              "With en, before an infinitive, and the fait / laissé rules natives argue about."),
            c("perception-and-causative-verbs", "Voir faire, entendre dire", .grammar, .C1, ["causative-faire"],
              "Perception verbs followed by an infinitive, and the word order they force."),
            c("aspectual-periphrases", "Aspect carried by verbs", .grammar, .C1, ["etre-en-train-de", "infinitive-clauses"],
              "se mettre à, être sur le point de, ne cesser de — aspect French carries with verbs, not tenses."),
            c("impersonal-soutenu", "Formal impersonal constructions", .grammar, .C1, ["impersonal-expressions", "soutenu-courant-familier"],
              "il convient de, il s'avère que, force est de constater."),

            // MARK: C1 — a lexicon with edges
            c("academic-lexicon", "Academic & formal vocabulary", .vocabulary, .C1, ["word-building"],
              "The words essays, reports and serious articles are actually built from."),
            c("administrative-french", "Administrative French", .vocabulary, .C1, ["professional-writing-register"],
              "The vocabulary of forms, contracts, la préfecture and la sécu."),
            c("proverbs-and-references", "Proverbs & cultural references", .vocabulary, .C1, ["idioms", "verb-noun-collocations"],
              "The sayings, films and history a French adult expects you to catch."),
            c("anglicisms-and-neologisms", "Anglicisms & new words", .vocabulary, .C1, ["false-friends", "word-building"],
              "Which English words French has taken, how it says them, and which it refuses."),
            c("french-varieties", "Varieties of French", .vocabulary, .C1, ["spoken-vs-written-french", "spoken-reductions"],
              "Québec, Belgium, Switzerland, West Africa — what changes and what doesn't."),
            c("synonym-precision", "Choosing between near-synonyms", .vocabulary, .C1, ["academic-lexicon"],
              "Where two French words translate one English word and only one of them fits."),

            // MARK: C1 — hearing everything
            c("regional-accents", "Understanding accents", .pronunciation, .C1, ["intonation", "linking-and-enchainement"],
              "Marseille, Québec, Brussels — following French that doesn't come from the news."),
            c("expressive-intonation", "Intonation for attitude", .pronunciation, .C1, ["intonation", "spoken-reductions"],
              "The melody that carries irony, doubt, irritation or delight."),

            // MARK: C1 — phrasing that reads as native
            c("idiomatic-fluency", "Idiomatic phrasing", .phrasing, .C1, ["idioms", "verb-noun-collocations"],
              "Saying it the way it is said, rather than the way it translates."),
            c("irony-and-understatement", "Irony & understatement", .phrasing, .C1, ["expressive-intonation"],
              "Second degré and litote — ce n'est pas mauvais means it's very good."),
            c("written-cohesion", "Cohesion in writing", .phrasing, .C1, ["structuring-an-argument"],
              "Avoiding repetition with pronouns, synonyms and noun phrases that point back."),
            c("debate-and-persuasion", "Debating", .phrasing, .C1, ["structuring-an-argument", "polite-disagreement"],
              "Conceding a point, refuting one, and holding the floor while you do it."),
            c("storytelling-and-anecdote", "Telling an anecdote", .phrasing, .C1, ["sequencing-a-story", "spoken-fillers", "cleft-and-dislocation"],
              "Pacing, tenses and the small phrases that keep a listener with you."),

            // MARK: C1 — register, all the way down
            c("register-switching", "Switching register mid-conversation", .register, .C1, ["soutenu-courant-familier", "spoken-vs-written-french"],
              "Moving between registers as the room moves, without a false note."),
            c("argot-and-familiar-speech", "Familiar speech & argot", .register, .C1, ["soutenu-courant-familier"],
              "The everyday familiar lexicon, and what using it says about you."),
            c("verlan-and-youth-language", "Verlan & youth language", .register, .C1, ["argot-and-familiar-speech"],
              "How verlan is built — meuf, relou, chelou — and who actually says it."),
            c("strong-language-awareness", "Strong language", .register, .C1, ["argot-and-familiar-speech"],
              "What the taboo words really mean, and why recognising beats using them."),
            c("literary-and-journalistic-register", "Literary & journalistic style", .register, .C1, ["literary-tenses"],
              "The conventions of a novel, an editorial and a news report."),
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
