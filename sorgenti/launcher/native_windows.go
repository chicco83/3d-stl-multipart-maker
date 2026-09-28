//go:build windows

// =============================================================================
// 3D STL Multipart Maker — launcher (native_windows.go)
// Versione: 0.3.0-beta — 2026-09-28 10:24
// -----------------------------------------------------------------------------
// Finestra nativa con WebView2 (libreria github.com/jchv/go-webview2, Go puro):
//  - titolo "3D STL Multipart Maker", icona dell'exe (risorsa gruppo icone id 2,
//    l'id 1 è il manifest), dimensione adattata allo schermo, minimo 1000x640;
//  - barra del titolo scura (DWM immersive dark mode, Windows 10 20H1+/11);
//  - binding window.nativeSave -> finestra "Salva con nome" di Windows
//    (comdlg32.GetSaveFileNameW) e scrittura del file.
// =============================================================================
package main

import (
	"encoding/base64"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"unicode/utf16"
	"unsafe"

	webview2 "github.com/jchv/go-webview2"
)

var (
	user32   = syscall.NewLazyDLL("user32.dll")
	comdlg32 = syscall.NewLazyDLL("comdlg32.dll")
	dwmapi   = syscall.NewLazyDLL("dwmapi.dll")

	procGetSystemMetrics      = user32.NewProc("GetSystemMetrics")
	procShowWindow            = user32.NewProc("ShowWindow")
	procGetSaveFileNameW      = comdlg32.NewProc("GetSaveFileNameW")
	procDwmSetWindowAttribute = dwmapi.NewProc("DwmSetWindowAttribute")
)

var mainHwnd uintptr   // finestra principale (proprietaria dei dialoghi)
var lastSaveDir string // ultima cartella usata nel "Salva con nome"

// runNative apre la finestra WebView2 e resta in esecuzione finché l'utente
// non la chiude. Restituisce false se il runtime WebView2 non è disponibile.
func runNative(url string) bool {
	// [2026-09-28 v0.2.0] dataPath := filepath.Join(os.Getenv("LOCALAPPDATA"), "ModelSplitterEvo", "webview2")
	dataPath := filepath.Join(os.Getenv("LOCALAPPDATA"), "3DSTLMultipartMaker", "webview2")
	os.MkdirAll(dataPath, 0o755)

	// dimensione iniziale: 1600x1000, ridotta se lo schermo è più piccolo
	sw, _, _ := procGetSystemMetrics.Call(0) // SM_CXSCREEN
	sh, _, _ := procGetSystemMetrics.Call(1) // SM_CYSCREEN
	w, h := uint(1600), uint(1000)
	if sw > 0 && uint(sw)*9/10 < w {
		w = uint(sw) * 9 / 10
	}
	if sh > 0 && uint(sh)*9/10 < h {
		h = uint(sh) * 9 / 10
	}

	wv := webview2.NewWithOptions(webview2.WebViewOptions{
		Debug:     false,
		AutoFocus: true,
		DataPath:  dataPath,
		WindowOptions: webview2.WindowOptions{
			// [2026-09-28 v0.2.0] Title:  "Model Splitter Evo " + appVersion,
			Title:  "3D STL Multipart Maker " + appVersion,
			Width:  w,
			Height: h,
			IconId: 2,
			Center: true,
		},
	})
	if wv == nil {
		return false
	}
	defer wv.Destroy()
	mainHwnd = uintptr(wv.Window())

	// barra del titolo scura, coerente con il tema dell'interfaccia
	dark := int32(1)
	procDwmSetWindowAttribute.Call(mainHwnd, 20, uintptr(unsafe.Pointer(&dark)), 4) // DWMWA_USE_IMMERSIVE_DARK_MODE
	// finestra massimizzata se lo schermo è piccolo (portatili)
	if sw > 0 && sw <= 1600 {
		procShowWindow.Call(mainHwnd, 3) // SW_MAXIMIZE
	}

	wv.SetSize(1000, 640, webview2.HintMin)
	wv.Bind("nativeSave", nativeSave)
	wv.Navigate(url)
	wv.Run()
	return true
}

// -----------------------------------------------------------------------------
// "Salva con nome" nativo. Restituisce il percorso scelto, "" se annullato.
// -----------------------------------------------------------------------------
type openFileNameW struct {
	lStructSize       uint32
	hwndOwner         uintptr
	hInstance         uintptr
	lpstrFilter       *uint16
	lpstrCustomFilter *uint16
	nMaxCustFilter    uint32
	nFilterIndex      uint32
	lpstrFile         *uint16
	nMaxFile          uint32
	lpstrFileTitle    *uint16
	nMaxFileTitle     uint32
	lpstrInitialDir   *uint16
	lpstrTitle        *uint16
	flags             uint32
	nFileOffset       uint16
	nFileExtension    uint16
	lpstrDefExt       *uint16
	lCustData         uintptr
	lpfnHook          uintptr
	lpTemplateName    *uint16
	pvReserved        uintptr
	dwReserved        uint32
	flagsEx           uint32
}

func nativeSave(name, desc, ext, b64 string) (string, error) {
	data, err := base64.StdEncoding.DecodeString(b64)
	if err != nil {
		return "", err
	}
	ext = strings.TrimPrefix(ext, ".")
	// filtro: "Descrizione (*.ext)\0*.ext\0Tutti i file\0*.*\0\0"
	filter := utf16z(desc + " (*." + ext + ")\x00*." + ext + "\x00Tutti i file (*.*)\x00*.*\x00\x00")
	buf := make([]uint16, 4096)
	copy(buf, syscall.StringToUTF16(name))
	defExt := utf16z(ext)
	title := utf16z("Salva con nome")
	ofn := openFileNameW{
		hwndOwner:   mainHwnd,
		lpstrFilter: &filter[0],
		nFilterIndex: 1,
		lpstrFile:   &buf[0],
		nMaxFile:    uint32(len(buf)),
		lpstrTitle:  &title[0],
		lpstrDefExt: &defExt[0],
		// OFN_OVERWRITEPROMPT | OFN_NOCHANGEDIR | OFN_PATHMUSTEXIST | OFN_EXPLORER
		flags: 0x2 | 0x8 | 0x800 | 0x80000,
	}
	if lastSaveDir != "" {
		d := utf16z(lastSaveDir)
		ofn.lpstrInitialDir = &d[0]
	}
	ofn.lStructSize = uint32(unsafe.Sizeof(ofn))
	r, _, _ := procGetSaveFileNameW.Call(uintptr(unsafe.Pointer(&ofn)))
	if r == 0 {
		return "", nil // annullato dall'utente
	}
	path := syscall.UTF16ToString(buf)
	if err := os.WriteFile(path, data, 0o644); err != nil {
		return "", err
	}
	lastSaveDir = filepath.Dir(path)
	return path, nil
}

// stringa UTF-16 che può contenere \x00 interni (per i filtri)
func utf16z(s string) []uint16 {
	return append(utf16.Encode([]rune(s)), 0)
}
