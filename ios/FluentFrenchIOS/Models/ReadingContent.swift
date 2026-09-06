//
//  ReadingContent.swift
//  FluentFrenchIOS
//
//  Curated reading library + shared reading types. Mirrors the Expo app's
//  built-in collection of stories, dialogues and articles used in Library view.
//

import SwiftUI

nonisolated enum ReadDifficulty: String, CaseIterable, Identifiable {
    case beginner, easy, medium, hard, university
    var id: String { rawValue }
    var label: String {
        switch self {
        case .beginner: return "Beginner"
        case .easy: return "Easy"
        case .medium: return "Medium"
        case .hard: return "Hard"
        case .university: return "University"
        }
    }
    var color: Color {
        switch self {
        case .beginner: return Theme.success
        case .easy: return Theme.primary
        case .medium: return Theme.warning
        case .hard: return Theme.secondary
        case .university: return Theme.purple
        }
    }
}

nonisolated enum ReadRegion: String, CaseIterable, Identifiable {
    case france, senegal, morocco, quebec, haiti, martinique, ivoryCoast, belgium, switzerland
    var id: String { rawValue }
    var label: String {
        switch self {
        case .france: return "France"
        case .senegal: return "Senegal"
        case .morocco: return "Morocco"
        case .quebec: return "Quebec"
        case .haiti: return "Haiti"
        case .martinique: return "Martinique"
        case .ivoryCoast: return "Ivory Coast"
        case .belgium: return "Belgium"
        case .switzerland: return "Switzerland"
        }
    }
    var flag: String {
        switch self {
        case .france: return "🇫🇷"
        case .senegal: return "🇸🇳"
        case .morocco: return "🇲🇦"
        case .quebec: return "🇨🇦"
        case .haiti: return "🇭🇹"
        case .martinique, .ivoryCoast: return "🌍"
        case .belgium: return "🇧🇪"
        case .switzerland: return "🇨🇭"
        }
    }
    var group: ReadRegionGroup {
        switch self {
        case .france, .belgium, .switzerland: return .europe
        case .senegal, .morocco, .ivoryCoast: return .africa
        case .haiti, .martinique: return .caribbean
        case .quebec: return .canada
        }
    }
}

nonisolated enum ReadRegionGroup: String, CaseIterable, Identifiable {
    case all, europe, africa, caribbean, canada
    var id: String { rawValue }
    var label: String { self == .all ? "All" : rawValue.capitalized }
    var emoji: String {
        switch self {
        case .all: return "🌍"
        case .europe: return "🇪🇺"
        case .africa: return "🌍"
        case .caribbean: return "🏝️"
        case .canada: return "🇨🇦"
        }
    }
}

nonisolated enum ReadCategory: String, CaseIterable, Identifiable {
    case dialogue, article, story, culture, history, literature, food, travel, science, news
    var id: String { rawValue }
    var label: String { rawValue.capitalized }
}

nonisolated struct ReadingPiece: Identifiable, Hashable {
    let id: String
    let title: String
    let subtitle: String
    let category: ReadCategory
    let region: ReadRegion
    let difficulty: ReadDifficulty
    let minutes: Int
    let level: CEFRLevel
    let body: String
    var tint: Color { difficulty.color }
}

// MARK: - Level-aware shelf (E20 / D5)

/// Which curated pieces a learner sees, and in what order, given the reading
/// gate and their level. Pure so the harness tests it; the Library view only
/// renders what this returns.
nonisolated enum ReadingShelf {
    /// How a piece relates to the learner's level, for honest labelling.
    enum Fit: Equatable {
        case atLevel        // within `Tuning.readingLevelWindow` bands
        case stretch        // above the window
        case easy           // below the window
    }

    /// The pieces the learner may open. In the bridge (`.foundation`) state only
    /// short curated pieces at or below `Tuning.readingBridgeMaxLevel` are shown,
    /// easiest first; when reading is unlocked every piece is shown, closest to
    /// the learner's level first (ties: shorter first). A locked gate shows nothing.
    static func pieces(for learnerLevel: CEFRLevel, readiness: ModalityReadiness,
                       from library: [ReadingPiece] = ReadingLibrary.pieces) -> [ReadingPiece] {
        switch readiness {
        case .locked:
            return []
        case .foundation:
            return library
                .filter { rank($0.level) <= rank(Tuning.readingBridgeMaxLevel) }
                .sorted { a, b in
                    if a.level != b.level { return rank(a.level) < rank(b.level) }
                    return a.minutes < b.minutes
                }
        case .unlocked:
            return library.sorted { a, b in
                let da = abs(rank(a.level) - rank(learnerLevel)), db = abs(rank(b.level) - rank(learnerLevel))
                if da != db { return da < db }
                if a.level != b.level { return rank(a.level) < rank(b.level) }
                return a.minutes < b.minutes
            }
        }
    }

    /// Where a piece sits relative to the learner.
    static func fit(of level: CEFRLevel, for learnerLevel: CEFRLevel) -> Fit {
        let delta = rank(level) - rank(learnerLevel)
        if abs(delta) <= Tuning.readingLevelWindow { return .atLevel }
        return delta > 0 ? .stretch : .easy
    }

    static func rank(_ level: CEFRLevel) -> Int {
        CEFRLevel.allCases.firstIndex(of: level) ?? 0
    }
}

