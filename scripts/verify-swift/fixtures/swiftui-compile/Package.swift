// swift-tools-version:5.9
import PackageDescription

// On Apple platforms the real SwiftUI framework is available, so the shim
// target is omitted entirely and GeneratedTokens links against the system
// SwiftUI. On non-Apple platforms (Linux CI) a local target literally named
// `SwiftUI` provides the minimal stand-in types, so the generated code's
// `import SwiftUI` and `SwiftUI.Color`/`SwiftUI.Font` references resolve
// identically in both configurations.
#if canImport(SwiftUI)
let shimTargets: [Target] = []
let tokenDependencies: [Target.Dependency] = []
#else
let shimTargets: [Target] = [.target(name: "SwiftUI")]
let tokenDependencies: [Target.Dependency] = ["SwiftUI"]
#endif

let package = Package(
    name: "SwiftUICompileCheck",
    targets: shimTargets + [
        .target(name: "GeneratedTokens", dependencies: tokenDependencies),
    ]
)
