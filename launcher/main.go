// =============================================================================
// 3D STL Multipart Maker — launcher (main.go)
// Versione: 0.7.0-beta — 2026-10-08 12:00
// -----------------------------------------------------------------------------
// Eseguibile portable per Windows (nessuna installazione):
//  1. contiene l'interfaccia web (cartella dist) incorporata con go:embed;
//  2. avvia un piccolo server HTTP interno solo su 127.0.0.1 (porta fissa
//     47913, altrimenti casuale) — nessun accesso dalla rete;
//  3. v0.2.0: mostra l'interfaccia in una FINESTRA NATIVA del programma con il
//     componente di sistema Microsoft WebView2 (niente processo/profilo Edge
//     visibile). Dati WebView2 in %LOCALAPPDATA%\3DSTLMultipartMaker\webview2;
//  4. v0.2.0: espone a JavaScript window.nativeSave(nome, descr, ext, base64)
//     che apre il "Salva con nome" di Windows (comdlg32) e scrive il file;
//  5. se il runtime WebView2 manca (raro) ripiega sulla modalità v0.1.0:
//     Edge/Chrome --app o browser predefinito.
// Compilato con -H windowsgui: nessuna finestra console. Solo Go puro (no cgo).
// =============================================================================
package main

import (
	"embed"
	"io/fs"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync/atomic"
	"time"
)

// Versione mostrata nel titolo della finestra
// [2026-09-28 v0.2.0] const appVersion = "0.2.0-beta"
// [2026-09-28 v0.3.0] const appVersion = "0.3.0-beta"
// [2026-09-28 v0.4.0] const appVersion = "0.4.0-beta"
// [2026-09-28 v0.4.1] const appVersion = "0.4.1-beta"
// [2026-09-28 v0.5.0] const appVersion = "0.5.0-beta"
// [2026-09-28 v0.5.1] const appVersion = "0.5.1-beta"
// [2026-09-28 v0.5.2] const appVersion = "0.5.2-beta"
// [2026-10-01 v0.6.0] const appVersion = "0.6.0-beta"
// [2026-10-08 v0.7.0] const appVersion = "0.6.1-beta"
const appVersion = "0.7.0-beta"

//go:embed dist
var dist embed.FS

var lastPing atomic.Int64

// [2026-09-28 v0.1.0] versione precedente di main():
// func main() {
// 	sub, _ := fs.Sub(dist, "dist")
//
// 	// ---- server HTTP locale ----------------------------------------------
// 	mux := http.NewServeMux()
// 	files := http.FileServer(http.FS(sub))
// 	mux.HandleFunc("/api/ping", func(w http.ResponseWriter, r *http.Request) {
// 		lastPing.Store(time.Now().UnixMilli())
// 		w.Header().Set("Cache-Control", "no-store")
// 		w.Write([]byte("ok"))
// 	})
// 	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
// 		// tipi MIME espliciti (il registro di Windows può non conoscere .wasm)
// 		switch {
// 		case strings.HasSuffix(r.URL.Path, ".wasm"):
// 			w.Header().Set("Content-Type", "application/wasm")
// 		case strings.HasSuffix(r.URL.Path, ".js"):
// 			w.Header().Set("Content-Type", "text/javascript; charset=utf-8")
// 		case strings.HasSuffix(r.URL.Path, ".css"):
// 			w.Header().Set("Content-Type", "text/css; charset=utf-8")
// 		}
// 		w.Header().Set("Cache-Control", "no-store")
// 		files.ServeHTTP(w, r)
// 	})
//
// 	ln, err := net.Listen("tcp", "127.0.0.1:47913")
// 	if err != nil { // porta occupata (es. seconda istanza): porta casuale
// 		ln, err = net.Listen("tcp", "127.0.0.1:0")
// 		if err != nil {
// 			os.Exit(1)
// 		}
// 	}
// 	url := "http://" + ln.Addr().String() + "/"
// 	go http.Serve(ln, mux)
//
// 	// ---- finestra applicazione ----------------------------------------------
// 	lastPing.Store(time.Now().UnixMilli() + 40000) // tolleranza per il primo avvio
// 	browser := findBrowser()
// 	if browser != "" {
// 		profile := filepath.Join(os.Getenv("LOCALAPPDATA"), "ModelSplitterEvo", "profile")
// 		os.MkdirAll(profile, 0o755)
// 		cmd := exec.Command(browser,
// 			"--app="+url,
// 			"--user-data-dir="+profile,
// 			"--window-size=1600,1000",
// 			"--no-first-run", "--no-default-browser-check",
// 			"--disable-features=Translate")
// 		if err := cmd.Start(); err == nil {
// 			done := make(chan struct{})
// 			go func() { cmd.Wait(); close(done) }()
// 			watch(done)
// 			return
// 		}
// 	}
// 	openDefault(url)
// 	watch(nil)
// }

