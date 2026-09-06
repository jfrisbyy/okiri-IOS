//
//  Theme.swift
//  FluentFrenchIOS
//
//  Central design tokens mirroring the Expo app's warm cream/orange palette.
//

import SwiftUI
import UIKit

enum Theme {
    // Backgrounds
    static let background = Color(hex: "FFF9F7")
    static let backgroundSecondary = Color(hex: "FEF2EE")
    static let backgroundTertiary = Color(hex: "FDE8E1")
    static let card = Color.white

    // Primary (orange)
    static let primary = Color(hex: "F97316")
    static let primaryLight = Color(hex: "FFF0E6")
    static let primaryDark = Color(hex: "EA580C")
    static let primaryGradientStart = Color(hex: "FB923C")
    static let primaryGradientEnd = Color(hex: "F97316")

    // Secondary (teal)
    static let secondary = Color(hex: "0D9488")
    static let secondaryLight = Color(hex: "E6F7F5")

    // Accent
    static let accent = Color(hex: "FDBA74")
    static let accentLight = Color(hex: "FFF4EB")

    // Text
    static let text = Color(hex: "1A1A1A")
    static let textSecondary = Color(hex: "6B6B6B")
    static let textMuted = Color(hex: "9B9B9B")
    static let textLight = Color.white

    // Borders
    static let border = Color(hex: "F0E0DA")
    static let borderLight = Color(hex: "FEF2EE")

    // Status
    static let success = Color(hex: "10B981")
    static let successLight = Color(hex: "ECFDF5")
    static let warning = Color(hex: "F59E0B")
    static let warningLight = Color(hex: "FFFBEB")
    static let error = Color(hex: "EF4444")
    static let errorLight = Color(hex: "FEF2F2")

    // Purple (pronunciation / SRS accents)
    static let purple = Color(hex: "7C3AED")
    static let indigo = Color(hex: "4338CA")

    // Warm shadow tint — softer & more premium than pure black on cream.
    static let shadowTint = Color(hex: "6B3F1F")

    // Gradients — eased to a smoother, slightly less saturated three-stop
    // ramp so headers read as premium rather than loud.
    static let primaryGradient = LinearGradient(
        colors: [Color(hex: "FFA75C"), primaryGradientStart, primaryGradientEnd],
        startPoint: .topLeading, endPoint: .bottomTrailing
    )
    static let tealGradient = LinearGradient(
        colors: [Color(hex: "14B8A6"), Color(hex: "0F766E")],
        startPoint: .topLeading, endPoint: .bottomTrailing
    )
    static let indigoGradient = LinearGradient(
        colors: [Color(hex: "4338CA"), Color(hex: "312E81")],
        startPoint: .topLeading, endPoint: .bottomTrailing
    )
}

// MARK: - Design tokens

/// One spacing rhythm used app-wide so margins, gaps, and insets feel deliberate.
enum Space {
    static let xs: CGFloat = 4
    static let sm: CGFloat = 8
    static let md: CGFloat = 12
    static let lg: CGFloat = 16
    static let xl: CGFloat = 20
    static let xxl: CGFloat = 28
    static let section: CGFloat = 24
}

/// One rounding scale: chips, standard cards, large hero cards.
enum Radius {
    static let chip: CGFloat = 10
    static let card: CGFloat = 16
    static let hero: CGFloat = 24
}

// MARK: - Accessibility tokens

extension Theme {
    /// Apple's minimum comfortable touch target, in points.
    static let minimumHitTarget: CGFloat = 44

    /// The Dynamic Type text style a fixed point size is scaled against
    /// (Package G band mapping). Large sizes scale with the large title curve,
    /// small labels with the caption curve, so every piece of text grows in
    /// step with the learner's system text size.
    nonisolated static func textStyle(forSize size: CGFloat) -> Font.TextStyle {
        switch size {
        case 28...: return .largeTitle
        case 22..<28: return .title2
        case 19..<22: return .title3
        case 17..<19: return .body
        case 15..<17: return .subheadline
        case 13..<15: return .footnote
        default: return .caption
        }
    }

