import { useEffect } from "preact/hooks";
import { isElectron, getElectronAPI } from "../utils/electronUtils";

export const useFullscreenEscape = () => {
  useEffect(() => {
    console.log("useFullscreenEscape: Hook initialized");
    console.log("useFullscreenEscape: isElectron =", isElectron());

    if (!isElectron()) {
      console.log("useFullscreenEscape: Not in Electron, skipping ESC handler setup");
      return; // Only work in Electron
    }

    console.log("useFullscreenEscape: Setting up ESC key handler");

    const handleKeyDown = async (event: KeyboardEvent) => {
      console.log("useFullscreenEscape: Key pressed:", {
        key: event.key,
        keyCode: event.keyCode,
        code: event.code,
        target: (event.target as HTMLElement)?.tagName || "unknown",
      });

      // Check if ESC key was pressed
      if (event.key === "Escape" || event.keyCode === 27) {
        console.log("useFullscreenEscape: ESC key detected!");

        const electronAPI = getElectronAPI();
        console.log("useFullscreenEscape: electronAPI =", electronAPI);

        if (electronAPI && electronAPI.isFullscreen && electronAPI.toggleFullscreen) {
          console.log("useFullscreenEscape: electronAPI methods available");
          try {
            console.log("useFullscreenEscape: Checking current fullscreen state...");
            const isCurrentlyFullscreen = await electronAPI.isFullscreen();
            console.log("useFullscreenEscape: Current fullscreen state =", isCurrentlyFullscreen);

            if (isCurrentlyFullscreen) {
              console.log("useFullscreenEscape: Currently in fullscreen, toggling to windowed...");
              const result = await electronAPI.toggleFullscreen();
              console.log("useFullscreenEscape: Toggle result =", result);
            } else {
              console.log("useFullscreenEscape: Not in fullscreen, ignoring ESC key");
            }
          } catch (error) {
            console.error("useFullscreenEscape: Error handling ESC key:", error);
          }
        } else {
          console.log("useFullscreenEscape: electronAPI methods not available:", {
            hasElectronAPI: !!electronAPI,
            hasIsFullscreen: !!electronAPI?.isFullscreen,
            hasToggleFullscreen: !!electronAPI?.toggleFullscreen,
          });
        }
      } else {
        console.log("useFullscreenEscape: Non-ESC key, ignoring");
      }
    };

    // Add the event listener to the document
    console.log("useFullscreenEscape: Adding keydown event listener to document");
    document.addEventListener("keydown", handleKeyDown);
    console.log("useFullscreenEscape: Event listener added successfully");

    // Test that the event listener is working
    console.log("useFullscreenEscape: Testing event listener setup...");

    // Cleanup function
    return () => {
      console.log("useFullscreenEscape: Cleaning up event listener");
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);
};
