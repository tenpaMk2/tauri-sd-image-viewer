fn main() {
    // macOS特有のフレームワークリンク
    #[cfg(target_os = "macos")]
    {
        println!("cargo:rustc-link-lib=framework=Foundation");
        println!("cargo:rustc-link-lib=framework=AppKit");
    }

    tauri_build::build()
}