    /// A scaled `Font` VALUE for call sites that need a `Font`, not a modifier
    /// (`.font(x ? a : b)`, `Text` concatenation, a font stored in a struct).
    /// Pass `@Environment(\.sizeCategory)` so the value re-computes when the
    /// learner changes their text size. Prefer `.scaledFont(...)` elsewhere.
    static func scaledFontValue(
        _ size: CGFloat,
        weight: Font.Weight = .regular,
        design: Font.Design = .default,
        for sizeCategory: ContentSizeCategory,
        relativeTo style: Font.TextStyle? = nil
    ) -> Font {
        let metrics = UIFontMetrics(forTextStyle: uiTextStyle(style ?? textStyle(forSize: size)))
        let traits = UITraitCollection(preferredContentSizeCategory: uiContentSizeCategory(sizeCategory))
        let scaled = metrics.scaledValue(for: size, compatibleWith: traits)
        return .system(size: scaled, weight: weight, design: design)
    }

    /// The animation to use given the learner's Reduce Motion setting: the
    /// original when motion is allowed, otherwise a short plain cross-fade
    /// (or nil when there was no animation to begin with) so state changes
    /// still settle without springing, bouncing or pulsing.
    nonisolated static func motion(_ animation: Animation?, reduceMotion: Bool) -> Animation? {
        guard reduceMotion else { return animation }
        return animation == nil ? nil : .easeInOut(duration: 0.15)
    }

    nonisolated private static func uiTextStyle(_ style: Font.TextStyle) -> UIFont.TextStyle {
        switch style {
        case .largeTitle: return .largeTitle
        case .title: return .title1
        case .title2: return .title2
        case .title3: return .title3
        case .headline: return .headline
        case .subheadline: return .subheadline
        case .body: return .body
        case .callout: return .callout
        case .footnote: return .footnote
        case .caption: return .caption1
        case .caption2: return .caption2
        default: return .body
        }
    }

    nonisolated private static func uiContentSizeCategory(_ category: ContentSizeCategory) -> UIContentSizeCategory {
        switch category {
        case .extraSmall: return .extraSmall
        case .small: return .small
        case .medium: return .medium
        case .large: return .large
        case .extraLarge: return .extraLarge
        case .extraExtraLarge: return .extraExtraLarge
        case .extraExtraExtraLarge: return .extraExtraExtraLarge
        case .accessibilityMedium: return .accessibilityMedium
        case .accessibilityLarge: return .accessibilityLarge
        case .accessibilityExtraLarge: return .accessibilityExtraLarge
        case .accessibilityExtraExtraLarge: return .accessibilityExtraExtraLarge
        case .accessibilityExtraExtraExtraLarge: return .accessibilityExtraExtraExtraLarge
        @unknown default: return .large
        }
    }
}

// MARK: - Editorial typography

extension Font {
    /// Elegant editorial serif (New York) for big moments — greetings,
    /// screen titles, and hero section headers.
    ///
    /// DEPRECATED (Package G): this is a fixed point size that ignores Dynamic
    /// Type. Use `.scaledSerifDisplay(_:weight:)` on the view instead; kept only
    /// until every call site has migrated.
    static func serifDisplay(_ size: CGFloat, weight: Font.Weight = .bold) -> Font {
        .system(size: size, weight: weight, design: .serif)
    }
}

// MARK: - Dynamic Type

/// Applies a system font whose point size follows the learner's text size.
/// SwiftUI has no `Font.system(size:relativeTo:)`, so the size is scaled with
/// `@ScaledMetric` against the text style the design size belongs to.
struct ScaledSystemFont: ViewModifier {
    @ScaledMetric private var size: CGFloat
    private let weight: Font.Weight
    private let design: Font.Design

    init(size: CGFloat, weight: Font.Weight, design: Font.Design, relativeTo style: Font.TextStyle) {
        _size = ScaledMetric(wrappedValue: size, relativeTo: style)
        self.weight = weight
        self.design = design
    }

