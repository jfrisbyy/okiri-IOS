//
//  Theme.swift
//  FluentFrenchIOS
//
//  Central design tokens mirroring the Expo app's warm cream/orange palette.
//

import SwiftUI

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

// MARK: - Editorial typography

extension Font {
    /// Elegant editorial serif (New York) for big moments — greetings,
    /// screen titles, and hero section headers.
    static func serifDisplay(_ size: CGFloat, weight: Font.Weight = .bold) -> Font {
        .system(size: size, weight: weight, design: .serif)
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