nonisolated enum ReadingLibrary {
    static let pieces: [ReadingPiece] = [
        ReadingPiece(id: "r1", title: "Un café à Montmartre", subtitle: "A morning in Paris", category: .story, region: .france, difficulty: .easy, minutes: 4, level: .A2,
                     body: "Ce matin, je suis allé dans un petit café à Montmartre. Le serveur m'a souri et m'a demandé ce que je voulais. J'ai commandé un café crème et un croissant tout chaud. Du coup, j'ai découvert que j'adore les matins parisiens, quand la ville se réveille doucement et que les rues sentent le pain frais."),
        ReadingPiece(id: "r2", title: "La cuisine du Sénégal", subtitle: "Food & culture", category: .food, region: .senegal, difficulty: .medium, minutes: 6, level: .B1,
                     body: "Le thiéboudienne est le plat national du Sénégal. Il faut que tu goûtes ce plat de riz et de poisson au moins une fois dans ta vie. Les épices sont riches, le goût est inoubliable, et chaque famille a sa propre recette transmise de génération en génération."),
        ReadingPiece(id: "r3", title: "Actualités : la technologie", subtitle: "Tech news in French", category: .science, region: .france, difficulty: .hard, minutes: 5, level: .B2,
                     body: "Les scientifiques ont découvert une nouvelle manière de produire de l'énergie propre. Cette innovation pourrait changer la façon dont nous vivons et travaillons. Connaissez-vous déjà ces avancées ? Beaucoup d'experts pensent qu'elles transformeront notre quotidien d'ici quelques années."),
        ReadingPiece(id: "r4", title: "Le marché de Marrakech", subtitle: "Sights and sounds", category: .travel, region: .morocco, difficulty: .medium, minutes: 5, level: .B1,
                     body: "Au cœur de Marrakech, le souk déborde de couleurs et de parfums. Les marchands appellent les passants, les épices forment des pyramides orange et rouges, et le thé à la menthe coule à flots. Il faut négocier avec le sourire : c'est une tradition autant qu'un jeu."),
        ReadingPiece(id: "r5", title: "Au téléphone", subtitle: "Everyday dialogue", category: .dialogue, region: .france, difficulty: .beginner, minutes: 3, level: .A1,
                     body: "— Allô, bonjour, je voudrais parler à Marie. — C'est de la part de qui ? — De la part de Paul. — Un instant, je vous la passe. — Merci beaucoup. — Je vous en prie, bonne journée !"),
        ReadingPiece(id: "r6", title: "L'hiver à Québec", subtitle: "A Canadian winter", category: .culture, region: .quebec, difficulty: .medium, minutes: 6, level: .B1,
                     body: "À Québec, l'hiver n'est pas une saison qu'on subit : c'est une fête. Les gens patinent sur les rivières gelées, dégustent de la tire d'érable sur la neige, et le Carnaval illumine la ville. Malgré le froid, l'ambiance est toujours chaleureuse."),
        ReadingPiece(id: "r7", title: "Le petit prince", subtitle: "Literary classic", category: .literature, region: .france, difficulty: .hard, minutes: 7, level: .B2,
                     body: "On ne voit bien qu'avec le cœur. L'essentiel est invisible pour les yeux. C'est le temps que tu as perdu pour ta rose qui fait ta rose si importante. Les hommes ont oublié cette vérité, mais tu ne dois pas l'oublier."),
        ReadingPiece(id: "r8", title: "Histoire de Carthage", subtitle: "Ancient history", category: .history, region: .france, difficulty: .university, minutes: 8, level: .C1,
                     body: "Fondée au IXe siècle avant notre ère, Carthage devint l'une des plus grandes puissances de la Méditerranée. Sa rivalité avec Rome aboutit aux guerres puniques, dont l'issue détermina le destin du monde antique pour des siècles."),
        ReadingPiece(id: "r9", title: "Une journée à Bruxelles", subtitle: "City guide", category: .travel, region: .belgium, difficulty: .easy, minutes: 4, level: .A2,
                     body: "À Bruxelles, on commence par une gaufre chaude sur la Grand-Place. Ensuite, on visite les musées, on admire l'Atomium, et on termine la journée avec des frites et du chocolat. La ville mélange les langues et les cultures avec élégance."),
        ReadingPiece(id: "r10", title: "La rentrée scolaire", subtitle: "Back to school", category: .article, region: .france, difficulty: .medium, minutes: 5, level: .B1,
                     body: "Chaque mois de septembre, des millions d'élèves français reprennent le chemin de l'école. Les parents achètent les fournitures, les enfants retrouvent leurs amis, et une nouvelle année pleine de promesses commence. La rentrée est un rituel national."),
    ]
}