    func body(content: Content) -> some View {
        content.font(.system(size: size, weight: weight, design: design))
    }
}

extension View {
    /// The Dynamic-Type-aware replacement for `.font(.system(size:weight:design:))`.
    /// `size` is the design size at the default (Large) text setting; it scales
    /// up and down with the system text size. When `relativeTo` is nil the text
    /// style is chosen from the size band (`Theme.textStyle(forSize:)`).
    func scaledFont(
        _ size: CGFloat,
        weight: Font.Weight = .regular,
        design: Font.Design = .default,
        relativeTo style: Font.TextStyle? = nil
    ) -> some View {
        modifier(ScaledSystemFont(size: size, weight: weight, design: design,
                                  relativeTo: style ?? Theme.textStyle(forSize: size)))
    }

    /// The Dynamic-Type-aware replacement for `.font(.serifDisplay(_:weight:))`.
    func scaledSerifDisplay(_ size: CGFloat, weight: Font.Weight = .bold) -> some View {
        scaledFont(size, weight: weight, design: .serif)
    }
}

// MARK: - Reduce Motion

/// `.animation(_:value:)` that honours the system Reduce Motion setting via
/// `Theme.motion(_:reduceMotion:)`.
struct ReducedMotionAnimation<V: Equatable>: ViewModifier {
    let animation: Animation?
    let value: V
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        content.animation(Theme.motion(animation, reduceMotion: reduceMotion), value: value)
    }
}

extension View {
    /// Animate `value` changes with `animation`, falling back to a short plain
    /// cross-fade (or no animation) when the learner has Reduce Motion on.
    func reducedMotionAnimation<V: Equatable>(_ animation: Animation?, value: V) -> some View {
        modifier(ReducedMotionAnimation(animation: animation, value: value))
    }
}

// MARK: - Hit targets

extension View {
    /// Guarantees at least a 44×44 pt tappable area (small icon buttons, chips)
    /// without changing how the control is drawn.
    func minimumHitTarget() -> some View {
        frame(minWidth: Theme.minimumHitTarget, minHeight: Theme.minimumHitTarget)
            .contentShape(Rectangle())
    }
}

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let r, g, b, a: UInt64
        switch hex.count {
        case 3:
            (r, g, b, a) = ((int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17, 255)
        case 8:
            (r, g, b, a) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (r, g, b, a) = (int >> 16, int >> 8 & 0xFF, int & 0xFF, 255)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

// MARK: - Reusable view modifiers

/// A single soft, layered "lift" used consistently so cards float gently
/// instead of looking stamped on. Pairs a tight contact shadow with a wider,
/// warm-tinted diffuse shadow.
struct SoftLift: ViewModifier {
    var radius: CGFloat = 16
    var y: CGFloat = 6
    var strength: Double = 1
    func body(content: Content) -> some View {
        content
            .shadow(color: Theme.shadowTint.opacity(0.06 * strength), radius: radius, x: 0, y: y)
            .shadow(color: Theme.shadowTint.opacity(0.04 * strength), radius: 2, x: 0, y: 1)
    }
}

extension View {
    func softLift(radius: CGFloat = 16, y: CGFloat = 6, strength: Double = 1) -> some View {
        modifier(SoftLift(radius: radius, y: y, strength: strength))
    }
}

struct CardStyle: ViewModifier {
    var padding: CGFloat = Space.lg
    var cornerRadius: CGFloat = Radius.card
    func body(content: Content) -> some View {
        content
            .padding(padding)
            .background(Theme.card)
            .clipShape(.rect(cornerRadius: cornerRadius))
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .stroke(Theme.border.opacity(0.5), lineWidth: 0.5)
            )
            .softLift()
    }
}

extension View {
    func cardStyle(padding: CGFloat = Space.lg, cornerRadius: CGFloat = Radius.card) -> some View {
        modifier(CardStyle(padding: padding, cornerRadius: cornerRadius))
    }
}
