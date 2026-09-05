//
//  YouTubeEmbedView.swift
//  FluentFrenchIOS
//
//  A lightweight embedded YouTube player built on WKWebView. Loads the YouTube
//  IFrame embed (with YouTube's own chrome hidden) and bridges player state
//  (ready / time / playing) back to a SwiftUI-observable controller, while
//  forwarding commands (play, pause, seek, rate) into the page.
//
//  The controller OWNS a single WKWebView instance, so the same player can be
//  re-parented between the portrait layout and the fullscreen cinema view
//  without reloading — playback position and speed carry over seamlessly.
//

import SwiftUI
import WebKit

@MainActor
@Observable
final class YouTubePlayerController {
    var isReady = false
    var isPlaying = false
    var currentTime: Double = 0
    var duration: Double = 0

    let videoId: String
    private(set) var webView: WKWebView!

    init(videoId: String) {
        self.videoId = videoId
        setupWebView()
    }

    func play() { evaluate("if(p&&p.playVideo) p.playVideo();") }
    func pause() { evaluate("if(p&&p.pauseVideo) p.pauseVideo();") }
    func seek(to time: Double) {
        currentTime = max(0, time)
        evaluate("if(p&&p.seekTo) p.seekTo(\(max(0, time)), true);")
    }
    func setRate(_ rate: Double) { evaluate("if(p&&p.setPlaybackRate) p.setPlaybackRate(\(rate));") }
    func togglePlay() { isPlaying ? pause() : play() }

    private func setupWebView() {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []

        let userContent = WKUserContentController()
        let proxy = ScriptProxy()
        proxy.controller = self
        userContent.add(proxy, name: "bridge")
        let script = WKUserScript(source: Self.bridgeJS, injectionTime: .atDocumentEnd, forMainFrameOnly: false)
        userContent.addUserScript(script)
        config.userContentController = userContent

        let wv = WKWebView(frame: .zero, configuration: config)
        wv.scrollView.isScrollEnabled = false
        wv.scrollView.bounces = false
        wv.isOpaque = false
        wv.backgroundColor = .black
        wv.scrollView.backgroundColor = .black
        wv.customUserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
        self.webView = wv

        if let url = URL(string: Self.embedURL(videoId)) {
            wv.load(URLRequest(url: url))
        }
    }

    private func evaluate(_ body: String) {
        let js = "(function(){var p=document.getElementById('movie_player');\(body)})(); true;"
        webView?.evaluateJavaScript(js, completionHandler: nil)
    }

    private static func embedURL(_ id: String) -> String {
        // controls=0 + fs=0 + disablekb=1 hides YouTube's own chrome; we render
        // our own native controls on top in SwiftUI.
        "https://www.youtube.com/embed/\(id)?enablejsapi=1&playsinline=1&autoplay=1&controls=0&modestbranding=1&rel=0&iv_load_policy=3&cc_load_policy=0&fs=0&disablekb=1&origin=https://www.youtube.com"
    }

    private static let bridgeJS = """
    (function() {
      var pollId = null;
      var ready = false;
      function send(obj) { try { window.webkit.messageHandlers.bridge.postMessage(obj); } catch(e) {} }
      function setup() {
        var p = document.getElementById('movie_player');
        if (p && typeof p.getPlayerState === 'function') {
          if (!ready) { ready = true; send({ type: 'ready', duration: p.getDuration() || 0 }); }
          if (pollId) clearInterval(pollId);
          pollId = setInterval(function() {
            try {
              send({ type: 'time', current: p.getCurrentTime(), duration: p.getDuration(), state: p.getPlayerState() });
            } catch(e) {}
          }, 250);
        }
      }
      var finder = setInterval(function() { setup(); if (ready) clearInterval(finder); }, 300);
    })();
    true;
    """

    @MainActor
    final class ScriptProxy: NSObject, WKScriptMessageHandler {
        weak var controller: YouTubePlayerController?

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard let controller, let body = message.body as? [String: Any], let type = body["type"] as? String else { return }
            switch type {
            case "ready":
                controller.isReady = true
                if let d = body["duration"] as? Double, d > 0 { controller.duration = d }
            case "time":
                if let c = body["current"] as? Double, !c.isNaN { controller.currentTime = c }
                if let d = body["duration"] as? Double, d > 0 { controller.duration = d }
                if let state = body["state"] as? Int {
                    // 1 = playing, 2 = paused, 0 = ended
                    if state == 1 { controller.isPlaying = true }
                    else if state == 2 || state == 0 { controller.isPlaying = false }
                }
            default:
                break
            }
        }
    }
}

/// Hosts the controller's shared WKWebView. Re-parents the same web view into
/// whichever container is currently mounted (portrait or fullscreen), so the
/// video never reloads when switching modes.
struct YouTubeEmbedView: UIViewRepresentable {
    let controller: YouTubePlayerController
    /// A value that changes whenever this view should re-claim the shared web
    /// view (e.g. when returning from fullscreen), forcing `updateUIView` to run
    /// and re-parent the player back into this container.
    var attachmentToken: AnyHashable = 0

    func makeUIView(context: Context) -> UIView {
        let container = UIView()
        container.backgroundColor = .black
        attach(to: container)
        return container
    }

    func updateUIView(_ uiView: UIView, context: Context) {
        if controller.webView.superview !== uiView {
            attach(to: uiView)
        }
    }

    private func attach(to container: UIView) {
        let wv = controller.webView!
        wv.removeFromSuperview()
        wv.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(wv)
        NSLayoutConstraint.activate([
            wv.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            wv.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            wv.topAnchor.constraint(equalTo: container.topAnchor),
            wv.bottomAnchor.constraint(equalTo: container.bottomAnchor),
        ])
    }
}