// v0.2.0: main() con finestra nativa WebView2 (fallback alla modalità v0.1.0)
func main() {
	url := startServer()
	lastPing.Store(time.Now().UnixMilli() + 40000) // tolleranza per il primo avvio

	// ---- finestra nativa WebView2 --------------------------------------------
	if runNative(url) {
		return // finestra chiusa dall'utente: fine del programma
	}

	// ---- fallback: Edge/Chrome in modalità app (comportamento v0.1.0) ---------
	browser := findBrowser()
	if browser != "" {
		// [2026-09-28 v0.2.0] profile := filepath.Join(os.Getenv("LOCALAPPDATA"), "ModelSplitterEvo", "profile")
		profile := filepath.Join(os.Getenv("LOCALAPPDATA"), "3DSTLMultipartMaker", "profile")
		os.MkdirAll(profile, 0o755)
		cmd := exec.Command(browser,
			"--app="+url,
			"--user-data-dir="+profile,
			"--window-size=1600,1000",
			"--no-first-run", "--no-default-browser-check",
			"--disable-features=Translate")
		if err := cmd.Start(); err == nil {
			done := make(chan struct{})
			go func() { cmd.Wait(); close(done) }()
			watch(done)
			return
		}
	}
	openDefault(url)
	watch(nil)
}

// Avvia il server HTTP interno con i file incorporati e restituisce l'URL
func startServer() string {
	sub, _ := fs.Sub(dist, "dist")
	mux := http.NewServeMux()
	files := http.FileServer(http.FS(sub))
	mux.HandleFunc("/api/ping", func(w http.ResponseWriter, r *http.Request) {
		lastPing.Store(time.Now().UnixMilli())
		w.Header().Set("Cache-Control", "no-store")
		w.Write([]byte("ok"))
	})
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// tipi MIME espliciti (il registro di Windows può non conoscere .wasm)
		switch {
		case strings.HasSuffix(r.URL.Path, ".wasm"):
			w.Header().Set("Content-Type", "application/wasm")
		case strings.HasSuffix(r.URL.Path, ".js"):
			w.Header().Set("Content-Type", "text/javascript; charset=utf-8")
		case strings.HasSuffix(r.URL.Path, ".css"):
			w.Header().Set("Content-Type", "text/css; charset=utf-8")
		}
		w.Header().Set("Cache-Control", "no-store")
		files.ServeHTTP(w, r)
	})
	ln, err := net.Listen("tcp", "127.0.0.1:47913")
	if err != nil { // porta occupata (es. seconda istanza): porta casuale
		ln, err = net.Listen("tcp", "127.0.0.1:0")
		if err != nil {
			os.Exit(1)
		}
	}
	go http.Serve(ln, mux)
	return "http://" + ln.Addr().String() + "/"
}

// Attende la chiusura: fine del processo browser o assenza di ping
func watch(done chan struct{}) {
	t := time.NewTicker(2 * time.Second)
	defer t.Stop()
	for {
		select {
		case <-done:
			// Edge può passare la finestra a un processo già aperto con lo
			// stesso profilo: in quel caso continuo a controllare i ping
			if time.Now().UnixMilli()-lastPing.Load() > 20000 {
				return
			}
			done = nil
		case <-t.C:
			if time.Now().UnixMilli()-lastPing.Load() > 20000 {
				return
			}
		}
	}
}

// Cerca Edge o Chrome nei percorsi standard di Windows
func findBrowser() string {
	if runtime.GOOS != "windows" {
		return ""
	}
	var cands []string
	for _, env := range []string{"ProgramFiles(x86)", "ProgramFiles", "LOCALAPPDATA"} {
		base := os.Getenv(env)
		if base == "" {
			continue
		}
		cands = append(cands,
			filepath.Join(base, "Microsoft", "Edge", "Application", "msedge.exe"),
			filepath.Join(base, "Google", "Chrome", "Application", "chrome.exe"))
	}
	for _, c := range cands {
		if _, err := os.Stat(c); err == nil {
			return c
		}
	}
	return ""
}

// Apre l'URL con il browser predefinito
func openDefault(url string) {
	if runtime.GOOS == "windows" {
		exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
	} else {
		exec.Command("xdg-open", url).Start()
	}
}
