//
//  KiriView.swift
//  FluentFrenchIOS
//
//  The shared Kiri fox mascot. Clips a single pose from the 4×3 sprite sheet
//  and brings it to life: gentle breathing, idle sway, spontaneous hops, a
//  playful tap reaction with a French speech bubble + haptic, and mood
//  sparkles that bloom into a celebratory burst on a strong streak.
//
//  All motion is applied OUTSIDE the clipped sprite frame so hopping and
//  scaling never reveal neighbouring cells of the sprite sheet.
//

import SwiftUI

struct KiriView: View {
    enum Mood {
        case idle, happy, encouraging, celebrating
        /// Row/column of this pose in the 4-col × 3-row sprite sheet.
        var cell: (row: Int, col: Int) {
            switch self {
            case .idle: return (2, 0)         // winking, arms crossed
            case .happy: return (0, 0)        // waving hello
            case .encouraging: return (2, 3)  // cheerful thumbs-up
            case .celebrating: return (1, 2)  // trophy + confetti
            }
        }
    }

    var mood: Mood = .idle
    var size: CGFloat = 100
    /// Forces the richer celebratory sparkle burst regardless of mood.
    var festive: Bool = false

    @State private var breathe = false
    @State private var sway = false
    @State private var hop: CGFloat = 0
    @State private var wiggle: Double = 0
    @State private var tapMood: Mood? = nil
    @State private var bubble: String? = nil
    @State private var didStart = false

    private let phrases = ["Bravo!", "Allez!", "Continue!", "Super!", "On y va!", "Génial!", "C'est parti!"]

    private var activeMood: Mood { tapMood ?? mood }
    private var celebratory: Bool { festive || mood == .celebrating || tapMood == .celebrating }

    var body: some View {
        ZStack {
            sparkles
            sprite
            if let bubble {
                speechBubble(bubble)
                    .offset(y: -size * 0.66)
                    .transition(.scale(scale: 0.5, anchor: .bottom).combined(with: .opacity))
            }
        }
        .frame(width: size, height: size)
        .onAppear(perform: startIdle)
    }

    // MARK: - Sprite (clipped pose + motion)

    private var sprite: some View {
        let cell = activeMood.cell
        return Color.clear
            .frame(width: size, height: size)
            .overlay(alignment: .topLeading) {
                Image("KiriPoses")
                    .resizable()
                    .interpolation(.high)
                    .frame(width: size * 4, height: size * 3)
                    .offset(x: -CGFloat(cell.col) * size, y: -CGFloat(cell.row) * size)
                    .allowsHitTesting(false)
            }
            .clipped()
            .background(alignment: .bottom) { groundShadow }
            // Breathing: subtle squash/stretch anchored at the feet.
            .scaleEffect(x: breathe ? 1.015 : 0.992, y: breathe ? 0.99 : 1.012, anchor: .bottom)
            .rotationEffect(.degrees((sway ? 2.4 : -2.4) + wiggle), anchor: .bottom)
            .offset(y: hop)
            .contentShape(Rectangle())
            .onTapGesture(perform: react)
    }

    private var groundShadow: some View {
        Ellipse()
            .fill(Color.black.opacity(0.13))
            .frame(width: size * 0.5, height: size * 0.09)
            .scaleEffect(x: breathe ? 1.06 : 0.9, anchor: .center)
            .opacity(hop < -1 ? 0.5 : 0.85)
            .blur(radius: 4)
            .offset(y: size * 0.04)
    }

    // MARK: - Speech bubble

    private func speechBubble(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 13, weight: .bold, design: .rounded))
            .foregroundStyle(Theme.primaryDark)
            .padding(.horizontal, 12)
            .padding(.vertical, 7)
            .background(Capsule().fill(.white))
            .overlay(Capsule().stroke(Theme.primary.opacity(0.18), lineWidth: 1))
            .shadow(color: Theme.shadowTint.opacity(0.18), radius: 7, y: 3)
            .fixedSize()
    }

    // MARK: - Sparkles

    private var sparkles: some View {
        ZStack {
            ForEach(0..<(celebratory ? 9 : 4), id: \.self) { i in
                SparkleParticle(index: i, size: size, festive: celebratory)
            }
        }
        .allowsHitTesting(false)
    }

    // MARK: - Animation drivers

    private func startIdle() {
        guard !didStart else { return }
        didStart = true
        withAnimation(.easeInOut(duration: 2.4).repeatForever(autoreverses: true)) { breathe = true }
        withAnimation(.easeInOut(duration: 3.2).repeatForever(autoreverses: true)) { sway = true }
        scheduleHop()
    }

    private func scheduleHop() {
        DispatchQueue.main.asyncAfter(deadline: .now() + Double.random(in: 3.5...7.5)) {
            if tapMood == nil { spontaneousHop() }
            scheduleHop()
        }
    }

    private func spontaneousHop() {
        withAnimation(.interpolatingSpring(stiffness: 240, damping: 8)) {
            hop = -size * 0.07
            wiggle = 5
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            withAnimation(.interpolatingSpring(stiffness: 190, damping: 9)) {
                hop = 0
                wiggle = 0
            }
        }
    }

    private func react() {
        Haptics.tap()
        let cheer: Mood = mood == .celebrating ? .celebrating : .happy
        withAnimation(.spring(response: 0.3, dampingFraction: 0.5)) {
            tapMood = cheer
            hop = -size * 0.16
            wiggle = 0
            bubble = phrases.randomElement()
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.24) {
            withAnimation(.interpolatingSpring(stiffness: 200, damping: 7)) { hop = 0 }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.7) {
            withAnimation(.easeOut(duration: 0.35)) {
                tapMood = nil
                bubble = nil
            }
        }
    }
}

// MARK: - Floating sparkle particle

private struct SparkleParticle: View {
    let index: Int
    let size: CGFloat
    let festive: Bool

    @State private var anim = false

    private var angle: Double { Double(index) * (festive ? 40 : 90) + 28 }
    private var radius: CGFloat { size * (festive ? 0.52 : 0.46) }
    private var symbol: String { index % 3 == 0 ? "star.fill" : "sparkle" }
    private var glyphSize: CGFloat { festive ? (7 + CGFloat(index % 3) * 3) : 8 }
    private var color: Color {
        guard festive else { return Theme.accent }
        let palette: [Color] = [Theme.primary, Theme.warning, Theme.accent, Theme.secondary, Theme.purple]
        return palette[index % palette.count]
    }
    private var dx: CGFloat { CGFloat(cos(angle * .pi / 180)) * radius }
    private var dy: CGFloat { CGFloat(sin(angle * .pi / 180)) * radius * 0.85 }

    var body: some View {
        Image(systemName: symbol)
            .font(.system(size: glyphSize, weight: .bold))
            .foregroundStyle(color)
            .offset(x: dx, y: dy - (anim ? size * 0.14 : 0))
            .scaleEffect(anim ? 1.05 : 0.3)
            .opacity(anim ? 0 : 0.9)
            .onAppear {
                withAnimation(
                    .easeOut(duration: festive ? 1.2 : 2.4)
                        .repeatForever(autoreverses: false)
                        .delay(Double(index) * (festive ? 0.12 : 0.4))
                ) { anim = true }
            }
    }
}
