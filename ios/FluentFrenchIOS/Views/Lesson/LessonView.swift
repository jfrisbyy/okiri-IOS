//
//  LessonView.swift
//  FluentFrenchIOS
//
//  The lesson cover: intro → teaching → (generating) → practice → complete.
//  This file only switches stages, hosts the quit confirmation and relays the
//  scene phase; the state machine is `LessonSession` (Services), the glue is
//  `LessonViewModel`, and each stage renders in its own file under Views/Lesson.
//

import SwiftUI

struct LessonView: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase

    let gaps: [GapItem]
    /// The engine's assembled lesson (target concept, roles, reasons, skill cards).
    var assembled: AssembledLesson? = nil
    /// A milestone quiz: no teaching, no hearts, no remedials, first attempt counts.
    var isCapstone: Bool = false

    @State private var model: LessonViewModel
    @State private var showQuitConfirmation = false

    init(gaps: [GapItem], assembled: AssembledLesson? = nil, isCapstone: Bool = false) {
        self.gaps = gaps
        self.assembled = assembled
        self.isCapstone = isCapstone
        _model = State(initialValue: LessonViewModel(gaps: gaps, assembled: assembled, isCapstone: isCapstone))
    }

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            switch model.stage {
            case .intro:
                LessonIntroStage(model: model, onClose: close)
            case .teaching:
                LessonTeachingStage(model: model, onClose: close)
            case .generating:
                LessonGeneratingStage(model: model, onClose: close)
            case .practice:
                LessonPracticeStage(model: model, onClose: close)
            case .complete:
                LessonCompleteStage(model: model, onDone: { dismiss() })
            }

            if let word = model.masteryFlash {
                LessonFlashOverlay(title: "Mastered!", subtitle: word)
            }
        }
        .confirmationDialog("Quit this lesson?", isPresented: $showQuitConfirmation, titleVisibility: .visible) {
            Button("Quit", role: .destructive) {
                model.confirmQuit(store: store)
                dismiss()
            }
            Button("Keep going", role: .cancel) {}
        } message: {
            Text(model.answeredCount > 0
                 ? "What you've answered so far is kept; the lesson won't count as finished."
                 : "Nothing has been answered yet.")
        }
        .onChange(of: scenePhase) { _, phase in
            model.scenePhaseChanged(phase)
        }
        .onAppear {
            // While a lesson is open the coordinator defers the foreground cloud
            // reconcile, so an applied remote snapshot can never replace the gaps
            // this lesson is recording answers against (store-1-3).
            store.beginLesson()
        }
        .onDisappear {
            model.cancelPending()
            store.endLesson()
        }
    }

    /// The X button: confirm during practice (C13), otherwise just close.
    private func close() {
        if model.needsQuitConfirmation {
            showQuitConfirmation = true
        } else {
            model.cancelPending()
            dismiss()
        }
    }
}
