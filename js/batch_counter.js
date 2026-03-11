import { app } from "../../scripts/app.js";

app.registerExtension({
    name: "nova.batch.counter",

    async setup() {
        console.log("[Batch Counter] Extension loaded");

        // -----------------------------
        // 1) Create overlay
        // -----------------------------
        const overlay = document.createElement("div");
        overlay.id = "nova-batch-counter-overlay";
        overlay.textContent = "Batch: -- / --";
        Object.assign(overlay.style, {
            position: "fixed",
            right: "20px",
            bottom: "20px",
            zIndex: "999999",
            padding: "10px 14px",
            background: "rgba(0, 0, 0, 0.78)",
            color: "#fff",
            fontSize: "16px",
            fontFamily: "Arial, sans-serif",
            borderRadius: "10px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
            pointerEvents: "none",
            userSelect: "none",
        });
        document.body.appendChild(overlay);

        let lastIndex = null;
        let completedRounds = 0;

        // -----------------------------
        // 2) Utility helpers
        // -----------------------------
        function isVisible(el) {
            if (!el) return false;
            const style = window.getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            return (
                style.display !== "none" &&
                style.visibility !== "hidden" &&
                rect.width > 0 &&
                rect.height > 0
            );
        }

        function getVisibleImages() {
            // Grab all visible images on screen
            // Then keep only images large enough to be relevant
            const allImgs = [...document.querySelectorAll("img")];

            return allImgs.filter((img) => {
                if (!isVisible(img)) return false;
                const rect = img.getBoundingClientRect();

                // Ignore tiny icons/UI images
                return rect.width >= 48 && rect.height >= 48;
            });
        }

        function findLikelyThumbnailGroup(images) {
            // We try to find a parent container that holds several image thumbnails
            // The "best" candidate is the visible parent containing the most images
            const parentMap = new Map();

            for (const img of images) {
                let parent = img.parentElement;
                let depth = 0;

                while (parent && depth < 5) {
                    if (isVisible(parent)) {
                        const count = parent.querySelectorAll("img").length;
                        if (count >= 2) {
                            parentMap.set(parent, count);
                        }
                    }
                    parent = parent.parentElement;
                    depth++;
                }
            }

            if (parentMap.size === 0) return null;

            let bestParent = null;
            let bestCount = 0;

            for (const [parent, count] of parentMap.entries()) {
                if (count > bestCount) {
                    bestCount = count;
                    bestParent = parent;
                }
            }

            return bestParent;
        }

        function getGalleryImages() {
            const visibleImages = getVisibleImages();
            if (visibleImages.length === 0) return [];

            const group = findLikelyThumbnailGroup(visibleImages);
            if (!group) return [];

            const imgs = [...group.querySelectorAll("img")].filter((img) => {
                if (!isVisible(img)) return false;
                const rect = img.getBoundingClientRect();
                return rect.width >= 48 && rect.height >= 48;
            });

            // Remove duplicates by src + size
            const unique = [];
            const seen = new Set();

            for (const img of imgs) {
                const key = `${img.currentSrc || img.src}|${img.width}|${img.height}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    unique.push(img);
                }
            }

            return unique;
        }

        function getCurrentSelectedImageIndex(galleryImages) {
            if (!galleryImages.length) return null;

            // 1) Look for selected / active thumbnail styles
            const selectedPatterns = [
                '[aria-selected="true"] img',
                '.selected img',
                '.active img',
                '.current img',
                'img.selected',
                'img.active',
                'img.current',
            ];

            for (const selector of selectedPatterns) {
                const selected = document.querySelector(selector);
                if (selected) {
                    const index = galleryImages.findIndex(
                        (img) =>
                            img === selected ||
                            (img.currentSrc || img.src) === (selected.currentSrc || selected.src)
                    );
                    if (index !== -1) return index + 1;
                }
            }

            // 2) Fallback:
            // choose the largest visible image on screen as the "main preview"
            const visibleImages = getVisibleImages();
            let mainPreview = null;
            let biggestArea = 0;

            for (const img of visibleImages) {
                const rect = img.getBoundingClientRect();
                const area = rect.width * rect.height;
                if (area > biggestArea) {
                    biggestArea = area;
                    mainPreview = img;
                }
            }

            if (mainPreview) {
                const previewSrc = mainPreview.currentSrc || mainPreview.src;
                const index = galleryImages.findIndex(
                    (img) => (img.currentSrc || img.src) === previewSrc
                );
                if (index !== -1) return index + 1;
            }

            return null;
        }

        function updateOverlay() {
            const galleryImages = getGalleryImages();
            const total = galleryImages.length;

            if (!total || total < 2) {
                overlay.textContent = "Batch: -- / --";
                return;
            }

            const currentIndex = getCurrentSelectedImageIndex(galleryImages);

            if (!currentIndex) {
                overlay.textContent = `Batch: -- / ${total}`;
                return;
            }

            // detect completed loop
            if (
                lastIndex !== null &&
                lastIndex === total &&
                currentIndex === 1
            ) {
                completedRounds += 1;
            }

            overlay.textContent = `Batch: ${currentIndex} / ${total} • Loops: ${completedRounds}`;
            lastIndex = currentIndex;
        }

        // -----------------------------
        // 3) Observe UI changes
        // -----------------------------
        const observer = new MutationObserver(() => {
            updateOverlay();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["class", "style", "src", "aria-selected"],
        });

        // Also update when user clicks or uses keyboard
        window.addEventListener("click", updateOverlay, true);
        window.addEventListener("keydown", () => {
            // small delay so UI updates first
            setTimeout(updateOverlay, 30);
        });

        // Initial update
        setTimeout(updateOverlay, 300);
        setTimeout(updateOverlay, 1000);
    },
});
