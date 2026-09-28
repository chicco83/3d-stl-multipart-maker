//go:build !windows

// =============================================================================
// 3D STL Multipart Maker — launcher (native_other.go)
// Versione: 0.3.0-beta — 2026-09-28 10:24
// Su sistemi diversi da Windows (solo per test di sviluppo) non c'è finestra
// nativa: si usa il ripiego del browser.
// =============================================================================
package main

func runNative(url string) bool { return false }
